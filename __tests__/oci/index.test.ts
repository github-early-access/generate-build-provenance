import fs from 'fs'
import nock from 'nock'
import crypto from 'node:crypto'
import os from 'os'
import path from 'path'
import { attachArtifactToImage } from '../../src/oci'
import {
  CONTENT_TYPE_OCI_MANIFEST,
  HEADER_OCI_SUBJECT
} from '../../src/oci/constants'

describe('attachArtifactToImage', () => {
  const registry = 'my-registry'
  const repo = 'my-repo'
  const imageName = `${registry}/${repo}`
  const imageDigest = 'sha256:deadbeef'
  const artifact = 'artifact'
  const mediaType = 'mediaType'

  // Set-up temporary directory for docker config
  let homedirSpy: jest.SpyInstance<string, []> | undefined
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-reg-creds-'))
  const dockerDir = path.join(tempDir, '.docker')
  fs.mkdirSync(dockerDir, { recursive: true })

  beforeEach(() => {
    homedirSpy = jest.spyOn(os, 'homedir')
    homedirSpy.mockReturnValue(tempDir)
  })

  afterEach(() => {
    homedirSpy?.mockRestore()
  })

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true })
  })

  describe('when all calls are successful', () => {
    const username = 'username'
    const password = 'password'
    const dockerConfig = {
      auths: {
        [registry]: {
          auth: Buffer.from(`${username}:${password}`).toString('base64')
        }
      }
    }

    const artifactDigest = `sha256:${crypto
      .createHash('sha256')
      .update(artifact)
      .digest('hex')}`
    const emptyDigest = `sha256:${crypto
      .createHash('sha256')
      .update(Buffer.from('{}'))
      .digest('hex')}`
    const artifactManifestDigest = 'sha256:cafed00d'

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )

      nock(`https://${registry}`)
        .post(`/v2/${repo}/blobs/uploads/`)
        .reply(200, {})

      nock(`https://${registry}`)
        .head(`/v2/${repo}/manifests/${imageDigest}`)
        .reply(200, {})

      nock(`https://${registry}`)
        .head(`/v2/${repo}/blobs/${artifactDigest}`)
        .reply(200, {})

      nock(`https://${registry}`)
        .head(`/v2/${repo}/blobs/${emptyDigest}`)
        .reply(200, {})

      nock(`https://${registry}`)
        .filteringPath(/sha256:[0-9a-f]{64}/, artifactManifestDigest)
        .put(`/v2/${repo}/manifests/${artifactManifestDigest}`)
        .reply(201, undefined, {
          [HEADER_OCI_SUBJECT]: artifactManifestDigest
        })
    })

    it('should return the artifact digest', async () => {
      const descriptor = await attachArtifactToImage({
        artifact,
        imageDigest,
        imageName,
        mediaType,
        fetchOpts: { retry: false }
      })

      expect(descriptor.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(descriptor.mediaType).toEqual(CONTENT_TYPE_OCI_MANIFEST)
    })
  })
})
