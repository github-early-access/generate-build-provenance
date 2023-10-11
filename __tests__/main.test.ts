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
const setFailedMock = jest.spyOn(core, 'setFailed')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('when a subject digest is provided', () => {
    beforeEach(() => {
      getInputMock.mockImplementation((name: string): string => {
        switch (name) {
          case 'subject-digest':
            return 'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
          case 'subject-name':
            return 'subject'
          default:
            return ''
        }
      })
    })

    it('invokes the action w/o error', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(debugMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('https://in-toto.io/Statement/v1')
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when no inputs are provided', () => {
    beforeEach(() => {
      getInputMock.mockImplementation(() => '')
    })

    it('sets a failed status', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /one of subject-path or subject-digest must be provided/i
        )
      )
    })
  })
})
