import * as core from '@actions/core'
import * as github from '@actions/github'
import { generateProvenance } from './provenance'
import { signStatement } from './sign'
import { writeAttestation } from './store'
import { subjectFromInputs } from './subject'

const COLOR_CYAN = '\x1B[36m'
const COLOR_DEFAULT = '\x1B[39m'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  // Provenance visibility will be public ONLY if we can confirm that the
  // repository is public. Otherwise, it will be private.
  const visibility =
    github.context.payload.repository?.visibility === 'public'
      ? 'public'
      : 'private'
  core.debug(`Provenance attestation visibility: ${visibility}`)

  try {
    // Calculate subject from inputs and generate provenance
    const subject = await subjectFromInputs()
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
  } catch (err) {
    // Fail the workflow run if an error occurs
    core.setFailed(
      err instanceof Error ? err.message : /* istanbul ignore next */ `${err}`
    )
  }
}

const highlight = (str: string): string => `${COLOR_CYAN}${str}${COLOR_DEFAULT}`
