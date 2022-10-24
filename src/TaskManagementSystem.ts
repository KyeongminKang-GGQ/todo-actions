import { invariant, logger } from 'tkt'

import * as CodeRepository from './CodeRepository'

const log = logger('TaskManagementSystem')

type TaskInformation = {
  title: string
  body: string
}

export async function createTask(
  information: TaskInformation,
): Promise<string> {
  const graphql = require('@octokit/graphql').defaults({
    headers: {
      authorization: `token ${
        process.env.GITHUB_TOKEN ||
        invariant(false, 'Required GITHUB_TOKEN variable.')
      }`,
    },
  })

  let milestoneId: string | undefined

  if (process.env.MILESTONE) {
    milestoneId = await getMilestoneId(process.env.MILESTONE)
    log.info(
      `Milestone with the name "${process.env.MILESTONE}" is "${milestoneId}"`,
    )
  }

  const result = await graphql(
    `
      mutation CreateIssue($input: CreateIssueInput!) {
        createIssue(input: $input) {
          issue {
            number
          }
        }
      }
    `,
    {
      input: {
        repositoryId: CodeRepository.repoContext.repositoryNodeId,
        title: information.title,
        body: information.body,
        milestoneId: milestoneId,
      },
    },
  )
  log.debug('Create issue result:', result)

  return result.createIssue.issue.number
    ? `#${result.createIssue.issue.number}`
    : invariant(
        false,
        'Failed to get issue number out of createIssue API call.',
      )
}

export async function completeTask(taskReference: string): Promise<void> {
  const Octokit = (await import('@octokit/rest')).default
  const octokit = new Octokit({
    auth: `token ${
      process.env.GITHUB_TOKEN ||
      invariant(false, 'Required GITHUB_TOKEN variable.')
    }`,
  })
  const result = await octokit.issues.update({
    owner: CodeRepository.repoContext.repositoryOwner,
    repo: CodeRepository.repoContext.repositoryName,
    issue_number: +taskReference.substr(1),
    state: 'closed',
  })
  log.debug('Issue close result:', result.data)
}

const getMilestoneId = async (milestoneName: string): Promise<string> => {
  const Octokit = (await import('@octokit/rest')).default
  const octokit = new Octokit({
    auth: `token ${
      process.env.GITHUB_TOKEN ||
      invariant(false, 'Required GITHUB_TOKEN variable.')
    }`,
  })
  const response = await octokit.issues.listMilestonesForRepo({
    owner: CodeRepository.repoContext.repositoryOwner,
    repo: CodeRepository.repoContext.repositoryName,
  })

  log.debug(`listMilestones response:\n${JSON.stringify(response)}`)
  log.info(
    `Milestones available:\n${JSON.stringify(
      response.data.map((milestone: { title: any }) => milestone.title),
    )}`,
  )

  const milestone = response.data.find(
    (m: { title: string }) => m.title === milestoneName,
  )

  // Check if milestone exists
  if (milestone === undefined) {
    // throw new Error(`Milestone with the name "${milestoneName}" was not found.`);
    const response = await octokit.issues.createMilestone({
      owner: CodeRepository.repoContext.repositoryOwner,
      repo: CodeRepository.repoContext.repositoryName,
      title: milestoneName,
    })
    if (response === undefined) {
      throw new Error(
        `Create Milestone with the name "${milestoneName}" failed`,
      )
    }
    return response.data.node_id
  }

  const milestoneId = milestone.node_id
  if (milestoneId === undefined) {
    throw new Error(
      `Milestone with the name "${milestoneName}" node_id was not found.`,
    )
  }

  return milestoneId
}

export async function updateTask(
  taskReference: string,
  information: TaskInformation,
): Promise<void> {
  const Octokit = (await import('@octokit/rest')).default
  const octokit = new Octokit({
    auth: `token ${
      process.env.GITHUB_TOKEN ||
      invariant(false, 'Required GITHUB_TOKEN variable.')
    }`,
  })
  const result = await octokit.issues.update({
    owner: CodeRepository.repoContext.repositoryOwner,
    repo: CodeRepository.repoContext.repositoryName,
    issue_number: +taskReference.substr(1),
    title: information.title,
    body: information.body,
  })
  log.debug('Issue update result:', result.data)
}
