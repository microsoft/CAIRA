// @ts-check

/** @param {import('@actions/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
export default async ({ core }) => {
  try {
    const changes = core.getInput('CHANGES', { required: true })
    const projectSrc = core.getInput('PROJECT_SRC') || ''

    // Split changes by comma and clean up each item
    const items = changes
      .split(',')
      .map((item) => item.trim())
      .map((item) => item.replace(/^["']|["']$/g, '')) // Remove surrounding quotes (single or double)
      .filter((item) => item.length > 0)

    if (items.length !== 1) {
      throw new Error(`Expected exactly one item in changes input, but found ${items.length}`)
    }

    const item = items[0]

    const itemParts = item.split('/')
    if (itemParts.length < 2) {
      throw new Error(`Invalid item format: ${item}`)
    }

    let tag = itemParts.slice(1).join('/').replace(/\.md$/, '')
    tag = projectSrc ? `${projectSrc}/` + tag : tag

    core.info(`Tag: ${tag}`)
    core.info(`Changelog item: ${item}`)

    core.setOutput('release_tag', tag)
    core.setOutput('changelog_file', item)
  } catch (error) {
    core.setFailed(error.message)
  }
}
