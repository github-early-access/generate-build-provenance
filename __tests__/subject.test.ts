import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { subjectFromInputs } from '../src/subject'

describe('subjectFromInputs', () => {
  afterEach(() => {
    process.env['INPUT_SUBJECT-PATH'] = ''
    process.env['INPUT_SUBJECT-DIGEST'] = ''
    process.env['INPUT_SUBJECT-NAME'] = ''
  })

  describe('when no inputs are provided', () => {
    it('throws an error', async () => {
      await expect(subjectFromInputs()).rejects.toThrow(
        /one of subject-path or subject-digest must be provided/i
      )
    })
  })

  describe('when both subject path and subject digest are provided', () => {
    beforeEach(() => {
      process.env['INPUT_SUBJECT-PATH'] = 'path/to/subject'
      process.env['INPUT_SUBJECT-DIGEST'] = 'digest'
    })

    it('throws an error', async () => {
      await expect(subjectFromInputs()).rejects.toThrow(
        /only one of subject-path or subject-digest may be provided/i
      )
    })
  })

  describe('when subject digest is provided but not the name', () => {
    beforeEach(() => {
      process.env['INPUT_SUBJECT-DIGEST'] = 'digest'
    })

    it('throws an error', async () => {
      await expect(subjectFromInputs()).rejects.toThrow(
        /subject-name must be provided when using subject-digest/i
      )
    })
  })

  describe('when specifying a subject digest', () => {
    const name = 'subject'

    describe('when the digest is malformed', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = 'digest'
        process.env['INPUT_SUBJECT-NAME'] = 'subject'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /subject-digest must be in the format <algorithm>:<digest>/i
        )
      })
    })

    describe('when the alogrithm is not supported', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = 'md5:deadbeef'
        process.env['INPUT_SUBJECT-NAME'] = 'subject'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /subject-digest must be prefixed with a supported algorithm/i
        )
      })
    })

    describe('when the sha1 digest is malformed', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] =
          'sha1:babca52ab0c93ae16539e5923cb0d7403b9a0!!!'
        process.env['INPUT_SUBJECT-NAME'] = 'subject'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /digest must be a 40 character hex string/i
        )
      })
    })

    describe('when the sha256 digest is malformed', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = 'sha256:deadbeef'
        process.env['INPUT_SUBJECT-NAME'] = 'subject'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /digest must be a 64 character hex string/i
        )
      })
    })

    describe('when the sha512 digest is malformed', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = 'sha512:deadbeef'
        process.env['INPUT_SUBJECT-NAME'] = 'subject'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /digest must be a 128 character hex string/i
        )
      })
    })

    describe('when the sha1 digest is valid', () => {
      const alg = 'sha1'
      const digest = 'babca52ab0c93ae16539e5923cb0d7403b9a093b'

      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = `${alg}:${digest}`
        process.env['INPUT_SUBJECT-NAME'] = name
      })

      it('returns the subject', async () => {
        const subject = await subjectFromInputs()

        expect(subject).toBeDefined()
        expect(subject.name).toEqual(name)
        expect(subject.digest).toEqual({ [alg]: digest })
      })
    })

    describe('when the sha256 digest is valid', () => {
      const alg = 'sha256'
      const digest =
        '7d070f6b64d9bcc530fe99cc21eaaa4b3c364e0b2d367d7735671fa202a03b32'

      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = `${alg}:${digest}`
        process.env['INPUT_SUBJECT-NAME'] = name
      })

      it('returns the subject', async () => {
        const subject = await subjectFromInputs()

        expect(subject).toBeDefined()
        expect(subject.name).toEqual(name)
        expect(subject.digest).toEqual({ [alg]: digest })
      })
    })

    describe('when the sha512 digest is valid', () => {
      const alg = 'sha512'
      const digest =
        'd93532824d2f6a0ca4c7df76f212b026f128f1cf161e4d018b2785adefef5a2e5a9ced6042f4373c770eda7314461ce9d497f9d978bc63745d9bad6d21992b53'

      beforeEach(() => {
        process.env['INPUT_SUBJECT-DIGEST'] = `${alg}:${digest}`
        process.env['INPUT_SUBJECT-NAME'] = name
      })

      it('returns the subject', async () => {
        const subject = await subjectFromInputs()

        expect(subject).toBeDefined()
        expect(subject.name).toEqual(name)
        expect(subject.digest).toEqual({ [alg]: digest })
      })
    })
  })

  describe('when specifying a subject path', () => {
    describe('when the file does NOT exist', () => {
      beforeEach(() => {
        process.env['INPUT_SUBJECT-PATH'] = '/f/a/k/e'
      })

      it('throws an error', async () => {
        await expect(subjectFromInputs()).rejects.toThrow(
          /could not find subject at path/i
        )
      })
    })
  })

  describe('when the file eixts', () => {
    let dir = ''
    const filename = 'subject'
    const content = 'file content'

    const expectedDigest = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')

    beforeEach(async () => {
      // Set-up temp directory
      const tmpDir = await fs.realpath(os.tmpdir())
      dir = await fs.mkdtemp(tmpDir + path.sep)

      // Write file to temp directory
      const filePath = path.join(dir, filename)
      await fs.writeFile(filePath, content)

      // Use file path as input
      process.env['INPUT_SUBJECT-PATH'] = filePath
    })

    afterEach(async () => {
      // Clean-up temp directory
      await fs.rm(dir, { recursive: true })
    })

    describe('when no name is provided', () => {
      it('returns the subject', async () => {
        const subject = await subjectFromInputs()

        expect(subject).toBeDefined()
        expect(subject.name).toEqual(filename)
        expect(subject.digest).toEqual({ sha256: expectedDigest })
      })
    })

    describe('when a name is provided', () => {
      const name = 'mysubject'

      beforeEach(() => {
        process.env['INPUT_SUBJECT-NAME'] = name
      })

      it('returns the subject', async () => {
        const subject = await subjectFromInputs()

        expect(subject).toBeDefined()
        expect(subject.name).toEqual(name)
        expect(subject.digest).toEqual({ sha256: expectedDigest })
      })
    })
  })
})
