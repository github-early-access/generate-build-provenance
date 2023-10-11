import {
  Bundle,
  BundleBuilder,
  CIContextProvider,
  DSSEBundleBuilder,
  FulcioSigner,
  RekorWitness,
  TSAWitness,
  Witness
} from '@sigstore/sign'
import {
  FULCIO_INTERNAL_URL,
  FULCIO_PUBLIC_GOOD_URL,
  REKOR_PUBLIC_GOOD_URL,
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

type Visibility = 'public' | 'private'

const SIGSTORE_PUBLIC_GOOD_OPTS: SignOptions = {
  fulcioURL: FULCIO_PUBLIC_GOOD_URL,
  rekorURL: REKOR_PUBLIC_GOOD_URL
}

const SIGSTORE_INTERNAL_OPTS: SignOptions = {
  fulcioURL: FULCIO_INTERNAL_URL,
  tsaServerURL: TSA_INTERNAL_URL
}

// Signs the provided provenance with Sigstore. The visibility argument
// determines which Sigstore instance is used to sign the provenance.
export const signProvenance = async (
  provenance: object,
  visibility: Visibility
): Promise<Bundle> => {
  const opts =
    visibility === 'public' ? SIGSTORE_PUBLIC_GOOD_OPTS : SIGSTORE_INTERNAL_OPTS

  const bundler = initBundleBuilder(opts)

  const artifact = {
    data: Buffer.from(JSON.stringify(provenance)),
    type: INTOTO_PAYLOAD_TYPE
  }
  return bundler.create(artifact)
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
