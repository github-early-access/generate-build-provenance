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
  SEARCH_PUBLIC_GOOD_URL,
  TSA_INTERNAL_URL
} from '../src/endpoints'
import * as main from '../src/main'
import * as oci from '../src/oci'
import { CONTENT_TYPE_OCI_MANIFEST } from '../src/oci/constants'

// Mock the GitHub Actions core library
const debugMock = jest.spyOn(core, 'debug')
const infoMock = jest.spyOn(core, 'info')
const getInputMock = jest.spyOn(core, 'getInput')
const getBooleanInputMock = jest.spyOn(core, 'getBooleanInput')
const setOutputMock = jest.spyOn(core, 'setOutput')
const setFailedMock = jest.spyOn(core, 'setFailed')

const summaryWriteMock = jest.spyOn(core.summary, 'write')
summaryWriteMock.mockImplementation(async () => Promise.resolve(core.summary))

// Mock the action's main function
const runMock = jest.spyOn(main, 'run')

describe('action', () => {
  // Capture original environment variables and GitHub context so we can restore
  // them after each test
  const originalEnv = process.env
  const originalContext = { ...github.context }

  // Fake an OIDC token
  const subject = 'foo@bar.com'
  const oidcPayload = { sub: subject, iss: '' }
  const oidcToken = `.${Buffer.from(JSON.stringify(oidcPayload)).toString(
    'base64'
  )}.}`

  const attestationID = '1234567890'

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock OIDC token endpoint
    const tokenURL = 'https://token.url'

    nock(tokenURL)
      .get('/')
      .query({ audience: 'sigstore' })
      .reply(200, { value: oidcToken })

    nock('https://api.github.com')
      .post(/^\/repos\/.*\/.*\/attestations$/)
      .reply(201, { id: attestationID })

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
    const inputs = {
      'subject-digest':
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      'subject-name': 'subject',
      'github-token': 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      getInputMock.mockImplementation(mockInput(inputs))
      getBooleanInputMock.mockImplementation(() => false)

      await mockFulcio({ baseURL: FULCIO_INTERNAL_URL, strict: false })
      await mockTSA({ baseURL: TSA_INTERNAL_URL })
    })

    it('invokes the action w/o error', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(debugMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('private')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('https://in-toto.io/Statement/v1')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('-----BEGIN CERTIFICATE-----')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/attestation uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        4,
        expect.stringMatching(attestationID)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        'bundle',
        expect.anything()
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when the repository is public', () => {
    const inputs = {
      'subject-digest':
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      'subject-name': 'subject',
      'github-token': 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with public repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'public' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      // Mock the action's inputs
      getInputMock.mockImplementation(mockInput(inputs))
      getBooleanInputMock.mockImplementation(() => false)

      await mockFulcio({ baseURL: FULCIO_PUBLIC_GOOD_URL, strict: false })
      await mockRekor({ baseURL: REKOR_PUBLIC_GOOD_URL })
    })

    it('invokes the action w/o error', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(debugMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('public')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('https://in-toto.io/Statement/v1')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('-----BEGIN CERTIFICATE-----')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/signature uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        4,
        expect.stringMatching(SEARCH_PUBLIC_GOOD_URL)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        5,
        expect.stringMatching(/attestation uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        6,
        expect.stringMatching(attestationID)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        'bundle',
        expect.anything()
      )
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })

  describe('when push-to-registry is true', () => {
    const ociSpy = jest.spyOn(oci, 'attachArtifactToImage')

    const artifactDigest = 'sha256:1234567890'
    const artifactSize = 123

    const inputs = {
      'subject-digest':
        'sha256:7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32',
      'subject-name': 'registry/foo/bar',
      'github-token': 'gh-token'
    }

    beforeEach(async () => {
      // Set the GH context with private repository visibility and a repo owner.
      setGHContext({
        payload: { repository: { visibility: 'private' } },
        repo: { owner: 'foo', repo: 'bar' }
      })

      getInputMock.mockImplementation(mockInput(inputs))

      // This is the where we mock the push-to-registry input
      getBooleanInputMock.mockImplementation(() => true)

      await mockFulcio({ baseURL: FULCIO_INTERNAL_URL, strict: false })
      await mockTSA({ baseURL: TSA_INTERNAL_URL })

      ociSpy.mockImplementation(async () =>
        Promise.resolve({
          digest: artifactDigest,
          mediaType: CONTENT_TYPE_OCI_MANIFEST,
          size: artifactSize
        })
      )
    })

    it('invokes the action w/o error', async () => {
      await main.run()

      expect(runMock).toHaveReturned()
      expect(setFailedMock).not.toHaveBeenCalled()

      expect(debugMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('private')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching('https://in-toto.io/Statement/v1')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching('-----BEGIN CERTIFICATE-----')
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(/attestation uploaded/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        4,
        expect.stringMatching(attestationID)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        5,
        expect.stringMatching(/attestation uploaded to registry/i)
      )
      expect(infoMock).toHaveBeenNthCalledWith(
        6,
        expect.stringMatching(artifactDigest)
      )
      expect(setOutputMock).toHaveBeenNthCalledWith(
        1,
        'bundle',
        expect.anything()
      )
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

function mockInput(inputs: Record<string, string>): typeof core.getInput {
  return (name: string): string => {
    if (name in inputs) {
      return inputs[name]
    }
    return ''
  }
}

// Stubbing the GitHub context is a bit tricky. We need to use
// `Object.defineProperty` because `github.context` is read-only.
function setGHContext(context: object): void {
  Object.defineProperty(github, 'context', { value: context })
}
