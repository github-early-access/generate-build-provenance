import * as core from '@actions/core'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const DIGEST_ALGORITHM = 'sha256'

export type Subject = {
  name: string
  digest: Record<string, string>
}

// Returns the subject specified by the action's inputs. The subject may be
// specified as a path to a file or as a digest. If a path is provided, the
// file's digest is calculated and returned along with the subject's name. If a
// digest is provided, the name must also be provided.
export const subjectFromInputs = async (): Promise<Subject> => {
  const subjectPath = core.getInput('subject-path', { required: false })
  const subjectDigest = core.getInput('subject-digest', { required: false })
  const subjectName = core.getInput('subject-name', { required: false })

  if (!subjectPath && !subjectDigest) {
    throw new Error('One of subject-path or subject-digest must be provided')
  }

  if (subjectPath && subjectDigest) {
    throw new Error(
      'Only one of subject-path or subject-digest may be provided'
    )
  }

  if (subjectDigest && !subjectName) {
    throw new Error('subject-name must be provided when using subject-digest')
  }

  if (subjectPath) {
    return getSubjectFromPath(subjectPath, subjectName)
  } else {
    return getSubjectFromDigest(subjectDigest, subjectName)
  }
}

// Returns the subject specified by the path to a file. The file's digest is
// calculated and returned along with the subject's name.
const getSubjectFromPath = async (
  subjectPath: string,
  subjectName?: string
): Promise<Subject> => {
  if (!fs.existsSync(subjectPath)) {
    throw new Error(`Could not find subject at path ${subjectPath}`)
  }
  const name = subjectName || path.parse(subjectPath).base
  const digest = await digestFile(DIGEST_ALGORITHM, subjectPath)

  return {
    name,
    digest: { [DIGEST_ALGORITHM]: digest }
  }
}

// Returns the subject specified by the digest of a file. The digest is returned
// along with the subject's name.
const getSubjectFromDigest = (
  subjectDigest: string,
  subjectName: string
): Subject => {
  if (!subjectDigest.match(/^sha256:[A-Za-z0-9]{64}$/)) {
    throw new Error(
      'subject-digest must be in the format "sha256:<hex-digest>"'
    )
  }
  const [alg, digest] = subjectDigest.split(':')

  return {
    name: subjectName,
    digest: { [alg]: digest }
  }
}

// Calculates the digest of a file using the specified algorithm. The file is
// streamed into the digest function to avoid loading the entire file into
// memory. The returned digest is a hex string.
const digestFile = async (
  algorithm: string,
  filePath: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm).setEncoding('hex')
    fs.createReadStream(filePath)
      .once('error', reject)
      .pipe(hash)
      .once('finish', () => resolve(hash.read()))
  })
}
