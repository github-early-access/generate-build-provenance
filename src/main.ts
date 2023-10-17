import * as core from '@actions/core'
import * as github from '@actions/github'
import { generateProvenance } from './provenance'
import { signStatement } from './sign'
import { writeAttestation } from './store'
import { subjectFromInputs } from './subject'

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
  core.debug(`Provenance visibility: ${visibility}`)

  try {
    // Calculate subject from inputs and generate provenance
    const subject = await subjectFromInputs()
    const provenance = generateProvenance(subject, process.env)
    core.debug(JSON.stringify(provenance))

    const attestation = await signStatement(provenance, visibility)
    // TODO: Replace w/ artifact upload
    core.debug(JSON.stringify(attestation))

    await writeAttestation(attestation.bundle, core.getInput('github-token'))
  } catch (err) {
    // Fail the workflow run if an error occurs
    core.setFailed(
      err instanceof Error ? err.message : /* istanbul ignore next */ `${err}`
    )
  }
}
