export type Descriptor = {
  mediaType: string
  digest: string
  size: number
  artifactType?: string
  urls?: string[]
  annotations?: Record<string, string>
  data?: string
}

export type Platform = {
  architecture: string
  os: string
  'os.version'?: string
  'os.features'?: string[]
  variant?: string
  features?: string[]
}

export type ImageManifest = {
  schemaVersion: number
  mediaType: string
  artifactType?: string
  config: Descriptor
  layers: Descriptor[]
  subject: Descriptor
  annotations?: Record<string, string>
}

export type ImageIndex = {
  schemaVersion: number
  mediaType: string
  artifactType?: string
  manifests: Descriptor & { platform?: Platform }[]
  subject?: Descriptor
  annotations?: Record<string, string>
}
