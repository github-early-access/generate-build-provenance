# generate-build-provenance

Given a subject (either a file path or name/digest pair), this action creates,
signs, and uploads a build provenance attestation using [Sigstore][1].

If the repository initiating the GitHub Actions workflow is public, the public
instance of Sigstore will be used to generate the attestation signature. If the
repository is private, it will use the GitHub private Sigstore instance.

## Usage

Within the GitHub Actions workflow which builds some artifact you would like to attest,

1. Ensure that the following permissions are set:

```yaml
permissions:
  id-token: write
  packages: write
```

1. After your artifact build step, add the following:

```yaml
- uses: github-early-access/generate-build-provenance@v1
  with:
    subject-path: "${{ github.workspace }}/PATH_TO_YOUR_FILE_HERE"
```

### Inputs

See [action.yml](action.yml)

```yaml
- uses: github-early-access/generate-build-provenance@v1
  with:
    # Path to the artifact for which provenance will be generated. Must specify
    # exactly one of "subject-path" or "subject-digest".
    subject-path: ''

    # Digest of the subject for which provenance will be generated. Must be in
    # the form "sha256:<hex-digest>". Must specify exactly one of
    # "subject-path" or "subject-digest".
    subject-digest: ''

    # Subject name as it should appear in the provenance statement. Required
    # when subject is identified by "subject-digest". When subject is
    # identified by "subject-path", the subject name will be inferred from
    # the path, but can be overridden by providing an explicit "subject-name"
    # value. When attesting container images, the name should be the
    # fully-qualified image name.
    subject-name: ''

    # Set this option if you want to push the signed attestation to
    # a container registry. Requires that "subject-name" specify the
    # fully-qualified image name.
    #
    # Default: false
    push-to-registry: false

    # Token used to make authenticated requests to the GitHub API. Used
    # to upload attestations.
    #
    # Default: ${{ github.token }}
    github-token: ''
```

## Sample Workflow

```yaml
name: build-artifact

on:
  workflow_dispatch:

jobs:
  build:
    permissions:
      id-token: write
      packages: write
      contents: read

    steps:
      - uses: actions/checkout@v3
      - uses: github-early-access/generate-build-provenance@v1
        with:
          subject_path: "${{ github.workspace }}/README" # or other file here
```

[1]: https://www.sigstore.dev/
