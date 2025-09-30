// This script handles fork PR approval logic for the Terraform Test workflow
//
// IMPORTANT: This script runs under different GitHub event contexts:
// 1. pull_request: context.payload.pull_request is available
// 2. issue_comment: context.payload.pull_request is NOT available (only context.payload.issue and context.payload.comment are available)
// 3. merge_group: context.payload.merge_group is available
// 4. schedule/workflow_dispatch: minimal context
//
// When modifying this script, always check context.eventName and handle missing fields appropriately!

function checkIsMaintainer(comment) {
  const isMaintainer = ['MEMBER', 'OWNER'].includes(comment.author_association);

  console.log(
    `Slash command from: ${comment.user.login} (${comment.author_association}) : ${isMaintainer ? '✅ Maintainer' : '❌ Not Maintainer'}`
  );

  return isMaintainer;
}

async function handlePullRequest({ context, github }) {
  const pr = context.payload.pull_request;
  const isFork = pr.head.repo.full_name !== pr.base.repo.full_name;

  console.log(
    `PR #${pr.number}: ${pr.head.repo.full_name} -> ${pr.base.repo.full_name} <---> Is fork: ${isFork}, SHA: ${pr.head.sha}`
  );

  if (!isFork) {
    console.log('Internal PR - running tests automatically');
    return true;
  }

  const comments = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: pr.number
  });

  const comment = comments.data.find((comment) => {
    const hasApprovalMarker = comment.body.includes(`APPROVAL_MARKER:${pr.head.sha}`);
    const isMaintainer = checkIsMaintainer(comment);
    return hasApprovalMarker && isMaintainer;
  });

  return comment != null;
}

async function handleIssueComment({ context, github }) {
  // IMPORTANT: When triggered by issue_comment, we only have:
  // - context.payload.issue (not context.payload.pull_request!)
  // - context.payload.comment
  // We must fetch PR data separately using the GitHub API

  if (!context.payload.issue.pull_request) return false;
  if (context.payload.comment.body.trim().toLowerCase() !== '/allow') return false;

  // Introduce a randomized delay to help avoid race conditions or API rate limit issues
  // when multiple jobs are triggered simultaneously in CI. The sleep duration is based on
  // the last two digits of GITHUB_RUN_ID to stagger concurrent runs.
  const sleepDuration = (parseInt(process.env.GITHUB_RUN_ID.slice(-2)) % 10) * 1000;
  await new Promise((resolve) => setTimeout(resolve, sleepDuration));

  /*
  Possible `author_association` values;
    "OWNER" – repository owner
    "MEMBER" – member of the org that owns the repo
    "COLLABORATOR" – user with write access to the repo
    "CONTRIBUTOR" – user who has contributed in the past
    "NONE" – random user, no relationship
  */
  const authorAssociation = context.payload.comment.author_association;
  const commenter = context.payload.comment.user.login;
  const isMaintainer = checkIsMaintainer(context.payload.comment);

  if (!isMaintainer) {
    const comments = await github.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.payload.issue.number
    });

    const rejectionMarker = '<!-- REJECTION_MARKER -->';
    const rejectionMessage = `@${commenter} - Sorry, only maintainers can approve tests on fork PRs. Required: MEMBER or OWNER. Current: ${authorAssociation}\n\n${rejectionMarker}`;
    const existingRejection = comments.data.find((comment) => comment.body.includes(rejectionMarker));
    if (!existingRejection) {
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.payload.issue.number,
        body: rejectionMessage
      });
    }
    return false;
  }

  const pr = await github.rest.pulls.get({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.issue.number // Note: using issue.number, not pull_request.number!
  });

  const isFork = pr.data.head.repo.full_name !== pr.data.base.repo.full_name;

  const date = new Date().toISOString();

  console.log(
    `PR #${pr.data.number}: ${pr.data.head.repo.full_name} -> ${pr.data.base.repo.full_name} <---> Is fork: ${isFork}, SHA: ${pr.data.head.sha}`
  );

  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.payload.issue.number,
    body: [
      '## ✅ Test Approved',
      '',
      `@${commenter} has approved running terraform tests for commit \`${pr.data.head.sha}\`.`,
      '',
      '**Approval Details:**',
      `- Commit SHA: \`${pr.data.head.sha}\``,
      `- Approved by: @${commenter}`,
      `- Approved at: ${date}`,
      '',
      '**Important:** If new commits are pushed, tests will need to be re-approved.',
      '',
      `<!-- APPROVAL_MARKER:${pr.data.head.sha} -->`
    ].join('\n')
  });

  console.log(`[fork-guard] APPROVAL_GRANTED sha=${pr.data.head.sha} by=${commenter} pr=${pr.data.number} at=${date}`);

  return true;
}

export default async function checkForkAndApproval({ context, github, core }) {
  let should_run = false;

  if (context.eventName === 'schedule' || context.eventName === 'workflow_dispatch') {
    should_run = true;
  }

  if (context.eventName === 'merge_group' || context.eventName === 'pull_request') {
    should_run = await handlePullRequest({ context, github, core });
  }

  if (context.eventName === 'issue_comment') {
    should_run = await handleIssueComment({ context, github, core });
  }

  core.setOutput('should_run', should_run.toString());
}
