import { parseImageName } from '../../src/oci/name'

describe('parseImageName', () => {
  it('parses a fully-quallified image names', () => {
    let name = parseImageName('ghcr.io/owner/repo')
    expect(name.registry).toEqual('ghcr.io')
    expect(name.path).toEqual('owner/repo')

    name = parseImageName('ghcr.io/repo')
    expect(name.registry).toEqual('ghcr.io')
    expect(name.path).toEqual('repo')

    name = parseImageName('localhost:8080/repo')
    expect(name.registry).toEqual('localhost:8080')
    expect(name.path).toEqual('repo')

    name = parseImageName('a/b/c/d')
    expect(name.registry).toEqual('a')
    expect(name.path).toEqual('b/c/d')
  })

  it('raises an error when the image name is invalid', () => {
    expect(() => parseImageName('repo')).toThrow()
    expect(() => parseImageName('')).toThrow()
  })
})
