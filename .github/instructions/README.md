---
title: Development Instructions
description: Context-specific development instructions that guide automated and manual development workflows within the CAIRA project.
author: CAIRA Team
ms.date: 08/04/2025
ms.topic: reference
estimated_reading_time: 5
keywords:
    - development instructions
    - coding standards
    - workflow guidance
    - CAIRA
    - automation
    - copilot instructions
    - task implementation
    - commit messages
---

# Development Instructions

This directory contains context-specific development instructions that guide automated and manual development workflows within the CAIRA project.

## Overview

Instructions provide focused guidance for specific development contexts, technologies, and workflows. They are applied directly to Copilot conversations to ensure consistent adherence to project standards and best practices.

## Available Instructions

### [Architecture Guidance Instructions](architecture-guidance.instructions.md)

Provides suggestions based on Azure Well-Architected Framework best practices to build upon CAIRA reference architectures.

- **Purpose**: Architecture guidance tailored to user context and requirements
- **Scope**: Azure Well-Architected Framework best practices, CAIRA reference architecture considerations
- **Coverage**: Additional considerations, best practices, guidance recommendations

### [Commit Message Instructions](commit-message.instructions.md)

Standardized commit message format following Conventional Commits specification.

- **Purpose**: Consistent commit history and automated changelog generation
- **Scope**: Commit message format, types, scopes, and CAIRA-specific conventions
- **Coverage**: Conventional Commits format, CAIRA-specific scopes, examples, guidelines

### [Configuration Instructions](configuration.instructions.md)

Delivers authoritative configuration guidance for CAIRA reference architectures, ensuring alignment with Azure AI Foundry deployment best practices.

- **Purpose**: Validated configuration parameters and secure dependency management
- **Scope**: Azure AI Foundry deployments, configuration parameters, validated sources
- **Coverage**: Configuration best practices, parameter validation, dependency management

### [Deployment Instructions](deployment.instructions.md)

Provides instructions for deploying CAIRA reference architecture solutions.

- **Purpose**: Systematic deployment guidance for reference architectures
- **Scope**: Solution deployment, reference architecture selection, deployment processes
- **Coverage**: Deployment procedures, architecture selection, deployment best practices

### [Getting Started Instructions](getting-started.instructions.md)

Provides getting started, quick start, and how-to instructions for CAIRA project interactions.

- **Purpose**: Help users get started with established practices
- **Scope**: Project onboarding, quick start guides, how-to procedures
- **Coverage**: Getting started guidance, quick start procedures, established practices

### [Task Implementation Instructions](task-implementation.instructions.md)

Comprehensive guidance for implementing task plans located in `.copilot-tracking/plans/` directories.

- **Purpose**: Systematic task implementation and progress tracking
- **Scope**: Plan analysis, context gathering, quality standards, release documentation
- **Applied to**: `**/.copilot-tracking/{plans,changes}/*.md` files
- **Coverage**: Implementation process, quality standards, progress tracking, documentation

### [Terraform Instructions](terraform.instructions.md)

Infrastructure as Code implementation guidance for HashiCorp Terraform development.

- **Context**: Multi-cloud infrastructure deployment, Terraform modules
- **Scope**: Terraform syntax, module design, provider configuration
- **Apply When**: Creating or modifying Terraform infrastructure code

### [Troubleshooting Instructions](troubleshooting.instructions.md)

Guidance for troubleshooting, error resolution, and user support scenarios.

- **Context**: Any troubleshooting, error resolution, or user support context
- **Scope**: Diagnostic steps, error handling, support workflows
- **Apply When**: Investigating issues, resolving errors, assisting users

## Usage Guidelines

These instruction files are automatically referenced by GitHub Copilot and other automated tools when working on files that match their respective `applyTo` patterns. They ensure consistent development practices and standards across the project.

### Adding Instructions to Context

1. Open GitHub Copilot Chat
1. Select **Add Context > Instructions**
1. Choose the relevant instruction file for your development context
1. Add additional context (files, folders) as needed
1. Provide your development prompt

### When to Apply Instructions

Instructions are automatically applied based on their `applyTo` scope when the context matches. Manually add instructions when:

- Working in specific technology contexts (Terraform, etc.)
- Following systematic implementation processes
- Ensuring consistency with project standards
- Maintaining code quality and conventions

### Best Practices

- **Single Context**: Use one primary instruction file per conversation for focus
- **Relevant Scope**: Choose instructions that match your current development task
- **Combined Context**: Add project files and folders alongside instructions
- **Progressive Application**: Apply task implementation instructions for complex work

## Related Resources

- **[Core Guidance](../guidance/getting-started.md)**: Comprehensive development standards and deployment guidance
- **[Contributing Guidelines](../../CONTRIBUTING.md)**: General contribution guidelines for the project
- **[Security Practices](../../SECURITY.md)**: Security development practices and standards
