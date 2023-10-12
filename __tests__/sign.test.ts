import { mockFulcio, mockRekor, mockTSA } from '@sigstore/mock'
import nock from 'nock'
import {
  FULCIO_INTERNAL_URL,
  FULCIO_PUBLIC_GOOD_URL,
  REKOR_PUBLIC_GOOD_URL,
  TSA_INTERNAL_URL
} from '../src/endpoints'
import { signProvenance } from '../src/sign'

describe('signProvenance', () => {
  const originalEnv = process.env

  // Fake an OIDC token
  const subject = 'foo@bar.com'
  const oidcPayload = { sub: subject, iss: '' }
  const oidcToken = `.${Buffer.from(JSON.stringify(oidcPayload)).toString(
    'base64'
  )}.}`

  // Dummy provenance to be signed
  const provenance = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: {
      name: 'subjective',
      digest: {
        sha256:
          '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'
      }
    }
  }

  beforeEach(() => {
    // Mock OIDC token endpoint
    const tokenURL = 'https://token.url'

    process.env = {
      ...originalEnv,
      ACTIONS_ID_TOKEN_REQUEST_URL: tokenURL,
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'token'
    }

    nock(tokenURL)
      .get('/')
      .query({ audience: 'sigstore' })
      .reply(200, { value: oidcToken })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('when visibility is public', () => {
    const visibility = 'public'
    beforeEach(async () => {
      await mockFulcio({ baseURL: FULCIO_PUBLIC_GOOD_URL, strict: false })
      await mockRekor({ baseURL: REKOR_PUBLIC_GOOD_URL })
    })

    it('returns a bundle', async () => {
      const bundle = await signProvenance(provenance, visibility)

      expect(bundle).toBeDefined()
      expect(bundle.mediaType).toEqual(
        'application/vnd.dev.sigstore.bundle+json;version=0.2'
      )

      // Should have a certificate
      expect(
        bundle.verificationMaterial.x509CertificateChain?.certificates
      ).toHaveLength(1)

      // Should have one tlog entry
      expect(bundle.verificationMaterial.tlogEntries).toHaveLength(1)

      // Should have zero rfc3161 timestamps
      expect(
        bundle.verificationMaterial.timestampVerificationData?.rfc3161Timestamps
      ).toHaveLength(0)

      // Should have a signature
      expect(bundle.dsseEnvelope?.signatures).toHaveLength(1)

      // Should contain the provenance
      expect(bundle.dsseEnvelope?.payloadType).toEqual(
        'application/vnd.in-toto+json'
      )
      expect(bundle.dsseEnvelope?.payload).toEqual(
        Buffer.from(JSON.stringify(provenance)).toString('base64')
      )
    })
  })

  describe('when visibility is private', () => {
    const visibility = 'private'
    beforeEach(async () => {
      await mockFulcio({ baseURL: FULCIO_INTERNAL_URL, strict: false })
      await mockTSA({ baseURL: TSA_INTERNAL_URL })
    })

    it('returns a bundle', async () => {
      const bundle = await signProvenance(provenance, visibility)

      expect(bundle).toBeDefined()
      expect(bundle.mediaType).toEqual(
        'application/vnd.dev.sigstore.bundle+json;version=0.2'
      )

      // Should have a certificate
      expect(
        bundle.verificationMaterial.x509CertificateChain?.certificates
      ).toHaveLength(1)

      // Should have zero tlog entriies
      expect(bundle.verificationMaterial.tlogEntries).toHaveLength(0)

      // Should have one rfc3161 timestamps
      expect(
        bundle.verificationMaterial.timestampVerificationData?.rfc3161Timestamps
      ).toHaveLength(1)

      // Should have a signature
      expect(bundle.dsseEnvelope?.signatures).toHaveLength(1)

      // Should contain the provenance
      expect(bundle.dsseEnvelope?.payloadType).toEqual(
        'application/vnd.in-toto+json'
      )
      expect(bundle.dsseEnvelope?.payload).toEqual(
        Buffer.from(JSON.stringify(provenance)).toString('base64')
      )
    })
  })
})
