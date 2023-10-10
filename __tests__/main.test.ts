/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as main from '../src/main'

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug')
const getInputMock = jest.spyOn(core, 'getInput')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('invokes the action', async () => {
    // Set the action's inputs as return values from core.getInput()
    getInputMock.mockImplementation((name: string): string => {
      switch (name) {
        case 'subject_digest':
          return 'sha1:babca52ab0c93ae16539e5923cb0d7403b9a093b'
        case 'subject_name':
          return 'subject'
        default:
          return ''
      }
    })

    await main.run()
    expect(runMock).toHaveReturned()

    // Verify that all of the core library functions were called correctly
    expect(debugMock).toHaveBeenNthCalledWith(1, 'subject_path ')
    expect(debugMock).toHaveBeenNthCalledWith(
      2,
      'subject_digest sha1:babca52ab0c93ae16539e5923cb0d7403b9a093b'
    )
    expect(debugMock).toHaveBeenNthCalledWith(3, 'subject_name subject')
  })
})
