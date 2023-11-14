import { getRegistryCredentials } from './credentials'
import { AddArtifactOptions, OCIImage } from './image'
import { parseImageName } from './name'

import type { Descriptor } from './types'

export type AttachArtifactOptions = AddArtifactOptions & {
  readonly imageName: string
}

export const attachArtifactToImage = async (
  opts: AttachArtifactOptions
): Promise<Descriptor> => {
  const image = parseImageName(opts.imageName)
  const creds = getRegistryCredentials(image.registry)
  return new OCIImage(image, creds, opts.fetchOpts).addArtifact(opts)
}
