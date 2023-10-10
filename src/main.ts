import * as core from '@actions/core'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const subjectPath: string = core.getInput('subject_path')
    const subjectDigest: string = core.getInput('subject_digest')
    const subjectName: string = core.getInput('subject_name')

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`subject_path ${subjectPath}`)
    core.debug(`subject_digest ${subjectDigest}`)
    core.debug(`subject_name ${subjectName}`)
    core.debug(new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
