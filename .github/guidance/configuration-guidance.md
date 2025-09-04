---
description: 'Delivers authoritative configuration guidance for CAIRA reference architectures, ensuring alignment with Azure AI Foundry deployment best practices, validated parameters, and secure, compliant dependency management tailored to user requirements'
---

# CAIRA Configuration Guidance

This doc provides configuration guidance for CAIRA (Composable AI Reference Architecture), covering parameter validation, dependency management, and secure deployment configurations for Azure AI Foundry workloads

## CAIRA Configuration Context

**Reference Architectures:**

- **ALWAYS present ALL available architectures** and **explicitly ask the user to choose** before providing configuration guidance
- Dynamically discover available architectures from the `reference_architectures/` directory
- Each architecture contains its own README.md with complete configuration details and use cases
- **CRITICAL**: Wait for user confirmation of architecture selection before proceeding with parameter guidance
- Review architecture-specific variables.tf files for parameter requirements and validation rules
- Check architecture outputs.tf files for available configuration outputs

**Key Configuration Areas:**

- **AI Foundry Core**: Resource naming, SKU selection, model deployments
- **Security & Access**: RBAC assignments, managed identities, authentication
- **Networking**: Public vs private endpoints, VNet integration
- **Dependencies**: Storage, Key Vault, Cosmos DB, AI Search connections
- **Monitoring**: Log Analytics, Application Insights integration

## Dependency Configuration & Validation

**Dependency Analysis Process:**

1. **Identify Resource Dependencies**

   - Map all required Azure services and their relationships
   - Determine dependency ordering and creation sequence
   - Validate cross-module dependencies and data flows

1. **Validate Dependency Compatibility**

   - **MANDATORY USER CONFIRMATION**: Before proceeding with dependency validation, **explicitly ask the user to confirm the dependency scope and configuration choices**
   - Check SKU and tier compatibility between dependent resources
   - Verify network connectivity requirements (public/private endpoints)
   - Ensure authentication methods align across dependencies

1. **Configuration Validation Steps**
   - Validate connection strings and endpoint configurations
   - Check RBAC assignments for service-to-service authentication
   - Verify resource locations and regional availability

**Common Dependency Patterns:**

- **AI Foundry → Storage Account**: Model artifacts, datasets, logs
- **AI Foundry → Key Vault**: API keys, connection strings, certificates
- **AI Foundry → Cosmos DB**: Vector storage, metadata persistence
- **AI Foundry → AI Search**: Knowledge base, document indexing
- **All Services → Log Analytics**: Centralized monitoring and diagnostics

**Dependency Validation Rules:**

- **Location Consistency**: All dependent resources must be in compatible regions
- **Network Access**: Ensure firewall rules and private endpoint configurations allow service communication
- **Authentication Flow**: Managed identities must have appropriate role assignments across all dependencies
- **Version Compatibility**: API versions and service tiers must support required features
- **Circular Dependencies**: Detect and resolve circular dependency chains in Terraform modules

## Inter-Module Dependency Management

**When validating module dependencies:**

1. **Check Module Outputs**: Verify required outputs are available from dependency modules
1. **Validate Input References**: Ensure module inputs correctly reference dependency outputs
1. **Test Dependency Resolution**: Confirm Terraform can resolve dependency graphs without conflicts
1. **Version Pinning**: Use exact module versions to ensure consistent dependency behavior

## Response Format

**Structure every configuration response with:**

## [Configuration Topic]

### Required Parameters

[Core parameters with examples]

### Optional Parameters

[Additional configuration options]

### Configuration Examples

[Working code snippets]

### Key Considerations

[Important relationships and constraints]

## Auto-Validation Triggers

**Automatically validate when users ask about:**

- **Architecture selection or configuration differences**: **ALWAYS present options and wait for user confirmation**
- Parameter requirements or valid values: **Confirm parameter scope before providing validation**
- Architecture selection or differences
- Environment-specific configurations
- Model deployments or versions
- RBAC or security settings
- SKU recommendations or constraints
- Dependency relationships and compatibility
- Resource connectivity and network access
- Cross-module dependencies and outputs
- Service authentication and authorization flows

## Security & Compliance Defaults

- RBAC enabled by default
- Managed identities for service-to-service authentication
- Local authentication disabled where possible
- Resource tagging for governance
- Audit logging through Log Analytics
- Azure Verified Module (AVM) compliance patterns
