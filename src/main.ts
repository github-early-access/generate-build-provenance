import * as core from '@actions/core'
import { generateProvenance } from './provenance'
import { subjectFromInputs } from './subject'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // Calculate subject from inputs and generate provenance
    const subject = await subjectFromInputs()
    const provenance = generateProvenance(subject)
    core.debug(JSON.stringify(provenance))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
