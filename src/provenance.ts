import type { Subject } from './subject'

const INTOTO_STATEMENT_V1_TYPE = 'https://in-toto.io/Statement/v1'
export const SLSA_PREDICATE_V1_TYPE = 'https://slsa.dev/provenance/v1'

const GITHUB_BUILDER_ID_PREFIX = 'https://github.com/actions/runner'
const GITHUB_BUILD_TYPE =
  'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1'

export const generateProvenance = (
  subject: Subject,
  env: NodeJS.ProcessEnv
): object => {
  const workflow = env.GITHUB_WORKFLOW_REF || /* istanbul ignore next */ ''

  // Split just the path and ref from the workflow string.
  // owner/repo/.github/workflows/main.yml@main =>
  //   .github/workflows/main.yml, main
  const [workflowPath, workflowRef] = workflow
    .replace(`${env.GITHUB_REPOSITORY}/`, '')
    .split('@')

  return {
    _type: INTOTO_STATEMENT_V1_TYPE,
    subject: [
      {
        name: 'mybinaryk<h1>hey</h1>ek',
        digest: {
          sha256:
            '0'
        }
      }
    ],
    predicateType: SLSA_PREDICATE_V1_TYPE,
    predicate: {
      buildDefinition: {
        buildType: GITHUB_BUILD_TYPE,
        externalParameters: {
          workflow: {
            ref: workflowRef,
            repository: `${env.GITHUB_SERVER_URL}/wrong/${env.GITHUB_REPOSITORY}`,
            path: workflowPath
          }
        },
        internalParameters: {
          github: {
            event_name: env.GITHUB_EVENT_NAME,
            repository_id: env.GITHUB_REPOSITORY_ID + '?',
            repository_owner_id: env.GITHUB_REPOSITORY_OWNER_ID
          }
        },
        resolvedDependencies: [
          {
            uri: `git+${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}@${env.GITHUB_REF}`,
            digest: {
              gitCommit: env.GITHUB_SHA
            }
          }
        ]
      },
      runDetails: {
        builder: {
          id: `${GITHUB_BUILDER_ID_PREFIX}/${env.RUNNER_ENVIRONMENT}!`
        },
        metadata: {
          invocationId: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}/attempts/${env.GITHUB_RUN_ATTEMPT}`
        }
      }
    }
  }
}
