import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type Credentials = {
  readonly username: string
  readonly password: string
}

type DockerConifg = {
  auths?: { [registry: string]: { auth: string; identitytoken?: string } }
}

// Returns the credentials for a given registry by reading the Docker config
// file.
export const getRegistryCredentials = (registry: string): Credentials => {
  const dockerConfigFile = path.join(os.homedir(), '.docker', 'config.json')

  let content: string | undefined
  try {
    content = fs.readFileSync(dockerConfigFile, 'utf8')
  } catch (err) {
    throw new Error(`No credential file found at ${dockerConfigFile}`)
  }

  const dockerConfig: DockerConifg = JSON.parse(content)

  const credKey =
    Object.keys(dockerConfig?.auths || {}).find(key =>
      key.includes(registry)
    ) || registry
  const creds = dockerConfig?.auths?.[credKey]

  if (!creds) {
    throw new Error(`No credentials found for registry ${registry}`)
  }

  // Extract username/password from auth string
  const { username, password } = fromBasicAuth(creds.auth)

  // If the identitytoken is present, use it as the password (primarily for ACR)
  const pass = creds.identitytoken ? creds.identitytoken : password

  return { username, password: pass }
}

// Encode the username and password as base64-encoded basicauth value
export const toBasicAuth = (creds: Credentials): string =>
  Buffer.from(`${creds.username}:${creds.password}`).toString('base64')

// Decode the base64-encoded basicauth value
export const fromBasicAuth = (auth: string): Credentials => {
  // Need to account for the possibility of ':' in the password
  const [username, ...rest] = Buffer.from(auth, 'base64').toString().split(':')
  const password = rest.join(':')

  return { username, password }
}
