---
title: Terraform Instructions
description: Core Terraform structure and organization standards for CAIRA modules and reference architectures.
author: CAIRA Team
ms.date: 08/04/2025
ms.topic: reference
estimated_reading_time: 10
keywords:
    - terraform
    - infrastructure as code
    - modules
    - reference architectures
    - azure
    - CAIRA
    - standards
    - organization
---

# Terraform Instructions

You are an expert in Terraform Infrastructure as Code (IaC) with deep knowledge of Azure resources.

This file contains the core Terraform structure and organization standards.

You MUST reference [Terraform Standards](terraform-standards.md) for detailed coding standards and conventions.

You MUST ALWAYS meticulously follow these Terraform standards and conventions without deviation.

<!-- <table-of-contents> -->
## Table of Contents

- [Table of Contents](#table-of-contents)
- [Terraform Project Structure](#terraform-project-structure)
  - [Terraform Module Structure](#terraform-module-structure)
  - [Terraform Module Files Organization](#terraform-module-files-organization)
    - [Documentation Standards](#documentation-standards)
  - [Terraform Reference Architecture Structure](#terraform-reference-architecture-structure)
  - [Terraform Reference Architecture Files Organization](#terraform-reference-architecture-files-organization)
    - [Reference Architecture Documentation Standards](#reference-architecture-documentation-standards)
<!-- </table-of-contents> -->

## Terraform Project Structure

### Terraform Module Structure

<!-- <example-terraform-component-structure> -->
```plain
modules/
  ai_foundry/                                        # MODULE
    main.tf                                          # Main orchestration
    agent_capability_host_connections.tf            # Resource-specific implementations
    agent_capability_host_connections.role_assignments.tf  # Resource-specific role assignments
    variables.tf                                     # Module variables with defaults
    outputs.tf                                       # Module outputs
    terraform.tf                                     # Provider requirements and versions
    README.md                                       # Module documentation
```
<!-- </example-terraform-component-structure> -->

### Terraform Module Files Organization

<!-- <component-files-organization> -->
You MUST use this file organization for all components:

1. `main.tf` - Primary resource definitions and orchestration
1. `main.<resource>.tf` - (Optional) Resource-specific implementations for complex modules
1. `variables.tf` - Component/internal module variables with defaults
1. `variables.core.tf` - (Optional) Core variables consistent across components
1. `variables.deps.tf` - (Optional) Dependencies from other components as objects
1. `variables.<module>.tf` - (Optional) Module-specific variables
1. `outputs.tf` - Outputs for use by other components/modules
1. `terraform.tf` - Required Terraform providers and versions
1. `locals.tf` - (Optional) Local values and computed expressions
1. `README.md` - Module documentation and usage examples
1. `SECURITY.md` - (Optional) Security considerations and guidelines
<!-- </component-files-organization> -->

#### Documentation Standards

All modules MUST include comprehensive documentation following these standards:

**README.md Requirements:**

- Module overview and purpose
- Feature list with key capabilities
- Basic and advanced usage examples with HCL code blocks
- Requirements table (Terraform version, providers)
- Providers table with versions
- Modules table (external dependencies)
- Resources table (created resources)
- Inputs table with descriptions, types, defaults, and required status
- Outputs table with descriptions
- Security considerations section
- Examples directory references
- Contributing guidelines reference

**SECURITY.md Requirements:**

- Security configuration overview
- Data protection measures (encryption at rest/transit)
- Network security controls (private endpoints, network ACLs)
- Authentication and authorization mechanisms
- Monitoring and auditing capabilities
- Compliance framework support
- Security best practices and recommendations
- Incident response procedures

**Documentation Examples:**

- Review existing module README.md files for comprehensive documentation structure examples
- Follow established patterns from other modules in the repository for consistency

### Terraform Reference Architecture Structure

<!-- <example-terraform-reference-architecture-structure> -->
```plain
reference_architectures/
  example_architecture/   # REFERENCE ARCHITECTURE
    main.tf               # Calls MODULE dependencies
    dependant_resources.tf # Dependent resource configurations
    variables.tf          # Architecture-specific variables
    outputs.tf            # Architecture outputs
    terraform.tf          # Provider requirements and versions
    terraform.tfvars      # Example variable values
    README.md            # Deployment instructions and architecture overview
    CHANGELOG.md         # Architecture change history
    images/              # Architecture diagrams
      architecture.drawio.svg
    tests/               # Architecture-specific tests
      acceptance/        # Acceptance test scenarios
      integration/       # Integration test scenarios
```
<!-- </example-terraform-reference-architecture-structure> -->

### Terraform Reference Architecture Files Organization

<!-- <reference-architecture-files-organization> -->
You MUST use this file organization for all reference architectures:

1. `main.tf` - Module orchestration and resource dependencies
1. `dependant_resources.tf` - (Optional) Dependent resource configurations
1. `variables.tf` - Architecture-specific variables and configuration
1. `outputs.tf` - Architecture outputs from constituent modules
1. `terraform.tf` - Provider requirements and versions (includes provider blocks)
1. `terraform.tfvars` - (Optional) Example variable values
1. `locals.tf` - (Optional) Local values and computed expressions
1. `README.md` - Deployment instructions and architecture overview
1. `CHANGELOG.md` - (Optional) Architecture change history
1. `images/` - (Optional) Architecture diagrams and visual documentation
1. `tests/` - Architecture-specific validation and testing
   - `acceptance/` - Acceptance test scenarios
   - `integration/` - Integration test scenarios
<!-- </reference-architecture-files-organization> -->

#### Reference Architecture Documentation Standards

All reference architectures MUST include documentation following these standards:

**README.md Requirements:**

- Architecture overview and purpose
- Component diagram and data flow
- Prerequisites and dependencies
- Deployment instructions (step-by-step)
- Configuration options and Terraform variables
- Security considerations and compliance
- Testing and validation procedures
- Troubleshooting common issues
- Resource cleanup instructions

**Variable Configuration:**

- All required Terraform variables with descriptions
- Optional variables with sensible defaults
- Security-sensitive variables clearly marked
- Example values in terraform.tfvars format

**Testing Standards:**

- Infrastructure validation tests
- Security compliance checks
- Integration testing procedures
- Performance baseline tests
