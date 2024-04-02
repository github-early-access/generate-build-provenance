import {
  Attestation,
  attest,
  buildSLSAProvenancePredicate
} from '@actions/attest'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { attachArtifactToImage, getRegistryCredentials } from '@sigstore/oci'
import { SEARCH_PUBLIC_GOOD_URL } from './endpoints'
import { DIGEST_ALGORITHM, Subject, subjectFromInputs } from './subject'

const COLOR_CYAN = '\x1B[36m'
const COLOR_DEFAULT = '\x1B[39m'

type Visibility = 'public' | 'private'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // Provenance visibility will be public ONLY if we can confirm that the
  // repository is public AND the undocumented "private-signing" arg is NOT set.
  // Otherwise, it will be private.
  const visibility =
    github.context.payload.repository?.visibility === 'public' &&
    core.getInput('private-signing') !== 'true'
      ? 'public'
      : 'private'
  core.debug(`Provenance attestation visibility: ${visibility}`)

  try {
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
      throw new Error(
        'missing "id-token" permission. Please add "permissions: id-token: write" to your workflow.'
      )
    }

    // Calculate subject from inputs and generate provenance
    const subjects = await subjectFromInputs()

    // Generate attestations for each subject serially
    const attestations: Attestation[] = []
    for (const subject of subjects) {
      attestations.push(await createAttestation(subject, visibility))
    }

    // Set bundle as action output, but ONLY IF there is a single attestation
    if (attestations.length === 1) {
      core.setOutput('bundle', attestations[0].bundle)
    }
  } catch (err) {
    // Fail the workflow run if an error occurs
    core.setFailed(
      err instanceof Error ? err.message : /* istanbul ignore next */ `${err}`
    )

    /* istanbul ignore if */
    if (err instanceof Error && err.cause) {
      const innerErr = err.cause
      core.debug(innerErr instanceof Error ? innerErr.message : `${innerErr}}`)
    }
  }
}

const createAttestation = async (
  subject: Subject,
  visibility: Visibility
): Promise<Attestation> => {
  const predicate = await buildSLSAProvenancePredicate()
  core.startGroup(
    highlight(
      `Provenance attestation generated for ${subject.name} (sha256:${subject.digest.sha256})`
    )
  )
  core.info(
    JSON.stringify(
      { predicateType: predicate.type, predicate: predicate.params },
      null,
      2
    )
  )
  core.endGroup()

  const attestation = await attest({
    subjectName: subject.name,
    subjectDigest: subject.digest,
    predicateType: predicate.type,
    predicate: predicate.params,
    token: core.getInput('github-token'),
    sigstore: visibility === 'public' ? 'public-good' : 'github'
  })
  core.startGroup(highlight('Attestation signed using ephemeral certificate'))
  core.info(attestation.certificate)
  core.endGroup()

  if (attestation.tlogID) {
    const tlogURL = `${SEARCH_PUBLIC_GOOD_URL}?logIndex=${attestation.tlogID}`
    core.info(
      highlight('Attestation signature uploaded to Rekor transparency log')
    )
    core.info(tlogURL)
  }

  const attestationURL = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/attestations/${attestation.attestationID}`
  core.info(highlight('Attestation uploaded to repository'))
  core.info(attestationURL)
  core.summary.addHeading('Attestation Created', 3)
  core.summary.addLink(
    `${subject.name}@${DIGEST_ALGORITHM}:${subject.digest[DIGEST_ALGORITHM]}`,
    attestationURL
  )
  core.summary.write()

  if (core.getBooleanInput('push-to-registry', { required: false })) {
    const credentials = getRegistryCredentials(subject.name)
    const artifact = await attachArtifactToImage({
      credentials,
      imageName: subject.name,
      imageDigest: subjectDigest(subject),
      artifact: Buffer.from(JSON.stringify(attestation.bundle)),
      mediaType: attestation.bundle.mediaType,
      annotations: {
        'dev.sigstore.bundle.content': 'dsse-envelope',
        'dev.sigstore.bundle.predicateType': predicate.type
      }
    })
    core.info(highlight('Attestation uploaded to registry'))
    core.info(`${subject.name}@${artifact.digest}`)
  }

  return attestation
}

// Returns the subject's digest as a formatted string of the form
// "<algorithm>:<digest>".
const subjectDigest = (subject: Subject): string => {
  const alg = Object.keys(subject.digest).sort()[0]
  return `${alg}:${subject.digest[alg]}`
}

const highlight = (str: string): string => `${COLOR_CYAN}${str}${COLOR_DEFAULT}`
