import * as github from '@actions/github'
import fetch from 'make-fetch-happen'

const CREATE_ATTESTATION_REQUEST = 'POST /repos/{owner}/{repo}/attestations'

export const writeAttestation = async (
  attestation: unknown,
  token: string
): Promise<void> => {
  const octokit = github.getOctokit(token, { request: { fetch } })

  try {
    await octokit.request(CREATE_ATTESTATION_REQUEST, {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      data: { bundle: attestation }
    })
  } catch (err) {
    /* istanbul ignore next */
    const message = err instanceof Error ? err.message : err
    throw new Error(`Failed to persist attestation: ${message}`)
  }
}
