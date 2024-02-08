import * as core from '@actions/core'
import * as github from '@actions/github'
import { BUNDLE_V02_MEDIA_TYPE } from '@sigstore/bundle'
import { attachArtifactToImage } from './oci'
import { generateProvenance, SLSA_PREDICATE_V1_TYPE } from './provenance'
import { Attestation, signStatement, Visibility } from './sign'
import { writeAttestation } from './store'
import { DIGEST_ALGORITHM, Subject, subjectFromInputs } from './subject'

const COLOR_CYAN = '\x1B[36m'
const COLOR_DEFAULT = '\x1B[39m'

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
      attestations.push(await attest(subject, visibility))
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

const attest = async (
  subject: Subject,
  visibility: Visibility
): Promise<Attestation> => {
  const provenance = generateProvenance(subject, process.env)

  core.startGroup(
    highlight(
      `Provenance attestation generated for ${subject.name} (sha256:${subject.digest.sha256})`
    )
  )
  core.info(JSON.stringify(provenance, null, 2))
  core.endGroup()

  // Sign provenance w/ Sigstore
  const attestation = await signStatement(provenance, visibility)

  core.startGroup(highlight('Attestation signed using ephemeral certificate'))
  core.info(attestation.certificate)
  core.endGroup()

  if (attestation.tlogURL) {
    core.info(
      highlight('Attestation signature uploaded to Rekor transparency log')
    )
    core.info(attestation.tlogURL)
  }

  const attestationURL = await writeAttestation(
    attestation.bundle,
    core.getInput('github-token')
  )

  core.info(highlight('Attestation uploaded to repository'))
  core.info(attestationURL)
  core.summary.addHeading('Attestation Created', 3)
  core.summary.addLink(
    `${subject.name}@${DIGEST_ALGORITHM}:${subject.digest[DIGEST_ALGORITHM]}`,
    attestationURL
  )
  core.summary.write()

  if (core.getBooleanInput('push-to-registry', { required: false })) {
    const artifact = await attachArtifactToImage({
      imageName: subject.name,
      imageDigest: `${DIGEST_ALGORITHM}:${subject.digest[DIGEST_ALGORITHM]}`,
      artifact: JSON.stringify(attestation.bundle),
      mediaType: BUNDLE_V02_MEDIA_TYPE,
      annotations: {
        'dev.sigstore.bundle/predicateType': SLSA_PREDICATE_V1_TYPE
      }
    })
    core.info(highlight('Attestation uploaded to registry'))
    core.info(`${subject.name}@${artifact.digest}`)
  }

  return attestation
}

const highlight = (str: string): string => `${COLOR_CYAN}${str}${COLOR_DEFAULT}`
