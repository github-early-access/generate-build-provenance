import { bundleToJSON } from '@sigstore/bundle'
import {
  BundleBuilder,
  CIContextProvider,
  DSSEBundleBuilder,
  FulcioSigner,
  RekorWitness,
  TSAWitness,
  Witness
} from '@sigstore/sign'
import assert from 'assert'
import { X509Certificate } from 'node:crypto'
import {
  FULCIO_INTERNAL_URL,
  FULCIO_PUBLIC_GOOD_URL,
  REKOR_PUBLIC_GOOD_URL,
  SEARCH_PUBLIC_GOOD_URL,
  TSA_INTERNAL_URL
} from './endpoints'

const INTOTO_PAYLOAD_TYPE = 'application/vnd.in-toto+json'

const OIDC_AUDIENCE = 'sigstore'
const DEFAULT_TIMEOUT = 10000
const DEFAULT_RETRIES = 3

type SignOptions = {
  fulcioURL: string
  rekorURL?: string
  tsaServerURL?: string
}

export type Visibility = 'public' | 'private'

export type Attestation = {
  bundle: unknown
  certificate: string
  tlogURL?: string
}

const SIGSTORE_PUBLIC_GOOD_OPTS: SignOptions = {
  fulcioURL: FULCIO_PUBLIC_GOOD_URL,
  rekorURL: REKOR_PUBLIC_GOOD_URL
}

const SIGSTORE_INTERNAL_OPTS: SignOptions = {
  fulcioURL: FULCIO_INTERNAL_URL,
  tsaServerURL: TSA_INTERNAL_URL
}

// Signs the provided intoto statement with Sigstore. The visibility argument
// determines which Sigstore instance is used to sign the provenance.
export const signStatement = async (
  statement: unknown,
  visibility: Visibility
): Promise<Attestation> => {
  const opts =
    visibility === 'public' ? SIGSTORE_PUBLIC_GOOD_OPTS : SIGSTORE_INTERNAL_OPTS

  const artifact = {
    data: Buffer.from(JSON.stringify(statement)),
    type: INTOTO_PAYLOAD_TYPE
  }

  // Sign the statement and build the bundle
  const bundle = await initBundleBuilder(opts).create(artifact)

  // Determine if we can provide a link to the transparency log
  let tlogURL: string | undefined
  const tlogEntries = bundle.verificationMaterial.tlogEntries
  if (visibility === 'public' && tlogEntries.length > 0) {
    tlogURL = `${SEARCH_PUBLIC_GOOD_URL}?logIndex=${tlogEntries[0].logIndex}`
  }

  // Extract the signing certificate from the bundle
  assert(
    bundle.verificationMaterial.content.$case === 'x509CertificateChain',
    'Bundle must contain an x509 certificate chain'
  )
  const signingCert = new X509Certificate(
    bundle.verificationMaterial.content.x509CertificateChain.certificates[0].rawBytes
  )

  return {
    bundle: bundleToJSON(bundle),
    certificate: signingCert.toString(),
    tlogURL
  }
}

// Assembles the Sigstore bundle builder with the appropriate options
const initBundleBuilder = (opts: SignOptions): BundleBuilder => {
  const witnesses: Witness[] = []

  const signer = new FulcioSigner({
    identityProvider: new CIContextProvider(OIDC_AUDIENCE),
    fulcioBaseURL: opts.fulcioURL,
    timeout: DEFAULT_TIMEOUT,
    retry: DEFAULT_RETRIES
  })

  if (opts.rekorURL) {
    witnesses.push(
      new RekorWitness({
        rekorBaseURL: opts.rekorURL,
        entryType: 'dsse',
        timeout: DEFAULT_TIMEOUT,
        retry: DEFAULT_RETRIES
      })
    )
  }

  if (opts.tsaServerURL) {
    witnesses.push(
      new TSAWitness({
        tsaBaseURL: opts.tsaServerURL,
        timeout: DEFAULT_TIMEOUT,
        retry: DEFAULT_RETRIES
      })
    )
  }

  return new DSSEBundleBuilder({ signer, witnesses })
}
