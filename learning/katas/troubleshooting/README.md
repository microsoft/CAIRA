---
title: "CAIRA Troubleshooting Katas"
description: "Systematic troubleshooting methodology for diagnosing and resolving CAIRA deployment failures with Terraform and Azure"
author: HVE Essentials Team
ms.date: 12/08/2025
ms.topic: kata-category
estimated_reading_time: 3
difficulty: intermediate
duration: 45 minutes
# Learning Platform Integration
category: troubleshooting
prerequisite_katas:
  - caira-fundamentals-200-devcontainer-foundry-basic-deployment
role_relevance:
  - platform-engineer
  - devops-engineer
  - infrastructure-engineer
learning_objectives:
  - Develop systematic troubleshooting methodology for infrastructure deployment failures
  - Apply diagnostic tools (Terraform debugging, Azure Activity Log, CLI) to trace root causes
  - Build proficiency with resolving common failure patterns (RBAC, quotas, state conflicts)
  - Implement prevention strategies and documentation practices for team knowledge sharing
# Content Classification
content_type: hands-on
real_world_application: Platform engineers troubleshoot failed CAIRA deployments by systematically diagnosing Terraform errors, Azure permission issues, quota limits, and state conflicts to restore deployment capability and prevent future occurrences
complexity_factors:
  - Multiple failure modes requiring different diagnostic approaches
  - Understanding Azure RBAC permission scopes and state management safety
  - Balancing quick resolution with proper root cause analysis
  - Building reusable troubleshooting documentation under time pressure
# Success Criteria & Assessment
success_criteria:
  - Demonstrate proficiency in reading Terraform error messages for root cause identification
  - Apply systematic diagnostic workflow using Azure tools and CLI commands
  - Execute safe Terraform state management and provider version updates
  - Integrate troubleshooting runbook practices for team knowledge retention
common_pitfalls:
  - "Rushing to fix without reading complete error messages": Read full Terraform output - key diagnostic information often appears at end
  - "Skipping Azure Activity Log investigation": Activity Log provides ARM-level details Terraform may truncate or summarize
  - "Re-running terraform apply without addressing root cause": Identify and fix underlying issue before retry
  - "Attempting manual state file edits": NEVER manually edit Terraform state - use terraform state commands only
  - "Forcing state unlock while operations running": Verify no active Terraform process before force-unlock to prevent state corruption
  - "Not documenting solutions": Build searchable runbook - similar issues will recur
# SEO & Discoverability
keywords:
  - CAIRA troubleshooting
  - Terraform error diagnosis
  - Azure deployment failures
  - infrastructure debugging
  - state file conflicts
  - RBAC permission errors
  - quota exceeded resolution
  - systematic troubleshooting
tags:
  - troubleshooting
  - caira-proficiency
  - terraform
  - azure-diagnostics
# AI Coaching Integration
ai_coaching_enabled: true
validation_checkpoints:
  - "Checkpoint 1: Verify ability to extract diagnostic information from Terraform error output"
  - "Checkpoint 2: Confirm understanding of Azure RBAC scope requirements for CAIRA deployments"
  - "Checkpoint 3: Ensure proper use of Azure Activity Log for root cause analysis"
  - "Checkpoint 4: Validate safe Terraform state management practices documented in runbook"
troubleshooting_guide: |
  **Common Issues:**
  - Error messages truncated: Set TF_LOG=DEBUG for verbose Terraform output
  - Can't find failed operation in Activity Log: Expand time range to 24 hours and remove all filters
  - Force unlock fails: Ensure exact Lock ID copied from error message
  - Provider version conflicts persist: Delete .terraform directory and run terraform init
---

# CAIRA Troubleshooting

Systematic troubleshooting katas for diagnosing and resolving common CAIRA deployment failures using Terraform debugging techniques and Azure diagnostic tools.

## Category Overview

CAIRA Troubleshooting katas build proficiency in systematic failure diagnosis and resolution for infrastructure-as-code deployments. You'll learn to read Terraform error messages for root cause identification, use Azure diagnostic tools (Activity Log, CLI commands) to investigate deployment failures, and implement safe recovery procedures for state conflicts and permission issues.

These exercises focus on real-world troubleshooting scenarios platform engineers encounter when deploying CAIRA reference architectures. Each kata presents simulated failure patterns with diagnostic techniques to identify root causes and implement prevention strategies.

**Key Technologies**: Terraform debugging (TF_LOG), Azure Activity Log, Azure CLI diagnostic commands, Terraform state management, Azure RBAC investigation

**Progressive Learning**: Katas start with common single-failure scenarios (permissions, quotas, naming conflicts) and progress to complex multi-system diagnostics requiring systematic investigation workflows.

**Real-World Applications**: These troubleshooting skills apply to any Terraform-based Azure infrastructure deployment, with specific focus on CAIRA reference architectures and Azure AI Foundry resource patterns.

## Prerequisites

### Required Knowledge

- Terraform workflow (init, plan, apply) and basic error message interpretation
- Azure RBAC concepts (roles, scopes, assignments)
- Understanding of Azure resource naming requirements and quotas
- Familiarity with CAIRA reference architecture deployment process

### Required Tools

- CAIRA repository cloned locally
- Docker Desktop (for devcontainer environment)
- VS Code with Dev Containers extension
- Azure subscription with sufficient credits
- Access to Azure Portal with subscription visibility

### Recommended Preparation

Complete these prerequisite katas before starting troubleshooting exercises:

- [Kata 200: Devcontainer & Foundry Basic Deployment](../caira-fundamentals/200-devcontainer-foundry-basic-deployment.md) - Essential deployment foundation and workflow understanding

## Learning Path

Visual representation of troubleshooting skill progression:

```text
[Kata 300: Troubleshooting CAIRA Deployments]
              ↓
    Systematic Diagnosis
    6 Common Failure Patterns
    Azure Diagnostic Tools
    Safe Recovery Procedures
              ↓
    Production-Ready Troubleshooting Skills
```

## Category Katas

### [Kata 300: Troubleshooting CAIRA Deployments](./300-troubleshooting-caira-deployments.md)

**Difficulty**: ⭐⭐⭐ (3/5) | **Time**: 45 minutes

Learn systematic troubleshooting methodology for diagnosing and resolving common CAIRA deployment failures including permission errors, quota limits, naming conflicts, state locking, and provider version issues.

**You'll Learn**:

- Read and interpret Terraform error messages to identify root causes
- Diagnose Azure RBAC permission and quota limit issues systematically  
- Resolve Terraform state management and locking conflicts safely
- Use Azure Activity Log and diagnostic tools for infrastructure troubleshooting
- Apply targeted fixes without full redeployment using Terraform workflow
- Build reusable troubleshooting methodology and documentation practices

**Prerequisites**: [Kata 200: Devcontainer & Foundry Basic Deployment](../caira-fundamentals/200-devcontainer-foundry-basic-deployment.md)

**Scaffolding**: Medium-Heavy - Simulated errors with diagnostic guidance and safe resolution procedures

---

## Kata Comparison Matrix

| Kata                                                                              | Difficulty | Time   | Technologies                                           | Scaffolding  | Prerequisites |
|-----------------------------------------------------------------------------------|------------|--------|--------------------------------------------------------|--------------|---------------|
| [300: Troubleshooting CAIRA Deployments](./300-troubleshooting-caira-deployments.md) | ⭐⭐⭐ (3/5) | 45 min | Terraform, Azure CLI, Azure Portal, Azure Activity Log | Medium-Heavy | Kata 200      |

## Suggested Learning Sequences

### For Beginners

If you're new to CAIRA deployments or infrastructure troubleshooting:

1. **Complete prerequisite**: [Kata 200: Devcontainer & Foundry Basic Deployment](../caira-fundamentals/200-devcontainer-foundry-basic-deployment.md) - Understand successful deployment workflow first
2. **Start troubleshooting**: [Kata 300: Troubleshooting CAIRA Deployments](./300-troubleshooting-caira-deployments.md) - Work through 6 common failure scenarios

### For Intermediate Learners

If you've successfully deployed CAIRA reference architectures and want troubleshooting proficiency:

1. **Jump directly to**: [Kata 300: Troubleshooting CAIRA Deployments](./300-troubleshooting-caira-deployments.md) - Build systematic diagnostic skills
2. **Apply learnings**: Use troubleshooting runbook in real deployment scenarios

## Real-World Applications

These troubleshooting skills prepare you for:

- **Production Incident Response**: Platform engineers at financial services companies diagnose and resolve failed CAIRA deployments blocking critical sprint deadlines
- **Team Onboarding**: DevOps teams share troubleshooting runbooks enabling new members to resolve common deployment failures independently
- **Infrastructure Reliability**: Site reliability engineers implement prevention strategies (quota monitoring, permission validation) based on documented failure patterns
- **Cross-Team Support**: Infrastructure engineers troubleshoot permission and quota issues across multiple Azure subscriptions for distributed teams

## Common Challenges and Solutions

### Challenge 1: Error Messages Unclear or Truncated

Terraform sometimes summarizes complex Azure Resource Manager errors, making root cause diagnosis difficult.

**Solution**: Complete [Kata 300, Task 6](./300-troubleshooting-caira-deployments.md) to learn Azure Activity Log investigation techniques that provide complete ARM-level error details Terraform may truncate.

### Challenge 2: State File Locked After Interrupted Deployment

Network interruptions or force-quit operations can leave Terraform state locked, blocking subsequent deployments.

**Solution**: [Kata 300, Task 4](./300-troubleshooting-caira-deployments.md) teaches safe state lock resolution workflow including verification of active processes before force-unlock to prevent state corruption.

### Challenge 3: Deployments Fail in Different Regions with Quota Errors

Teams encounter different quota limits across Azure regions when deploying multiple CAIRA environments.

**Solution**: [Kata 300, Task 2](./300-troubleshooting-caira-deployments.md) demonstrates quota investigation techniques and workaround strategies (region selection, quota increase requests, resource cleanup).

## Integration with Learning Paths

This troubleshooting category provides essential diagnostic skills referenced in:

- **CAIRA Fundamentals Path**: Troubleshooting kata builds on successful deployment workflow from Kata 200
- **CAIRA Proficiency Path** (Future): Advanced troubleshooting scenarios for complex reference architectures

## Additional Resources

### Official Documentation

- [Azure Activity Log Documentation](https://learn.microsoft.com/azure/azure-monitor/essentials/activity-log) - Complete guide to deployment investigation
- [Terraform Debugging](https://developer.hashicorp.com/terraform/internals/debugging) - TF_LOG environment variable and debugging techniques
- [Azure RBAC Troubleshooting](https://learn.microsoft.com/azure/role-based-access-control/troubleshooting) - Permission error diagnosis and resolution
- [Azure Quotas and Limits](https://learn.microsoft.com/azure/azure-resource-manager/management/azure-subscription-service-limits) - Subscription limits and increase procedures

### Community Resources

- [CAIRA Troubleshooting Guide](../../docs/troubleshooting.md) - Repository-specific troubleshooting documentation
- [GitHub Discussions](https://github.com/eedorenko/CAIRA/discussions) - Community support for deployment issues

### Related Categories

- [CAIRA Fundamentals](../caira-fundamentals/README.md) - Foundation deployment skills required before troubleshooting practice
- [CAIRA Proficiency](../caira-proficiency/README.md) (Future) - Advanced deployment scenarios building on troubleshooting proficiency

## Feedback and Contributions

We welcome feedback and contributions! Please:

- Report troubleshooting kata issues or suggest improvements via [GitHub Issues](https://github.com/eedorenko/CAIRA/issues)
- Share additional troubleshooting scenarios encountered in production deployments
- Contribute prevention strategies and diagnostic techniques through pull requests

## Version History

| Version | Date       | Changes                                     |
|---------|------------|---------------------------------------------|
| 1.0.0   | 12/08/2025 | Initial troubleshooting category creation with Kata 300 |

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->
