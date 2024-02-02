import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  fromBasicAuth,
  getRegistryCredentials,
  toBasicAuth
} from '../../src/oci/credentials'

describe('getRegistryCredentials', () => {
  const registryName = 'my-registry'
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

  describe('when there is no credentials file', () => {
    it('throws an error', () => {
      expect(() => getRegistryCredentials(registryName)).toThrow(
        /no credential file found/i
      )
    })
  })

  describe('when the creds file is malformed', () => {
    const dockerConfig = {}

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )
    })

    it('throws an error', () => {
      expect(() => getRegistryCredentials(registryName)).toThrow(
        /no credentials found for/i
      )
    })
  })

  describe('when there are no creds for the registry', () => {
    const dockerConfig = {
      auths: {}
    }

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )
    })

    it('throws an error', () => {
      expect(() => getRegistryCredentials(registryName)).toThrow(
        /no credentials found for/i
      )
    })
  })

  describe('when credentials exist for the registry', () => {
    const username = 'username'
    const password = 'password'
    const dockerConfig = {
      auths: {
        [registryName]: {
          auth: Buffer.from(`${username}:${password}`).toString('base64')
        }
      }
    }

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )
    })

    it('returns the credentials', () => {
      const creds = getRegistryCredentials(registryName)

      expect(creds).toEqual({ username, password })
    })
  })

  describe('when credentials specify an identity token', () => {
    const username = 'username'
    const password = 'password'
    const token = 'identitytoken'
    const dockerConfig = {
      auths: {
        [registryName]: {
          auth: Buffer.from(`${username}:${password}`).toString('base64'),
          identitytoken: token
        }
      }
    }

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )
    })

    it('returns the credentials', () => {
      const creds = getRegistryCredentials(registryName)

      expect(creds).toEqual({ username, password: token })
    })
  })

  describe('when credentials exist for the registry (partial match)', () => {
    const username = 'username'
    const password = 'password'
    const dockerConfig = {
      auths: {
        [`https://${registryName}/v1`]: {
          auth: Buffer.from(`${username}:${password}`).toString('base64')
        }
      }
    }

    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, '.docker', 'config.json'),
        JSON.stringify(dockerConfig),
        {}
      )
    })

    it('returns the credentials', () => {
      const creds = getRegistryCredentials(registryName)

      expect(creds).toEqual({ username, password })
    })
  })
})

describe('toBasicAuth', () => {
  const creds = { username: 'user', password: 'pass' }
  const expected = 'dXNlcjpwYXNz'

  it('encodes credentials as base64-encoded basicauth value', () => {
    const result = toBasicAuth(creds)
    expect(result).toEqual(expected)
  })
})

describe('fromBasicAuth', () => {
  const auth = 'dXNlcjpwYXNz'
  const expected = { username: 'user', password: 'pass' }

  it('decodes base64-encoded basicauth value', () => {
    const result = fromBasicAuth(auth)
    expect(result).toEqual(expected)
  })
})
