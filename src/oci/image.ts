import {
  CONTENT_TYPE_EMPTY_DESCRIPTOR,
  CONTENT_TYPE_OCI_INDEX,
  CONTENT_TYPE_OCI_MANIFEST
} from './constants'
import { Credentials } from './credentials'
import { HTTPError } from './error'
import { ImageName } from './name'
import { RegistryClient } from './registry'

import type { FetchOptions } from 'make-fetch-happen'
import type { Descriptor, ImageIndex, ImageManifest } from './types'

const EMPTY_BLOB = Buffer.from('{}')

export type AddArtifactOptions = {
  readonly artifact: string
  readonly mediaType: string
  readonly imageDigest: string
  readonly annotations?: Record<string, string>
  readonly fetchOpts?: FetchOptions
}

export class OCIImage {
  readonly #client: RegistryClient
  readonly #credentials: Credentials
  readonly #downgrade: boolean = false

  constructor(image: ImageName, creds: Credentials, opts?: FetchOptions) {
    this.#client = new RegistryClient(image.registry, image.path, opts)
    this.#credentials = creds

    // If the registry is not OCI-compliant, downgrade to Docker V2 API
    this.#downgrade =
      image.registry.includes('docker.io') ||
      image.registry.includes('amazonaws.com')
  }

  async addArtifact(opts: AddArtifactOptions): Promise<Descriptor> {
    if (this.#credentials) {
      await this.#client.signIn(this.#credentials)
    }

    // Check that the image exists
    const imageDescriptor = await this.#client.checkManifest(opts.imageDigest)

    // Upload the artifact blob
    const artifactBlob = await this.#client.uploadBlob(
      Buffer.from(opts.artifact)
    )

    // Upload the empty blob (needed for the manifest config)
    const emptyBlob = await this.#client.uploadBlob(EMPTY_BLOB)

    // Construct artifact manifest
    const manifest = buildManifest({
      artifactDescriptor: { ...artifactBlob, mediaType: opts.mediaType },
      subjectDescriptor: imageDescriptor,
      configDescriptor: {
        ...emptyBlob,
        mediaType: CONTENT_TYPE_EMPTY_DESCRIPTOR
      },
      annotations: opts.annotations
    })

    /* istanbul ignore if */
    if (this.#downgrade) {
      delete manifest.subject
      delete manifest.artifactType
    }

    // Upload artifact manifest
    const artifactDescriptor = await this.#client.uploadManifest(
      JSON.stringify(manifest)
    )

    // Manually update the referrers list if the referrers API is not supported.
    // The lack of a subjectDigest indicates that the referrers API is not
    // supported.
    if (artifactDescriptor.subjectDigest === undefined) {
      await this.#createReferrersIndexByTag({
        artifact: {
          ...artifactDescriptor,
          artifactType: opts.mediaType,
          annotations: opts.annotations
        },
        imageDigest: opts.imageDigest
      })
    }

    return artifactDescriptor
  }

  // Create a referrers index by tag. This is a fallback for registries that do
  // not support the referrers API.
  // https://github.com/opencontainers/distribution-spec/blob/main/spec.md#pushing-manifests-with-subject
  async #createReferrersIndexByTag(opts: {
    artifact: Descriptor
    imageDigest: string
  }): Promise<void> {
    const referrerTag = digestToTag(opts.imageDigest)
    let referrerManifest: ImageIndex
    let etag: string | undefined

    try {
      // Retrieve any existing referrer index
      const referrerIndex = await this.#client.getManifest(referrerTag)

      if (referrerIndex.mediaType !== CONTENT_TYPE_OCI_INDEX) {
        throw new Error(
          `Expected referrer manifest type ${CONTENT_TYPE_OCI_INDEX}, got ${referrerIndex.mediaType}`
        )
      }

      referrerManifest = referrerIndex.body as ImageIndex
      etag = referrerIndex.etag
    } catch (err) {
      // If the referrer index does not exist, create a new one
      if (err instanceof HTTPError && err.statusCode === 404) {
        referrerManifest = newIndex()
      } else {
        throw err
      }
    }

    // If the artifact is not already in the index, add it to the list and
    // re-upload the index
    if (
      !referrerManifest.manifests.some(
        manifest => manifest.digest === opts.artifact.digest
      )
    ) {
      // Add the artifact to the index
      referrerManifest.manifests.push(opts.artifact)

      this.#client.uploadManifest(JSON.stringify(referrerManifest), {
        mediaType: CONTENT_TYPE_OCI_INDEX,
        reference: referrerTag,
        etag
      })
    }
  }
}

// Build an OCI manifest document with references to the given artifact,
// subject, and config
const buildManifest = (opts: {
  artifactDescriptor: Descriptor
  subjectDescriptor: Descriptor
  configDescriptor: Descriptor
  annotations?: Record<string, string>
}): ImageManifest => ({
  schemaVersion: 2,
  mediaType: CONTENT_TYPE_OCI_MANIFEST,
  artifactType: opts.artifactDescriptor.mediaType,
  config: opts.configDescriptor,
  layers: [opts.artifactDescriptor],
  subject: opts.subjectDescriptor,
  annotations: opts.annotations
})

// Return an empty OCI index document
const newIndex = (): ImageIndex => ({
  mediaType: CONTENT_TYPE_OCI_INDEX,
  schemaVersion: 2,
  manifests: []
})

// Convert an image digest to a tag per the Referrers Tag Schema
// https://github.com/opencontainers/distribution-spec/blob/main/spec.md#referrers-tag-schema
const digestToTag = (digest: string): string => {
  return digest.replace(':', '-')
}
