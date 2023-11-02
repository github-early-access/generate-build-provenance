import nock from 'nock'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { HTTPError } from '../../src/oci/error'
import { RegistryClient } from '../../src/oci/registry'

describe('RegistryClient', () => {
  const registryName = 'registry.example.com'
  const repoName = 'test'
  const registryURL = `https://${registryName}`
  const subject = new RegistryClient(registryName, repoName)

  describe('versionCheck', () => {
    describe('when the Api-Version header is avaialble', () => {
      beforeEach(() => {
        nock(registryURL).get('/v2/').reply(200, undefined, {
          'Docker-Distribution-Api-Version': 'registry/2.0'
        })
      })

      it('returns the version', async () => {
        const version = await subject.versionCheck()
        expect(version).toEqual('registry/2.0')
      })
    })

    describe('when the Api-Version header is NOT avaialble', () => {
      beforeEach(() => {
        nock(registryURL).get('/v2/').reply(200)
      })

      it('returns the empty string', async () => {
        const version = await subject.versionCheck()
        expect(version).toEqual('')
      })
    })
  })

  describe('uploadBlob', () => {
    const blob = Buffer.from('hello world', 'utf8')
    const digest = `sha256:${crypto
      .createHash('sha256')
      .update(blob)
      .digest('hex')}`

    describe('when everything is successful', () => {
      beforeEach(() => {
        nock(registryURL)
          .head(`/v2/${repoName}/blobs/${digest}`)
          .reply(404)
          .post(`/v2/${repoName}/blobs/uploads/`)
          .reply(202, undefined, {
            Location: `${registryURL}/v2/${repoName}/blobs/uploads/123`
          })
          .put(`/v2/${repoName}/blobs/uploads/123?digest=${digest}`)
          .reply(201)
      })

      it('uploads the blob', async () => {
        const response = await subject.uploadBlob(blob)
        expect(response).toEqual(digest)
      })
    })

    describe('when registry returns a relative upload location', () => {
      beforeEach(() => {
        nock(registryURL)
          .head(`/v2/${repoName}/blobs/${digest}`)
          .reply(404)
          .post(`/v2/${repoName}/blobs/uploads/`)
          .reply(202, undefined, {
            Location: `/v2/${repoName}/blobs/uploads/123`
          })
          .put(`/v2/${repoName}/blobs/uploads/123?digest=${digest}`)
          .reply(201)
      })

      it('uploads the blob', async () => {
        const response = await subject.uploadBlob(blob)
        expect(response).toEqual(digest)
      })
    })

    describe('when the blob already exists', () => {
      beforeEach(() => {
        nock(registryURL).head(`/v2/${repoName}/blobs/${digest}`).reply(200)
      })

      it('returns the blob digest', async () => {
        const response = await subject.uploadBlob(blob)
        expect(response).toEqual(digest)
      })
    })

    describe('when the upload location is missing', () => {
      beforeEach(() => {
        nock(registryURL)
          .head(`/v2/${repoName}/blobs/${digest}`)
          .reply(404)
          .post(`/v2/${repoName}/blobs/uploads/`)
          .reply(202)
      })

      it('throws an error', async () => {
        await expect(subject.uploadBlob(blob)).rejects.toThrow(
          /missing upload location/
        )
      })
    })

    describe('when the upload returns an unexpected status code', () => {
      beforeEach(() => {
        nock(registryURL)
          .head(`/v2/${repoName}/blobs/${digest}`)
          .reply(404)
          .post(`/v2/${repoName}/blobs/uploads/`)
          .reply(202, undefined, {
            Location: `/v2/${repoName}/blobs/uploads/123`
          })
          .put(`/v2/${repoName}/blobs/uploads/123?digest=${digest}`)
          .reply(203)
      })

      it('throws an error', async () => {
        await expect(subject.uploadBlob(blob)).rejects.toThrow(
          /unexpected status/
        )
      })
    })
  })

  describe('getManifest', () => {
    describe('when the manifest exists', () => {
      const manifest = { foo: 'bar' }
      beforeEach(() => {
        nock(registryURL)
          .get(`/v2/${repoName}/manifests/latest`)
          .reply(200, manifest, { 'Content-Type': 'application/json' })
      })

      it('returns the manifest', async () => {
        const response = await subject.getManifest('latest')
        expect(response.body).toEqual(manifest)
        expect(response.mediaType).toEqual('application/json')
      })
    })

    describe('when the manifest does not exist', () => {
      beforeEach(() => {
        nock(registryURL).get(`/v2/${repoName}/manifests/latest`).reply(404)
      })

      it('throws an error', async () => {
        expect.assertions(2)
        try {
          await subject.getManifest('latest')
        } catch (error) {
          assert(error instanceof HTTPError)
          /* eslint-disable-next-line jest/no-conditional-expect */
          expect(error.statusCode).toEqual(404)
          /* eslint-disable-next-line jest/no-conditional-expect */
          expect(error.message).toMatch(/not found/i)
        }
      })
    })
  })

  describe('uploadManifest', () => {
    const manifest = JSON.stringify({ foo: 'bar' })
    const digest = `sha256:${crypto
      .createHash('sha256')
      .update(manifest)
      .digest('hex')}`

    describe('when uploading by digest', () => {
      beforeEach(() => {
        nock(registryURL)
          .put(`/v2/${repoName}/manifests/${digest}`)
          .matchHeader(
            'Content-Type',
            'application/vnd.oci.image.manifest.v1+json'
          )
          .reply(201)
      })

      it('uploads the manifest', async () => {
        const response = await subject.uploadManifest(manifest)
        expect(response).toEqual(digest)
      })
    })

    describe('when uploading by reference', () => {
      const reference = 'latest'
      const contentType = 'application/json'

      beforeEach(() => {
        nock(registryURL)
          .put(`/v2/${repoName}/manifests/${reference}`)
          .matchHeader('Content-Type', contentType)
          .reply(201)
      })

      it('uploads the manifest', async () => {
        const response = await subject.uploadManifest(manifest, {
          reference,
          mediaType: contentType
        })
        expect(response).toEqual(digest)
      })
    })

    describe('when the upload returns an unexpected status code', () => {
      beforeEach(() => {
        nock(registryURL).put(`/v2/${repoName}/manifests/${digest}`).reply(203)
      })

      it('throws an error', async () => {
        await expect(subject.uploadManifest(manifest)).rejects.toThrow(
          /unexpected status/
        )
      })
    })
  })
})
