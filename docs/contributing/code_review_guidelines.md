<!-- META
title: Code Review Guidelines
description: Best practices for inclusive, constructive code reviews in the CAIRA project.
author: CAIRA Team
ms.date: 08/18/2025
ms.topic: guide
estimated_reading_time: 7
keywords:
  - code review
  - best practices
  - inclusive reviews
  - quality
  - feedback
  - pull requests
  - review workflow
  - CAIRA
-->

# Code Review Guidelines

This guide outlines best practices for conducting inclusive, constructive code reviews in the CAIRA project. Good code reviews improve code quality, share knowledge, and build a welcoming community.

## Core Principles

### Inclusive Reviews

- **Be respectful and constructive** - Focus on the code, not the person
- **Assume positive intent** - Contributors want to do good work
- **Ask questions instead of making demands** - "Could we..." instead of "You must..."
- **Explain the "why"** - Help others learn from your feedback
- **Celebrate good work** - Acknowledge well-written code and clever solutions

### Quality Focus

- **Security first** - Prioritize security vulnerabilities and best practices
- **Maintainability** - Consider long-term maintenance and readability
- **Performance** - Identify potential performance issues
- **Consistency** - Ensure code follows project conventions
- **Completeness** - Verify tests and documentation are adequate

## Review Process

### Timeline Expectations

| Review Stage          | Timeline          | Requirements                     |
|-----------------------|-------------------|----------------------------------|
| **Initial Review**    | 2-3 business days | First maintainer review          |
| **Follow-up Reviews** | 1-2 business days | Additional reviews after changes |
| **Final Approval**    | Same day          | Second maintainer approval       |

### Reviewer Assignment

- **Maintainers** automatically assigned based on changed files
- **Domain experts** may be requested for specific areas
- **Community members** encouraged to participate in reviews
- **Authors** can request specific reviewers if needed

## For Reviewers

### Review Preparation

Before starting a review:

1. **Understand the context** - Read the linked issue
1. **Check the scope** - Ensure changes match the description
1. **Review the approach** - Consider if there are better alternatives
1. **Set aside adequate time** - Don't rush through reviews

### What to Look For

#### Security & Compliance

- [ ] **No hardcoded secrets** - API keys, passwords, connection strings
- [ ] **Proper access controls** - RBAC configurations and least privilege
- [ ] **Secure defaults** - Encryption enabled, security groups restrictive
- [ ] **Input validation** - Terraform variable validation rules
- [ ] **Audit logging** - Appropriate monitoring and logging configured

#### Code Quality

- [ ] **Follows conventions** - Project style guidelines and patterns
- [ ] **Clear naming** - Variables, resources, and functions are well-named
- [ ] **Appropriate comments** - Complex logic is explained
- [ ] **DRY principle** - No unnecessary code duplication
- [ ] **Error handling** - Proper validation and error messages

#### Testing

- [ ] **Meaningful tests** - Tests actually validate functionality
- [ ] **Edge cases covered** - Boundary conditions and error scenarios
- [ ] **Integration tests** - Infrastructure changes include deployment tests
- [ ] **Test maintainability** - Tests are clear and not overly complex

#### Documentation

- [ ] **README updated** - Usage instructions reflect changes
- [ ] **Variable descriptions** - All inputs and outputs documented
- [ ] **Examples provided** - Realistic usage examples included
- [ ] **Breaking changes** - Migration guidance provided
- [ ] **ADRs updated** - Architectural decisions documented

### Providing Feedback

#### Feedback Categories

Use these labels to categorize your feedback:

- **🔴 Must Fix** - Security issues, breaking changes, critical bugs
- **🟡 Should Fix** - Code quality, performance, maintainability issues
- **🔵 Consider** - Suggestions for improvement, alternative approaches
- **💡 Learning** - Educational comments, best practices sharing
- **✅ Praise** - Acknowledge good work and clever solutions

#### Writing Effective Comments

**Good feedback examples:**

```markdown
🔴 **Security**: This variable should be marked as sensitive since it contains credentials.
```

```diff
variable "admin_password" {
  description = "Administrator password"
  type        = string
+ sensitive   = true
}
```

```markdown
🟡 **Maintainability**: Consider extracting this complex validation into a separate locals block for better readability.
```

```markdown
🔵 **Consider**: We could use the Azure Verified Module pattern here. Would that work for your use case?
```

```markdown
💡 **Learning**: Great use of the `for_each` loop! This pattern is much more maintainable than `count`.
```

```markdown
✅ **Praise**: Excellent error handling in this validation block - the error messages are very helpful!
```

#### Feedback Best Practices

**DO:**

- Be specific about what needs to change
- Provide code suggestions when helpful
- Link to documentation or examples
- Ask questions to understand the approach
- Acknowledge constraints and trade-offs

**DON'T:**

- Use harsh or demanding language
- Make personal comments about the author
- Assume malicious intent
- Nitpick formatting (use linters instead)
- Block on personal preferences

### Review Examples

#### Security Review

```markdown
## Security Review

🔴 **Critical**: Line 23 - The storage account allows public access. This should be disabled for security:

```diff
resource "azurerm_storage_account" "example" {
  # ...existing configuration...
+ public_network_access_enabled = false
+ allow_nested_items_to_be_public = false
}
```

🟡 **Important**: Consider adding network rules to restrict access further:

```terraform
network_rules {
  default_action = "Deny"
  ip_rules       = var.allowed_ips
}
```

💡 **Learning**: The use of customer-managed keys is excellent for compliance requirements!

```markdown

#### Code Quality Review

```markdown
## Code Quality Review

🟡 **Maintainability**: The validation logic in `variables.tf` is getting complex. Consider moving it to a separate file:

```terraform
# validations.tf
locals {
  cidr_validation = {
    condition     = can(cidrhost(var.address_space, 0))
    error_message = "Address space must be a valid CIDR block."
  }
}
```

🔵 **Consider**: We could use the `azurerm_client_config` data source instead of requiring tenant_id as input.

✅ **Praise**: Great job on the comprehensive output descriptions - they're very helpful for consumers!

```markdown

## For Authors

### Responding to Reviews

#### How to Respond

1. **Read carefully** - Understand each piece of feedback
1. **Ask questions** - Clarify anything that's unclear
1. **Prioritize fixes** - Address security and critical issues first
1. **Make changes thoughtfully** - Don't just apply suggestions blindly
1. **Respond to comments** - Explain what you changed and why

#### Response Examples

**Acknowledging and fixing:**
```markdown
Good catch! I've updated the storage account configuration to disable public access and added network rules as suggested. The changes are in commit abc123f.
```

**Asking for clarification:**

```markdown
I understand the concern about the validation logic. Could you clarify which specific validations you think should be moved? I want to make sure I understand the scope correctly.
```

**Explaining your approach:**

```markdown
I considered using `azurerm_client_config` but chose to keep `tenant_id` as a variable because this module might be used in scenarios where the tenant differs from the executing context. Would you like me to add a note about this in the README?
```

**Disagreeing respectfully:**

```markdown
I appreciate the suggestion about using locals for the validation. In this case, I think keeping it inline makes the variable definition more self-contained, but I'm happy to change it if you feel strongly about it.
```

### Addressing Feedback

#### Making Changes

- **Create new commits** for review changes (don't amend)
- **Reference the feedback** in commit messages
- **Test your changes** before pushing
- **Update documentation** if needed

Example commit message:

```text
fix(storage): disable public access per security review

- Set public_network_access_enabled = false
- Add network rules to restrict access
- Update README with security considerations

Addresses feedback in PR review comments.
```

#### Re-requesting Review

After making changes:

1. **Respond to comments** explaining what you changed
1. **Push your changes** to the branch
1. **Re-request review** from the original reviewers
1. **Mark conversations as resolved** if appropriate

## Special Review Scenarios

### Breaking Changes

For PRs with breaking changes:

- [ ] **Migration guide provided** - Clear upgrade path documented
- [ ] **Deprecation warnings** - Gradual transition plan if possible
- [ ] **Version bump planned** - Semantic versioning considerations
- [ ] **Stakeholder communication** - Impact assessment completed

### Large Pull Requests

For substantial changes:

- [ ] **Architecture review** - Overall approach is sound
- [ ] **Incremental review** - Review in logical chunks
- [ ] **Early feedback** - Use draft PRs for early guidance
- [ ] **Testing strategy** - Comprehensive test plan included

### Emergency Fixes

For urgent security or critical bug fixes:

- [ ] **Expedited review** - Prioritize for immediate attention
- [ ] **Risk assessment** - Understand impact of both fix and delay
- [ ] **Follow-up planned** - Proper tests and docs can come after
- [ ] **Post-mortem considered** - Learn from the incident

## Review Tools and Automation

### GitHub Features

- **Suggested changes** - Use for small, specific fixes
- **Review summary** - Provide overall assessment
- **Approve/Request changes** - Clear signal of review status
- **Draft comments** - Prepare comprehensive feedback before submitting

### Automated Checks

Our CI/CD pipeline automatically checks:

- **Linting** - Code style and formatting
- **Testing** - Unit and integration tests
- **Security** - Static analysis and vulnerability scanning
- **Documentation** - Link validation and spell checking

Focus your review on things automation can't catch:

- **Logic correctness** - Does the code do what it's supposed to?
- **Architecture fit** - Does this align with project goals?
- **User experience** - Will this be easy to use and understand?
- **Edge cases** - Are there scenarios not covered by tests?

## Building Review Skills

### For New Reviewers

1. **Start with documentation** - Easier to review and good practice
1. **Shadow experienced reviewers** - Learn by observing
1. **Ask questions** - Don't hesitate to seek guidance
1. **Focus on learning** - Each review teaches you something new

### Growing as a Reviewer

- **Study the codebase** - Understand project patterns and conventions
- **Learn security best practices** - Stay current with Azure security guidance
- **Practice giving feedback** - Develop your communication skills
- **Seek feedback on your reviews** - Ask if your feedback was helpful

### Review Mentorship

Experienced reviewers should:

- **Explain your reasoning** - Help others learn from your expertise
- **Suggest resources** - Point to documentation and best practices
- **Encourage participation** - Welcome new contributors
- **Share knowledge** - Teach patterns and anti-patterns

## Review Metrics and Goals

### Quality Indicators

- **Review participation** - Multiple people engaging in reviews
- **Feedback quality** - Constructive, specific, actionable comments
- **Response time** - Meeting our timeline commitments
- **Learning outcomes** - Contributors growing their skills

### What We Don't Measure

- **Number of comments** - Quality over quantity
- **Approval speed** - Thorough reviews take time
- **Perfect code** - We value learning over perfection
- **Unanimous agreement** - Healthy debate is valuable

---

Remember: Code reviews are conversations, not examinations. The goal is to improve the code, share knowledge, and build a strong community. Every interaction is an opportunity to learn and help others grow!
