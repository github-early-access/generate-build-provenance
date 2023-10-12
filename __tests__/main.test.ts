/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { mockFulcio, mockRekor, mockTSA } from '@sigstore/mock'
import nock from 'nock'
import {
  FULCIO_INTERNAL_URL,
  FULCIO_PUBLIC_GOOD_URL,
  REKOR_PUBLIC_GOOD_URL,
  TSA_INTERNAL_URL
} from '../src/endpoints'
import * as main from '../src/main'

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug')
const getInputMock = jest.spyOn(core, 'getInput')
const setFailedMock = jest.spyOn(core, 'setFailed')

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  const originalEnv = process.env
  const originalContext = { ...github.context }

  // Fake an OIDC token
  const subject = 'foo@bar.com'
  const oidcPayload = { sub: subject, iss: '' }
  const oidcToken = `.${Buffer.from(JSON.stringify(oidcPayload)).toString(
    'base64'
  )}.}`

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock OIDC token endpoint
    const tokenURL = 'https://token.url'

    nock(tokenURL)
      .get('/')
      .query({ audience: 'sigstore' })
      .reply(200, { value: oidcToken })

    process.env = {
      ...originalEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: tokenURL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token'
    }
  })

  afterEach(() => {
    // Restore the original environment
    process.env = originalEnv

    // Restore the original github.context
    setGHContext(originalContext)
  })

  describe('when the repository is private', () => {
    beforeEach(async () => {
      // Set the repository visibility to private.
      setGHContext({ payload: { repository: { visibility: 'private' } } })

      await mockFulcio({ baseURL: FULCIO_INTERNAL_URL, strict: false })
      await mockTSA({ baseURL: TSA_INTERNAL_URL })

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
        expect.stringMatching('private')
      )
      expect(debugMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('https://in-toto.io/Statement/v1')
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when the repository is public', () => {
    beforeEach(async () => {
      // Set the repository visibility to public.
      setGHContext({ payload: { repository: { visibility: 'public' } } })

      await mockFulcio({ baseURL: FULCIO_PUBLIC_GOOD_URL, strict: false })
      await mockRekor({ baseURL: REKOR_PUBLIC_GOOD_URL })

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
        expect.stringMatching('public')
      )
      expect(debugMock).toHaveBeenNthCalledWith(
        2,
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

// Stubbing the GitHub context is a bit tricky. We need to use
// `Object.defineProperty` because `github.context` is read-only.
function setGHContext(context: object): void {
  Object.defineProperty(github, 'context', { value: context })
}
