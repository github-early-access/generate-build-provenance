import fetch, { FetchInterface } from 'make-fetch-happen'
import crypto from 'node:crypto'
import { HTTPError, checkStatus } from './error'

const CONTENT_TYPE_OCI_MANIFEST = 'application/vnd.oci.image.manifest.v1+json'
const CONTENT_TYPE_OCTET_STREAM = 'application/octet-stream'

export type UploadManifestOptions = {
  readonly reference?: string
  readonly mediaType?: string
}

export type GetManifestResponse = {
  readonly body: unknown
  readonly mediaType: string
}

export class RegistryClient {
  readonly #baseURL: string
  readonly #repository: string
  readonly #fetch: FetchInterface

  constructor(registry: string, repository: string) {
    this.#repository = repository
    this.#fetch = fetch.defaults({})

    // Use http for localhost registries, https otherwise
    const hostname = new URL(`http://${registry}`).hostname
    /* istanbul ignore next */
    const protocol =
      hostname === 'localhost' || hostname === '127.0.0.1' ? 'http' : 'https'
    this.#baseURL = `${protocol}://${registry}`
  }

  async versionCheck(): Promise<string> {
    const response = await this.#fetch(`${this.#baseURL}/v2/`)
    await checkStatus(response)

    return response.headers.get('Docker-Distribution-Api-Version') || ''
  }

  async uploadBlob(blob: Buffer): Promise<string> {
    const digest = RegistryClient.digest(blob)

    // Check if blob already exists
    const headResponse = await this.#fetch(
      `${this.#baseURL}/v2/${this.#repository}/blobs/${digest}`,
      { method: 'HEAD' }
    )

    if (headResponse.status === 200) {
      return digest
    }

    // Retrieve upload location (session ID)
    const postResponse = await this.#fetch(
      `${this.#baseURL}/v2/${this.#repository}/blobs/uploads/`,
      { method: 'POST' }
    )
    await checkStatus(postResponse)

    const location = postResponse.headers.get('location')
    if (!location) {
      throw new Error('OCI API: missing upload location')
    }

    // Translate location to a full URL
    const uploadLocation = new URL(
      location.startsWith('/') ? `${this.#baseURL}${location}` : location
    )

    // Add digest to query string
    uploadLocation.searchParams.set('digest', digest)

    // Upload blob
    const putResponse = await this.#fetch(uploadLocation.href, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': CONTENT_TYPE_OCTET_STREAM }
    })
    await checkStatus(putResponse)

    if (putResponse.status !== 201) {
      throw new HTTPError({
        message: `OCI API: unexpected status for upload`,
        status: putResponse.status
      })
    }

    return digest
  }

  async getManifest(reference: string): Promise<GetManifestResponse> {
    const response = await this.#fetch(
      `${this.#baseURL}/v2/${this.#repository}/manifests/${reference}`
    )
    await checkStatus(response)

    const body = await response.json()
    const mediaType =
      response.headers.get('content-type') || /* istanbul ignore next */ ''

    return { body, mediaType }
  }

  async uploadManifest(
    manifest: string,
    options: UploadManifestOptions = {}
  ): Promise<string> {
    const digest = RegistryClient.digest(manifest)
    const reference = options.reference || digest
    const contentType = options.mediaType || CONTENT_TYPE_OCI_MANIFEST

    const response = await this.#fetch(
      `${this.#baseURL}/v2/${this.#repository}/manifests/${reference}`,
      {
        method: 'PUT',
        body: manifest,
        headers: { 'Content-Type': contentType }
      }
    )
    await checkStatus(response)

    if (response.status !== 201) {
      throw new HTTPError({
        message: `OCI API: unexpected status for upload`,
        status: response.status
      })
    }

    return digest
  }

  private static digest(blob: crypto.BinaryLike): string {
    const hash = crypto.createHash('sha256')
    hash.update(blob)
    return `sha256:${hash.digest('hex')}`
  }
}
