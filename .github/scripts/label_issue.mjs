// @ts-check

/** @param {import('@actions/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
export default async ({ context, github, core }) => {
  try {
    const configFile = core.getInput('CONFIG_FILE') || '.github/labels.yml'

    const issueBody = `
Hi @${context.actor}

A manual action has been performed on the label: \`${context.payload.label.name}\`.

Labels are managed centrally in the config file: \`${configFile}\` and any manual changes will be overwritten to match the configuration.

Please propose changes via PR to the config file instead of manually changing labels.
`
    await github.rest.issues.create({
      ...context.repo,
      title: `[bug] Manual action on label: \`${context.payload.label.name}\``,
      body: issueBody,
      assignees: [context.actor]
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}
