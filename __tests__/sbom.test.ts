import { parseSBOMFromPath, generateSBOMStatement } from '../src/sbom'
import fs from 'fs'
import { Subject } from '../src/subject'
import path from 'path'

describe('sbom', () => {

describe('parseSBOMFromPath', () => {
  it('should parse SPDX SBOM', async () => {
    const sbomPath = './data/spdx.json'
    const currentPath = path.join(__dirname, sbomPath)
    const result = await parseSBOMFromPath(currentPath)

    expect(result.type).toEqual('spdx')
  })

  it('should parse CycloneDX SBOM', async () => {
    const sbomPath = './data/cyclonedx.json'
    const currentPath = path.join(__dirname, sbomPath)
    const result = await parseSBOMFromPath(currentPath)

    expect(result.type).toEqual('cyclonedx')
  })

  it('should throw an error for unsupported SBOM format', async () => {
    const sbomPath = '/path/to/unsupported.sbom'
    const sbomContent = JSON.stringify({
      /* Unsupported SBOM content */
    })
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(sbomContent)

    await expect(parseSBOMFromPath(sbomPath)).rejects.toThrow(
      'Unsupported SBOM format'
    )
    jest.restoreAllMocks();
  })
})

describe('generateSBOMStatement', () => {
  const subject = {
    name: 'test',
    digest: {
      sha256: 'test'
    }
  } as Subject
  it('should generate SPDX SBOM statement', async () => {
    const sbomPath = './data/spdx.json'
    const currentPath = path.join(__dirname, sbomPath)
    const result = await parseSBOMFromPath(currentPath)
    
    const sbomStatement = generateSBOMStatement(subject, result) as {
      [key: string]: any
    }
    // _type: 'https://in-toto.io/Statement/v0.1',
    // subject: [subject],
    // predicateType: 'https://spdx.dev/Document/v2.3',
    // predicate: sbom
    expect(sbomStatement?._type).toEqual('https://in-toto.io/Statement/v0.1')
    expect(sbomStatement?.subject).toEqual([subject])
    expect(sbomStatement?.predicateType).toEqual(
      'https://spdx.dev/Document/v2.3'
    )
    expect(sbomStatement?.predicate).toEqual(result.object)
  })
  it('should generate CycloneDX SBOM statement', async () => {
    const sbomPath = './data/cyclonedx.json'
    const currentPath = path.join(__dirname, sbomPath)
    const result = await parseSBOMFromPath(currentPath)
    const sbomStatement = generateSBOMStatement(subject, result) as {
      [key: string]: any
    }

    expect(sbomStatement?._type).toEqual('https://in-toto.io/Statement/v0.1')
    expect(sbomStatement?.subject).toEqual([subject])
    expect(sbomStatement?.predicateType).toEqual(
      'https://cyclonedx.org/bom/v1.4'
    )
    expect(sbomStatement?.predicate).toEqual(result.object)
  })
it('should throw an error for unsupported SBOM format', () => {
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbom: any = {
        type: 'unsupported',
        object: {} // replace with actual object
    };

    expect(() => generateSBOMStatement(subject, sbom)).toThrow('Unsupported SBOM format');
});
})

});