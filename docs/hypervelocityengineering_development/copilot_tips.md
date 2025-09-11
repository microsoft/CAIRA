# Copilot Tips

This document focuses on **CAIRA-specific** findings and validated tactics for using GitHub Copilot, particularly for Terraform and infrastructure-as-code development. These are practical tips discovered through hands-on testing in our environment.

Using [Copilot in Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot).

## General GitHub Copilot Resources

For comprehensive GitHub Copilot documentation and general best practices, refer to:

- [Official GitHub Copilot Documentation](https://docs.github.com/en/copilot)
- [Getting started with GitHub Copilot](https://docs.github.com/en/copilot/getting-started-with-github-copilot)
- [Configuring GitHub Copilot in your environment](https://docs.github.com/en/copilot/configuring-github-copilot)
- [Prompt engineering for GitHub Copilot](https://docs.github.com/en/copilot/using-github-copilot/prompt-engineering-for-github-copilot)
- [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/copilot/overview)

## CAIRA-Specific Findings

The following findings are based on practical testing within our Terraform/IaC workflows:

| Action                                                       | Outcome                                                                                                                                                  | Conclusion                                                                                                                                        |
|--------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| Ask Mode versus Edit Mode versus Agent Mode                  | The mode determines whether or not copilot will make edits to the files. Agent mode is the most commonly used mode.                                      | Using `Ask Mode` ensures that the files will not be edited by copilot. Agent mode provides interactive assistance with file editing capabilities. |
| Toggle between Ask and Edit mode                             | Copilot wipes the history.                                                                                                                               | To use the same prompt in another mode, make sure to copy it manually.                                                                            |
| Context: default                                             | Copilot will use whatever file you have open at the time.                                                                                                | This is useful when isolated and editing existing code.                                                                                           |
| Context: none                                                | You can still tell copilot which files to look at.                                                                                                       | This is useful when needing to create new files based on lots of file input.                                                                      |
| Context: manually added                                      | Copilot uses the files and folders you've told it to.                                                                                                    | This is useful when you know what you want Copilot to do exactly and want to steer it in a specific direction.                                    |
| Not telling it where to add a resource.                      | Without telling Copilot where you want the generated code to go, it seems to default to the root of the repo or even outside of the repo file structure. | Be specific for where new code should go.                                                                                                         |
| Using existing `main.tf` versus asking it to make a new one. | When editing an existing file, copilot makes minor adjustments, but when making new files, it will also bring in other potentially unneeded code.        | Be deliberate when choosing whether to ask Copilot to add or modify.                                                                              |
| Base the structure on the an existing folder                 | Copilot did not include unneeded files and subfolders.                                                                                                   | Recommend asking copilot to base structures off examples.                                                                                         |
| Send error message to Copilot                                | Copilot can resolve errors successfully.                                                                                                                 | Ask Copilot to fix errors when needed, and ensure to review how they were resolved.                                                               |
| Include validation commands in prompts                       | Copilot generates code that may have syntax errors or use non-existent functions.                                                                        | Always include "ensure terraform validate passes" or similar validation requirements in prompts.                                                  |
| Specify exact provider versions                              | Copilot may generate code for newer provider features than what's installed.                                                                             | Include specific provider version constraints in your prompt (e.g., "azurerm provider version 3.0").                                              |
| Request plain text in variable descriptions                  | Copilot may try to use variable interpolation in description fields where it's not allowed.                                                              | Explicitly state "use plain text descriptions without variable references" when generating variables.                                             |
| Verify Terraform function availability                       | Copilot suggested `regexreplace` which doesn't exist in Terraform.                                                                                       | Cross-check generated function calls against Terraform documentation, especially for string manipulation.                                         |
| Handle edge cases explicitly                                 | Initial code didn't handle empty string scenarios in derived values.                                                                                     | Include "handle null and empty string cases" in prompts for robust code generation.                                                               |
| Use iterative prompts for complex resources                  | Single prompts for complex configurations often need multiple fixes.                                                                                     | Start with basic resource creation, then add features incrementally through separate prompts.                                                     |
| Reference existing patterns in the codebase                  | Copilot follows patterns better when given explicit examples.                                                                                            | Include "use the structure of [existing_folder] as an example" for consistency.                                                                   |
| Provide complete file structure requirements                 | Copilot creates better organized code when structure is specified.                                                                                       | List all expected files (main.tf, variables.tf, outputs.tf, README.md) in your initial prompt.                                                    |
| Include error context with full error messages               | Copilot fixes are more accurate with complete error information.                                                                                         | Paste the entire error output, not just the error line, for better resolution.                                                                    |

## Terraform-Specific Conclusions

These conclusions are drawn from our testing with Terraform and infrastructure-as-code workflows:

- Determining the context to use is crucial to ensure the effect of your prompt leads to what you intend.
- Be specific with the types of edits you want, and where.
- Take time to simplify code after each round to ensure unneeded things aren't also included.
- Always validate generated code immediately - budget time for iterative fixes as initial generation often requires refinement.
- Reference existing patterns and structures in your prompts to maintain consistency across your codebase.
- Be explicit about technical constraints such as provider versions, available functions, and syntax limitations to reduce iteration cycles.
- Start simple and iterate - complex infrastructure is better built incrementally than in a single generation attempt.
