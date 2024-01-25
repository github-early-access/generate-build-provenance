import fs from 'fs'
import { Subject } from './subject'

export type Sbom = {
  type: 'spdx' | 'cyclonedx'
  object: object
}

export async function parseSBOMFromPath(path: string): Promise<Sbom> {
  try {
    // Read the file content
    const fileContent = await fs.promises.readFile(path, 'utf8')

    const sbom = JSON.parse(fileContent)

    if (checkIsSPDX(sbom)) {
      return { type: 'spdx', object: sbom }
    } else if (checkIsCycloneDX(sbom)) {
      return { type: 'cyclonedx', object: sbom }
    } else {
      throw new Error('Unsupported SBOM format')
    }
  } catch (error) {
    throw error
  }
}

function checkIsSPDX(sbomObject: any): boolean {
  if (sbomObject.spdxVersion && sbomObject.SPDXID) {
    return true
  } else {
    return false
  }
}

function checkIsCycloneDX(sbomObject: any): boolean {
  if (
    sbomObject.bomFormat &&
    sbomObject.serialNumber &&
    sbomObject.specVersion
  ) {
    return true
  } else {
    return false
  }
}

export const generateSBOMStatement = (subject: Subject, sbom: Sbom): object => {
  if (sbom.type === 'spdx') {
    return generateSPDXIntoto(subject, sbom.object)
  }
  throw new Error('Unsupported SBOM format')
}

export const generateSPDXIntoto = (subject: Subject, sbom: object): object => {
  return {
    _type: 'https://in-toto.io/Statement/v0.1',
    subject: [subject],
    predicateType: 'https://spdx.dev/Document/v2.3',
    predicate: sbom
  }
}

export const generateCycloneDXIntoto = (
  subject: Subject,
  sbom: object
): object => {
  return {
    _type: 'https://in-toto.io/Statement/v0.1',
    subject: [subject],
    predicateType: 'https://cyclonedx.org/bom/v1.4',
    predicate: sbom
  }
}
