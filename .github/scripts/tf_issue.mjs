// ---------------------------------------------------------------------
// Copyright (c) Microsoft Corporation. Licensed under the MIT license.
// ---------------------------------------------------------------------

// @ts-check

import path from 'path';
import fs from 'fs';

/** @param {import('@actions/github-script').AsyncFunctionArguments} AsyncFunctionArguments */
export default async ({ context, github, core }) => {
  try {
    // Helper function to read, escape, and truncate file content
    const readAndProcessFile = (workDir, fileName, maxLength = 20000) => {
      try {
        const filePath = core.toPlatformPath(path.join(workDir, fileName));
        let content = '';

        if (fs.existsSync(filePath)) {
          content = fs.readFileSync(filePath, 'utf8');
        }

        const escapedContent = content.replace(/\\/g, '\\\\').replace(/`/g, '\\`'); // Escape backslashes and backticks
        const truncatedContent =
          escapedContent.length > maxLength ? escapedContent.substring(0, maxLength) + ' ...' : escapedContent;

        const truncatedMessage =
          escapedContent.length > maxLength
            ? `Output is too long and was truncated. You can read full output in the [${context.runId}](${runUrl}) workflow run.`
            : '';

        return {
          content: escapedContent,
          truncatedContent: truncatedContent,
          truncatedMessage,
          originalLength: escapedContent.length
        };
      } catch (error) {
        core.warning(`Failed to read file ${fileName}: ${error.message}`);
        return {
          content: '',
          truncatedContent: 'File could not be read',
          truncatedMessage: `Error reading ${fileName}: ${error.message}`,
          originalLength: 0
        };
      }
    };

    // flags
    const flagCreateIssueOnFailedTest = process.env.FLAG_CREATE_ISSUE_ON_FAILED_TEST === 'true';
    core.info(`Flag - Create Issue On Failed Test: ${flagCreateIssueOnFailedTest}`);

    // Inputs
    const workDir = core.getInput('WORKDIR', { required: true });
    const tfVersionVersion = core.getInput('TFVERSION_VERSION', { required: true });
    const tfVersionPlatform = core.getInput('TFVERSION_PLATFORM') || `${process.platform}_${process.arch}`;
    const tfFmtOutcome = core.getInput('TFFMT_OUTCOME') || 'unknown';
    const tfInitOutcome = core.getInput('TFINIT_OUTCOME') || 'unknown';
    const tfValidateOutcome = core.getInput('TFVALIDATE_OUTCOME') || 'unknown';
    const tfValidateStdoutFile = core.getInput('TFVALIDATE_STDOUT_FILE') || 'tfvalidate_stdout.out';
    const tfValidateStderrFile = core.getInput('TFVALIDATE_STDERR_FILE') || 'tfvalidate_stderr.out';
    const tfPlanOutcome = core.getInput('TFPLAN_OUTCOME') || 'unknown';
    const tfPlanExitCode = core.getInput('TFPLAN_EXITCODE') || 'unknown';
    const tfPlanStdoutFile = core.getInput('TFPLAN_STDOUT_FILE') || 'tfplan_stdout.out';
    const tfPlanStderrFile = core.getInput('TFPLAN_STDERR_FILE') || 'tfplan_stderr.out';
    const tfPlanFile = core.getInput('TFPLAN_FILE') || 'tfplan.txt';
    const tfTestOutcome = core.getInput('TFTEST_OUTCOME') || 'unknown';
    const tfTestExitCode = core.getInput('TFTEST_EXITCODE') || 'unknown';
    const tfTestStdoutFile = core.getInput('TFTEST_STDOUT_FILE') || 'tftest_stdout.out';
    const tfTestStderrFile = core.getInput('TFTEST_STDERR_FILE') || 'tftest_stderr.out';
    const owner =
      context.eventName === 'pull_request' || context.eventName === 'pull_request_target'
        ? context.actor
        : core.getInput('OWNER');

    // Variables
    const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
    const checkTestResult =
      tfPlanExitCode === '1' || tfTestExitCode === '1'
        ? `An error occurred during the tests for \`${workDir}\` ❌`
        : `All tests passed successfully for \`${workDir}\` ✅`;

    // Process all file outputs using the helper function
    const tfValidateStdoutResult = readAndProcessFile(workDir, tfValidateStdoutFile);
    const tfValidateStderrResult = readAndProcessFile(workDir, tfValidateStderrFile);
    const tfPlanResult = readAndProcessFile(workDir, tfPlanFile);
    const tfPlanStdoutResult = readAndProcessFile(workDir, tfPlanStdoutFile);
    const tfPlanStderrResult = readAndProcessFile(workDir, tfPlanStderrFile);
    const tfTestStdoutResult = readAndProcessFile(workDir, tfTestStdoutFile);
    const tfTestStderrResult = readAndProcessFile(workDir, tfTestStderrFile);

    // Content generation
    const testBody = `
#### 🩺 Terraform Test Exit Code: \`${tfTestExitCode}\`

<details><summary>Show Error</summary>

\`\`\`text
${tfTestStderrResult.truncatedContent}
\`\`\`

</details>

${tfTestStderrResult.truncatedMessage}

#### 🧪 Terraform Test: \`${tfTestOutcome} ${tfTestOutcome === 'success' ? '✅' : '🛑'}\`

<details><summary>Show Output</summary>

\`\`\`text
${tfTestStdoutResult.truncatedContent}
\`\`\`

</details>

${tfTestStdoutResult.truncatedMessage}
`;

    const issueHeader = `
> [!NOTE]
> This issue was automatically created by the GitHub Actions workflow.

`;

    const issueBody = `
${checkTestResult}

**Workflow Run:** [${context.runId}](${runUrl})

#### 🔢 Terraform Version and Platform: \`${tfVersionVersion}/${tfVersionPlatform}\`

#### 🖌 Terraform Format and Style: \`${tfFmtOutcome} ${tfFmtOutcome === 'success' ? '✅' : '🛑'}\`

#### ⚙️ Terraform Initialization: \`${tfInitOutcome} ${tfInitOutcome === 'success' ? '✅' : '🛑'}\`

#### 🤖 Terraform Validation: \`${tfValidateOutcome} ${tfValidateOutcome === 'success' ? '✅' : '🛑'}\`

<details><summary>Show Output</summary>

\`\`\`text
${tfValidateStdoutResult.truncatedContent}
\`\`\`

</details>

${tfValidateStdoutResult.truncatedMessage}

<details><summary>Show Error</summary>

\`\`\`text
${tfValidateStderrResult.truncatedContent}
\`\`\`

</details>

${tfValidateStderrResult.truncatedMessage}

#### 🩺 Terraform Plan Exit Code: \`${tfPlanExitCode}\`

<details><summary>Show Output</summary>

\`\`\`text
${tfPlanStdoutResult.truncatedContent}
\`\`\`

</details>

${tfPlanStdoutResult.truncatedMessage}

<details><summary>Show Error</summary>

\`\`\`text
${tfPlanStderrResult.truncatedContent}
\`\`\`

</details>

${tfPlanStderrResult.truncatedMessage}

#### 📖 Terraform Plan: \`${tfPlanOutcome} ${tfPlanOutcome === 'success' ? '✅' : '🛑'}\`

<details><summary>Show Output</summary>

\`\`\`text
${tfPlanResult.truncatedContent}
\`\`\`

</details>

${tfPlanResult.truncatedMessage}

${tfTestExitCode !== 'unknown' ? testBody : ''}

*Pusher: @${owner}, Action: \`${context.eventName}\`, Working Directory: \`${workDir}\`, Workflow: \`${
      context.workflow
    }\`*
`;

    // Handle different event types
    if (context.eventName === 'schedule') {
      if (flagCreateIssueOnFailedTest) {
        await github.rest.issues.create({
          ...context.repo,
          title: `[bug] E2E Terraform Test Failure in \`${workDir}\``,
          body: issueHeader + issueBody,
          labels: ['type/bug']
        });
      } else {
        core.info('Skipping issue creation for scheduled event as the flag is set to false.');
      }
    } else if (context.eventName === 'pull_request' || context.eventName === 'pull_request_target') {
      const { data: comments } = await github.rest.issues.listComments({
        ...context.repo,
        issue_number: context.issue.number
      });

      const botComment = comments.find((comment) => {
        return comment.user.type === 'Bot' && comment.body.includes(workDir);
      });

      if (botComment) {
        await github.rest.issues.updateComment({
          ...context.repo,
          comment_id: botComment.id,
          body: issueBody
        });
      } else {
        await github.rest.issues.createComment({
          ...context.repo,
          issue_number: context.issue.number,
          body: issueBody
        });
      }
    }

    // Output logs to console
    await core.group('📖 Plan Output', async () => {
      core.info(tfPlanResult.content);
    });

    await core.group('📖 Plan Error', async () => {
      core.info(tfPlanStderrResult.content);
    });

    if (tfTestExitCode !== 'unknown') {
      await core.group('🧪 Test Output', async () => {
        core.info(tfTestStdoutResult.content);
      });

      await core.group('🧪 Test Error', async () => {
        core.info(tfTestStderrResult.content);
      });
    }

    // Set failure status
    if (tfPlanExitCode === '1') {
      core.setFailed('Terraform Plan failed');
    }

    if (tfTestExitCode === '1') {
      core.setFailed('Terraform Test failed');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
};
