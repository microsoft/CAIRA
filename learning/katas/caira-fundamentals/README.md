---
title: "CAIRA Fundamentals Katas"
description: "Essential foundation for deploying and operating CAIRA reference architectures with AI-assisted engineering workflows"
author: HVE Essentials Team
ms.date: 12/08/2025
ms.topic: kata-category
estimated_reading_time: 3
difficulty: beginner-to-intermediate
duration: 90 minutes
# Learning Platform Integration
category: caira-fundamentals
prerequisite_katas: []
role_relevance:
  - platform-engineer
  - solutions-architect
  - devops-engineer
  - ai-ml-engineer
learning_objectives:
  - Build proficiency with CAIRA Assistant chatmode for requirements gathering and architecture selection
  - Understand differences between CAIRA reference architectures and match them to business scenarios
  - Deploy Azure AI Foundry infrastructure using devcontainer workflow and Terraform
  - Validate successful deployments and troubleshoot common configuration issues
# Content Classification
content_type: hands-on
real_world_application: Platform engineers and solutions architects use CAIRA fundamentals to evaluate requirements, select appropriate reference architectures, and execute initial deployments of Azure AI Foundry environments for development teams
complexity_factors:
  - Multiple architecture patterns requiring decision-making based on requirements
  - Containerized development environment setup and authentication
  - Infrastructure-as-code deployment with Terraform lifecycle management
  - Azure subscription permissions and quota considerations
# Success Criteria & Assessment
success_criteria:
  - Demonstrate proficiency using CAIRA Assistant for architecture recommendations
  - Accurately compare and contrast all four CAIRA reference architectures
  - Successfully deploy foundry_basic architecture from devcontainer environment
  - Validate Azure AI Foundry resources created and accessible
common_pitfalls:
  - "Skipping requirements gathering before architecture selection": Use CAIRA Assistant to analyze business needs systematically
  - "Confusing basic/standard with public/private networking": These are two independent dimensions
  - "Deploying without Docker Desktop running": Verify Docker status before opening devcontainer
  - "Not reviewing Terraform plan before apply": Always inspect plan output for unexpected changes
  - "Using incorrect variable names in terraform.tfvars": Reference variables.tf for exact field names
# SEO & Discoverability
keywords:
  - CAIRA getting started
  - Azure AI Foundry deployment
  - CAIRA reference architectures
  - AI-assisted engineering
  - devcontainer workflow
  - terraform fundamentals
tags:
  - caira-fundamentals
  - getting-started
  - azure-ai-foundry
# AI Coaching Integration
ai_coaching_enabled: true
validation_checkpoints:
  - "Checkpoint 1: Verify understanding of CAIRA Assistant chatmode capabilities"
  - "Checkpoint 2: Confirm ability to match scenarios to correct architectures"
  - "Checkpoint 3: Ensure devcontainer environment operational with all tools accessible"
  - "Checkpoint 4: Validate successful Terraform deployment and Azure resource verification"
troubleshooting_guide: |
  **Common Issues:**
  - CAIRA Assistant not responding: Ensure you've typed `@caira-assistant` in GitHub Copilot Chat
  - Architecture comparison feels overwhelming: Focus on two dimensions (basic/standard for agent capability, public/private for networking)
  - Devcontainer fails to open: Check Docker Desktop is running and Dev Containers extension is installed
  - Terraform plan shows errors: Review variables.tf for correct field names and required values
---

# CAIRA Fundamentals

Essential foundation katas for deploying and operating CAIRA reference architectures using AI-assisted engineering workflows on Azure AI Foundry.

## Category Overview

CAIRA Fundamentals katas provide the essential knowledge and hands-on experience needed to successfully deploy Azure AI Foundry environments using CAIRA reference architectures. You'll learn to use AI-assisted tools (CAIRA Assistant chatmode) for requirements gathering, understand the architectural differences between CAIRA's four deployment patterns, and execute your first infrastructure deployment using containerized development workflows.

These exercises emphasize practical skills platform engineers and solutions architects need when evaluating CAIRA for organizational AI initiatives. The progression starts with requirements analysis, moves through architectural comparison, and culminates in hands-on deployment within a standardized devcontainer environment.

**Key Technologies**: CAIRA Assistant chatmode, Azure AI Foundry, Terraform, Docker devcontainers, Azure CLI, GitHub Copilot

**Progressive Learning**: Katas build sequentially from requirements gathering → architectural understanding → hands-on deployment, with each kata providing prerequisite knowledge for the next.

**Real-World Applications**: These foundational skills enable teams to evaluate CAIRA reference architectures, select appropriate patterns for business requirements, and deploy initial Azure AI Foundry environments following organizational standards.

## Prerequisites

### Required Knowledge

- Basic understanding of cloud computing concepts (IaaS, PaaS, resource groups)
- Familiarity with command-line interfaces (CLI) and terminal usage
- General awareness of AI/ML workloads and model deployment concepts
- Version control basics (Git clone, repository navigation)

### Required Tools

- **GitHub Copilot** (subscription required for CAIRA Assistant chatmode)
- **VS Code** with Dev Containers extension (ms-vscode-remote.remote-containers)
- **Docker Desktop** (latest stable version, running)
- **Git** (for CAIRA repository cloning)
- **Azure subscription** with Contributor + User Access Administrator permissions (or Owner role)
- **Web browser** (for Azure Portal access and Azure CLI authentication)

### Recommended Preparation

No prerequisite katas required - this is the starting point for CAIRA learning. However, familiarity with these concepts will accelerate your learning:

- Azure Portal navigation and resource browsing
- Basic Terraform concepts (providers, resources, state)
- VS Code extensions and workspace management

## Learning Path

Visual representation of CAIRA fundamentals skill progression:

```text
[Kata 100: Requirements Gathering]
              ↓
    CAIRA Assistant Proficiency
    Business Requirements Analysis
              ↓
[Kata 150: Architecture Patterns]
              ↓
    4 Reference Architectures
    Public vs Private Networking
    Basic vs Standard (Agent Capability)
              ↓
[Kata 200: First Deployment]
              ↓
    Devcontainer Workflow
    Terraform Deployment
    Azure AI Foundry Validation
        ↓
[Kata 350: Validate with Sample App]
        ↓
  End-to-End Inference Testing
  Authentication Verification
        ↓
[Kata 400: Customize for Requirements]
        ↓
  Dev/Prod Customization Plan
  Plan-First Change Validation
              ↓
    Production-Ready CAIRA Foundation
```

## Category Katas

### [Kata 100: Gathering Requirements with CAIRA Assistant](./100-gathering-requirements-with-caira-assistant.md)

**Difficulty**: ⭐ (1/5) | **Time**: 30 minutes

Learn to use the CAIRA Assistant chatmode to analyze business scenarios, extract technical requirements, and receive architecture recommendations aligned with organizational needs.

**You'll Learn**:

- Activate and interact with CAIRA Assistant chatmode in GitHub Copilot
- Analyze business scenarios to extract key technical requirements
- Understand how CAIRA Assistant maps requirements to reference architectures
- Recognize when to use AI-assisted requirements gathering vs manual analysis
- Validate architecture recommendations against organizational constraints

**Prerequisites**: None (starting point for CAIRA fundamentals)

**Scaffolding**: Heavy - Step-by-step chatmode activation with example prompts and expected responses

### [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md)

**Difficulty**: ⭐ (1/5) | **Time**: 30 minutes

Compare all four CAIRA reference architectures and learn to match business requirements to appropriate deployment patterns based on agent capability needs and networking isolation requirements.

**You'll Learn**:

- Explain differences between all 4 CAIRA architectures (foundry_basic, foundry_basic_private, foundry_standard, foundry_standard_private)
- Identify when to use public vs private networking patterns
- Recognize resource requirements for agent vs non-agent workloads
- Match business scenarios to appropriate architecture choices
- Understand cost and security trade-offs between configurations

**Prerequisites**: [Kata 100: Gathering Requirements with CAIRA Assistant](./100-gathering-requirements-with-caira-assistant.md) (recommended for understanding how CAIRA Assistant makes these recommendations)

**Scaffolding**: Medium-Heavy - Documentation exploration with guided comparison matrix creation

### [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md)

**Difficulty**: ⭐⭐ (2/5) | **Time**: 39 minutes

Deploy CAIRA's foundry_basic architecture using the built-in devcontainer environment with AI-assisted Terraform workflow for safe, validated infrastructure provisioning.

**You'll Learn**:

- Develop inside CAIRA devcontainer with all tools pre-configured
- Authenticate Azure CLI within containerized development environment
- Use caira-assistant chatmode for guided Terraform deployment workflow
- Execute complete Terraform lifecycle (init, plan, apply) safely
- Make informed configuration decisions for variable management
- Validate successful Azure AI Foundry infrastructure deployment

**Prerequisites**:
- [Kata 100: Gathering Requirements with CAIRA Assistant](./100-gathering-requirements-with-caira-assistant.md)
- [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md)

**Scaffolding**: Medium-Heavy - Detailed deployment steps with validation checkpoints and common pitfall guidance

### [Kata 350: Validating CAIRA with Sample AI Application](./350-validating-caira-with-sample-ai-application.md)

**Difficulty**: ⭐⭐⭐ (3/5) | **Time**: 45 minutes

Validate a deployed CAIRA environment end-to-end by running a sample Python application, verifying inference, endpoints, and authentication are configured correctly.

**You'll Learn**:

- Build a structured validation checklist for CAIRA deployments
- Deploy and configure a sample Python application against AI Foundry endpoints
- Verify authentication and access patterns for application workloads

**Prerequisites**: [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md)

**Scaffolding**: Medium-Heavy - Guided validation steps with checkpoints and common pitfalls

### [Kata 400: Customizing CAIRA for Your Requirements](./400-customizing-caira-for-your-requirements.md)

**Difficulty**: ⭐⭐⭐ (3/5) | **Time**: 45 minutes

Customize CAIRA reference architectures to match real organizational requirements (region, tags, environment separation, networking posture) using supported Terraform variables and a safe plan-first workflow.

**You'll Learn**:

- Select the right CAIRA architecture baseline for your constraints
- Customize deployments via `variables.tf` and environment-specific `terraform.tfvars`
- Validate changes safely using `terraform validate` and `terraform plan`

**Prerequisites**:

- [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md)
- [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md)

**Scaffolding**: Medium-Heavy - Guided customization workflow with plan review checkpoints

## Kata Comparison Matrix

| Kata                                                                                      | Difficulty | Time   | Technologies                                          | Scaffolding  | Prerequisites |
|-------------------------------------------------------------------------------------------|------------|--------|-------------------------------------------------------|--------------|---------------|
| [100: Gathering Requirements with CAIRA Assistant](./100-gathering-requirements-with-caira-assistant.md) | ⭐ (1/5)    | 30 min | CAIRA Assistant, GitHub Copilot, Requirements Analysis | Heavy        | None          |
| [150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md)     | ⭐ (1/5)    | 30 min | CAIRA Reference Architectures, Azure AI Foundry       | Medium-Heavy | Kata 100 (recommended) |
| [200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md)          | ⭐⭐ (2/5)   | 39 min | Docker, VS Code, Terraform, Azure CLI, Azure AI Foundry | Medium-Heavy | Katas 100, 150 |
| [350: Validating CAIRA with Sample AI Application](./350-validating-caira-with-sample-ai-application.md) | ⭐⭐⭐ (3/5) | 45 min | Python, Azure CLI, Azure AI Foundry SDK, CAIRA        | Medium-Heavy | Kata 200      |
| [400: Customizing CAIRA for Your Requirements](./400-customizing-caira-for-your-requirements.md)        | ⭐⭐⭐ (3/5) | 45 min | Terraform, Azure AI Foundry, CAIRA                    | Medium-Heavy | Katas 150, 200 |

## Suggested Learning Sequences

### For Beginners

If you're completely new to CAIRA and Azure AI Foundry:

1. [Kata 100: Gathering Requirements with CAIRA Assistant](./100-gathering-requirements-with-caira-assistant.md) - Start with AI-assisted requirements analysis
2. [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md) - Build architectural decision-making skills
3. [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md) - Execute your first deployment
4. [Kata 350: Validating CAIRA with Sample AI Application](./350-validating-caira-with-sample-ai-application.md) - Validate infrastructure end-to-end
5. [Kata 400: Customizing CAIRA for Your Requirements](./400-customizing-caira-for-your-requirements.md) - Turn one-off deployments into repeatable standards

**Total Time**: ~189 minutes for complete foundational proficiency

### For Intermediate Learners

If you have Azure experience and want to focus on CAIRA-specific workflows:

1. [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md) - Skip requirements gathering, focus on architecture
2. [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md) - Apply architectural knowledge in deployment

**Total Time**: ~70 minutes for core deployment skills

### For Advanced Users

If you're experienced with Terraform and Azure infrastructure, want CAIRA-specific acceleration:

1. [Kata 150: Understanding CAIRA Architecture Patterns](./150-understanding-caira-architecture-patterns.md) - Understand the 2x2 architecture matrix (15 minutes)
2. [Kata 200: Devcontainer & Foundry Basic Deployment](./200-devcontainer-foundry-basic-deployment.md) - Focus on devcontainer workflow and CAIRA-specific variables (25 minutes)

**Total Time**: ~40 minutes for CAIRA deployment proficiency

## Real-World Applications

These foundational skills prepare you for:

- **Platform Engineering**: Solutions architects at healthcare organizations evaluate CAIRA reference architectures to select deployment patterns meeting HIPAA compliance and data sovereignty requirements for AI agent workloads
- **Team Onboarding**: DevOps teams use standardized devcontainer workflows to onboard new engineers to CAIRA platform within hours, ensuring consistent tool versions and deployment practices across distributed teams
- **Architecture Decision-Making**: Technology leaders at financial services companies use CAIRA Assistant to analyze business requirements and justify infrastructure recommendations to stakeholder committees
- **Initial Deployments**: Infrastructure engineers deploy foundry_basic environments for multiple development teams, providing isolated Azure AI Foundry workspaces with predictable configuration and rapid provisioning

## Common Challenges and Solutions

### Challenge 1: CAIRA Assistant Doesn't Respond or Gives Generic Answers

New users sometimes struggle to activate CAIRA Assistant chatmode or receive helpful architecture recommendations.

**Solution**: Complete [Kata 100](./100-gathering-requirements-with-caira-assistant.md) which teaches exact chatmode activation syntax (`@caira-assistant` prefix) and provides example prompts that yield specific architecture recommendations. Ensure you're providing sufficient business context in your prompts.

### Challenge 2: Confusion Between Basic/Standard and Public/Private Dimensions

The four CAIRA architectures can feel overwhelming initially, with learners conflating agent capability (basic/standard) with networking (public/private).

**Solution**: [Kata 150](./150-understanding-caira-architecture-patterns.md) emphasizes the 2x2 matrix structure: ask two independent yes/no questions: (1) Do I need Agent Service capabilities? (2) Do I need network isolation? This creates clear decision paths to the correct architecture.

### Challenge 3: Devcontainer Fails to Open or Tools Missing

Docker and VS Code Dev Containers extension setup can cause initial friction, blocking deployment progress.

**Solution**: [Kata 200, Essential Setup section](./200-devcontainer-foundry-basic-deployment.md#essential-setup) provides explicit pre-flight checks including Docker Desktop status verification and Dev Containers extension installation validation. The kata includes troubleshooting steps for common devcontainer issues.

### Challenge 4: Terraform Apply Fails with Permission or Variable Errors

First-time deployers encounter Azure RBAC permission errors or Terraform variable configuration mistakes.

**Solution**: [Kata 200](./200-devcontainer-foundry-basic-deployment.md) documents exact Azure permission requirements (Contributor + User Access Administrator or Owner role) and common variable pitfalls (incorrect field names, auto-create vs explicit resource group). The kata's "Common Pitfalls" YAML section provides quick reference for these issues.

## Integration with Learning Paths

This fundamental category serves as the foundation for advanced CAIRA learning:

- **CAIRA Fundamentals Path** (Current): Complete sequence preparing learners for production deployments
- **CAIRA Proficiency Path** (Future): Advanced katas for private networking, standard architectures, and agent-focused deployments - builds on fundamentals
- **Troubleshooting Path**: [Kata 300: Troubleshooting CAIRA Deployments](../troubleshooting/300-troubleshooting-caira-deployments.md) directly builds on Kata 200's deployment workflow

## Hands-On Labs

Related comprehensive multi-phase labs building on CAIRA fundamentals:

- **Azure AI Foundry with Function Integration Lab** (Future): Multi-hour experience deploying complete agent system with Azure Functions, building on foundry_basic deployment skills from Kata 200

## Additional Resources

### Official Documentation

- [CAIRA Repository](https://github.com/microsoft/CAIRA) - Main CAIRA reference architectures and documentation
- [Azure AI Foundry Documentation](https://learn.microsoft.com/azure/ai-studio/) - Comprehensive Azure AI platform reference
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs) - Resource documentation for CAIRA deployments
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers) - Containerized development environment guide

### Community Resources

- [CAIRA GitHub Discussions](https://github.com/microsoft/CAIRA/discussions) - Community support and architecture questions
- [CAIRA Issues](https://github.com/microsoft/CAIRA/issues) - Report kata problems or suggest improvements

### Related Categories

- [CAIRA Troubleshooting](../troubleshooting/README.md) - Diagnostic skills for resolving deployment failures (builds on Kata 200)
- [CAIRA Proficiency](../caira-proficiency/README.md) (Future) - Advanced deployment patterns including private networking and standard architectures

## Feedback and Contributions

We welcome feedback and contributions! Please:

- Report kata issues or suggest improvements via [GitHub Issues](https://github.com/eedorenko/CAIRA/issues)
- Share real-world scenarios that would benefit from additional katas
- Contribute devcontainer workflow improvements or common troubleshooting solutions through pull requests
- Participate in [GitHub Discussions](https://github.com/eedorenko/CAIRA/discussions) to help other learners

## Version History

| Version | Date       | Changes                                              |
|---------|------------|------------------------------------------------------|
| 1.0.0   | 12/08/2025 | Initial category creation with Katas 100, 150, 200  |

---

<!-- markdownlint-disable MD036 -->
*🤖 Crafted with precision by ✨Copilot following brilliant human instruction,
then carefully refined by our team of discerning human reviewers.*
<!-- markdownlint-enable MD036 -->
