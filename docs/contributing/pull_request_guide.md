<!-- META
title: Pull Request Guide
description: Instructions for creating, reviewing, and managing pull requests in CAIRA.
author: CAIRA Team
ms.date: 08/18/2025
ms.topic: guide
estimated_reading_time: 7
keywords:
  - pull request
  - review
  - contribution
  - workflow
  - github
  - branch management
  - validation
  - CAIRA
-->

# Pull Request Guide

This guide provides comprehensive instructions for creating, reviewing, and managing pull requests in the CAIRA project. Following these guidelines ensures a smooth review process and maintains code quality.

## Before Creating a Pull Request

### Prerequisites Checklist

- [ ] **Issue exists and is linked** - All PRs must reference an issue
- [ ] **Branch is properly named** - Follows our [naming conventions](development_workflow.md#branch-naming-conventions)
- [ ] **Development environment is set up** - See [Developer Guide](../developer.md)
- [ ] **Tests pass locally** - Run `task test` successfully
- [ ] **Code is linted** - Run `task lint` without errors

### Pre-PR Validation

```shell
# Ensure your branch is up to date
git fetch upstream
git rebase upstream/main

# Run the complete validation suite
task lint     # Linting checks
task test     # All tests
```

## Creating a Pull Request

### PR Title

Use the same format as [commit messages](development_workflow.md#commit-message-format):

```text
<type>[optional scope]: <description>
```

**Examples:**

```text
feat(azure-openai): add support for custom model deployments
fix(networking): resolve subnet CIDR overlap validation
docs(terraform): update module usage examples
refactor(storage): simplify encryption key management
test(integration): add comprehensive Azure OpenAI tests
```

### PR Description

Use our pull request template (automatically populated). Include:

#### Description

- **Clear summary** of what was changed
- **Why the change was needed** (link to issue)
- **How it was implemented** (high-level approach)

#### Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Test improvements

#### Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

#### Documentation

- [ ] Code is self-documenting with clear variable names
- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] Examples provided for new features

### Linking Issues

Always link your PR to the relevant issue using GitHub keywords:

```markdown
Closes #123
Fixes #456
Resolves #789
Related to #101
```

## Pull Request Checklist

### Code Quality

- [ ] **Code follows project style guidelines**
  - Terraform: Properly formatted with `terraform fmt`
  - Markdown: Consistent formatting and structure

- [ ] **Code is well-documented**
  - Clear variable descriptions in Terraform
  - Inline comments for complex logic

- [ ] **No hardcoded values**
  - Use variables for all configurable values
  - Sensitive data handled securely
  - Environment-specific configurations are parameterized

### Testing Requirements

- [ ] **Unit tests included for new functionality**
  - Test both positive and negative scenarios
  - Edge cases are covered
  - Tests are deterministic and reliable

- [ ] **Integration tests included for infrastructure changes**
  - Tests deploy actual Azure resources
  - Cleanup procedures are implemented
  - Tests validate resource configurations

- [ ] **Test coverage meets requirements**
  - Critical paths are fully tested
  - Coverage report shows no major gaps

### Security & Compliance

- [ ] **No secrets or credentials in code**
  - API keys, passwords, or tokens
  - Connection strings or endpoints
  - Personal or sensitive information

- [ ] **Security best practices followed**
  - Least privilege access principles
  - Secure defaults for all configurations
  - Encryption enabled where appropriate

- [ ] **Compliance considerations addressed**
  - RBAC configurations included
  - Audit logging enabled
  - Policy compliance validated

### Documentation

- [ ] **README updated if needed**
  - Usage examples reflect changes
  - Prerequisites are current
  - Configuration options documented

- [ ] **API documentation updated**
  - Variable descriptions are complete
  - Output descriptions are meaningful
  - Examples show realistic usage

- [ ] **Breaking changes documented**
  - Migration guide provided
  - Deprecation notices included
  - Compatibility matrix updated

### Terraform-Specific Checks

- [ ] **Code follows conventions**
  - Required files present (main.tf, variables.tf, outputs.tf, versions.tf)
  - Examples directory included
  - README.md with usage instructions

- [ ] **Variable validation implemented**
  - Input validation rules defined
  - Error messages are helpful
  - Sensitive variables marked appropriately

- [ ] **Outputs are meaningful**
  - Include all necessary information for consumers
  - Descriptions explain the purpose
  - Sensitive outputs marked correctly

- [ ] **Version constraints specified**
  - Terraform version requirements
  - Provider version constraints
  - Module version dependencies

## Common Issues and Solutions

### Linting Errors

```shell
# Auto-fix formatting issues
task lint

# Check specific linting rules
task tf:lint
task md:lint
```

### PR Size Too Large

If reviewers request smaller PRs:

1. **Create multiple feature branches** from your current branch
1. **Split changes logically** (e.g., separate refactoring from new features)
1. **Submit separate PRs** with clear dependencies noted
1. **Link PRs together** in descriptions

## Getting Help

### When to Ask for Help

- **Unclear review feedback** - Ask for clarification
- **Technical implementation questions** - Use GitHub Discussions
- **Process questions** - Comment on your PR
- **Urgent issues** - Mention maintainers directly

### Support Channels

- **PR comments** - Best for questions about specific feedback
- **GitHub Discussions** - General questions and broader topics
- **Issue comments** - Questions about the original requirement
- **Draft PRs** - Get early feedback on approach

### Escalation

If you need urgent help:

1. **Comment on your PR** mentioning @microsoft/caira-mtain
1. **Use GitHub Discussions** with the "help wanted" label
1. **Check our community channels** listed in the main README

---

Ready to create your pull request? Follow this checklist and guidelines to ensure a smooth review process. Remember, good PRs make the review process faster and more enjoyable for everyone!
