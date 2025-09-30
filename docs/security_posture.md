<!-- META
title: CAIRA Security Posture
description: Explains the security decisions made in CAIRA reference architectures, balancing ease of deployment with security best practices.
author: CAIRA Team
ms.date: 09/25/2025
ms.topic: concept
estimated_reading_time: 8
keywords:
   - security
   - deployment
   - best practices
   - terraform
   - azure security
   - reference architecture
   - security posture
-->

# CAIRA Security Posture

## Overview

CAIRA (Composable AI Reference Architecture) is designed as an **accelerator** and **learning platform** that prioritizes ease of deployment while maintaining reasonable security standards. The security decisions made in CAIRA reference architectures reflect a deliberate balance between deployment simplicity and security best practices, with the understanding that **production deployments will require additional security hardening beyond what is provided out-of-the-box**.

## Security Philosophy

### Accelerator-First Approach

CAIRA's primary goal is to **accelerate time-to-value** for teams getting started with Azure AI workloads. This philosophy influences our security approach in the following ways:

1. **Lower Barriers to Entry**: We choose configurations that minimize setup complexity and reduce the likelihood of deployment failures
1. **Educational Value**: Security settings are implemented to demonstrate patterns while remaining comprehensible to teams new to Azure AI
1. **Iterative Hardening**: The baseline provides a secure foundation that teams can incrementally harden for their specific production requirements

### Security by Design, Not Security by Default

While CAIRA implements security-conscious defaults, it does not implement the most restrictive security posture possible. Instead, it provides:

- **Secure Baseline**: Core security principles are followed (encryption at rest, TLS in transit, RBAC where appropriate)
- **Extensible Foundation**: Architecture supports additional security controls without requiring fundamental redesign
- **Clear Upgrade Path**: Documentation and structure guide teams toward production-ready security configurations

## Key Security Decisions

### 1. Resource Deletion and Cleanup

**Decision**: Resource groups and cognitive accounts are configured to allow easy cleanup during development.

```terraform
provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
  }
}
```

**Rationale**:

- **Development-Friendly**: Enables quick teardown and rebuild cycles essential for experimentation
- **Cost Management**: Prevents orphaned resources that continue accruing charges
- **Learning Environment**: Reduces friction when teams need to start over

**Production Considerations**:

- Set `prevent_deletion_if_contains_resources = true` for production environments
- Implement proper backup and disaster recovery procedures before disabling soft delete protections
- Consider using separate resource groups for different environment tiers

### 2. Network Access Patterns

**Decision**: CAIRA provides both public and private network access patterns depending on the reference architecture.

**Public Access Architectures**:

- AI Foundry resources accessible via public endpoints with Azure AD authentication
- Simplified networking reduces deployment complexity
- Suitable for development and proof-of-concept scenarios

**Private Access Architectures**:

- All services configured with `public_network_access_enabled = false`
- Private endpoints and private DNS zones implemented
- Virtual network isolation for sensitive workloads

**Rationale**:

- **Choice and Flexibility**: Teams can select the appropriate network posture for their use case.
- **Progressive Security**: Teams can start with public access and migrate to private endpoints as requirements mature.
- **Production-First Mindset**: Both patterns reflect legitimate enterprise scenarios, but persistent environments (dev, staging, production) should use private networking for enhanced security.

**Production Considerations**:

- Use private endpoint architectures for production workloads containing sensitive data
- Implement network security groups with restrictive rules
- Consider hub-and-spoke network topologies for enterprise deployments

### 3. Authentication and Authorization

**Decision**: CAIRA implements Azure AD-based authentication with minimal custom RBAC configuration.

**Implementation Pattern**:

#### Storage accounts use Azure AD authentication

storage_use_azuread = true

#### Cosmos DB disables local authentication

local_authentication_disabled = true

**Rationale**:

- **Modern Authentication**: Leverages Azure AD as the authoritative identity provider
- **Reduced Secret Management**: Minimizes the number of API keys and connection strings to manage
- **Compatibility**: Maintains compatibility with existing applications that may require API key access patterns

**Production Considerations**:

- Disable API key authentication where possible (`disableLocalAuth = true`)
- Implement comprehensive RBAC with principle of least privilege
- Consider using managed identities for all service-to-service authentication
- Implement conditional access policies and multi-factor authentication

### 4. Encryption and Data Protection

**Decision**: CAIRA implements standard Azure encryption capabilities without additional customer-managed keys.

**Implementation**:

- **Storage**: TLS 1.2 minimum, HTTPS traffic only, infrastructure encryption available but not enabled by default
- **Cosmos DB**: Encryption at rest using service-managed keys
- **AI Services**: Standard Azure encryption for data in transit and at rest

**Rationale**:

- **Sufficient for Development**: Service-managed encryption meets security requirements for non-production workloads
- **Reduced Complexity**: Avoids Key Vault dependencies and key rotation complexity
- **Cost Optimization**: Customer-managed keys incur additional costs that may not be justified for development scenarios

**Production Considerations**:

- Implement customer-managed keys (CMK) for sensitive production data
- Enable infrastructure encryption for storage accounts
- Consider additional encryption for data in use scenarios
- Implement proper key rotation and access policies

## What CAIRA Does NOT Include

### Security Controls for Production Workloads

CAIRA reference architectures are **intentionally minimal** and do not include many security controls that would be expected in production environments:

1. **Network Security**:
   - No network security groups (NSGs) with restrictive rules
   - No Azure Firewall or Web Application Firewall (WAF)
   - No DDoS protection standard
   - No network traffic inspection or monitoring

1. **Identity and Access Management**:
   - Limited custom RBAC role definitions
   - No conditional access policy enforcement
   - No privileged identity management (PIM)
   - No identity governance and lifecycle management

1. **Monitoring and Compliance**:
   - Basic Application Insights configuration without custom alerts
   - No Azure Security Center / Microsoft Defender for Cloud integration
   - No compliance framework alignment (SOC, PCI, FedRAMP, etc.)
   - No automated security scanning or vulnerability management

1. **Data Protection**:
   - No data loss prevention (DLP) policies
   - No advanced threat protection for databases
   - No backup and disaster recovery automation
   - No data residency and sovereignty controls

1. **Operational Security**:
   - No automated patch management
   - No security information and event management (SIEM) integration
   - No incident response automation
   - No security baseline compliance monitoring

## Security Best Practices Recommendations

### For Production Deployments

Teams using CAIRA as a foundation for production systems should implement additional security measures:

1. **Network Security**:

   ```terraform
   # Example: Restrictive NSG rules
   resource "azurerm_network_security_group" "example" {
     # Implement deny-by-default with explicit allow rules
     # Add logging for security events
     # Consider micro-segmentation strategies
   }
   ```

1. **Advanced Identity Controls**:
   - Implement custom RBAC roles with minimal required permissions
   - Use managed identities for all service-to-service authentication
   - Enable Azure AD Privileged Identity Management for administrative access
   - Implement conditional access policies based on risk factors

1. **Compliance and Governance**:
   - Enable Azure Policy for automated compliance checking
   - Implement resource tagging strategies for cost and security governance
   - Enable Azure Security Center recommendations and secure score monitoring

1. **Data Protection**:
   - Implement customer-managed keys for encryption at rest
   - Enable database auditing and threat detection
   - Configure backup policies with appropriate retention periods
   - Implement data classification and handling procedures

### Security Assessment and Monitoring

Before deploying CAIRA-based solutions in production:

1. **Security Assessment**:
   - Conduct threat modeling exercises for your specific use case
   - Perform penetration testing on deployed infrastructure
   - Review and validate all security configurations against your organization's policies
   - Document security assumptions and risk acceptances

1. **Continuous Monitoring**:
   - Implement security information and event management (SIEM) solutions
   - Enable Azure Monitor and Azure Security Center for centralized monitoring
   - Configure automated alerting for security events and policy violations
   - Establish incident response procedures and contact information

## Conclusion

CAIRA provides a **secure foundation** rather than a **production-ready security posture**. The reference architectures implement industry-standard security practices while prioritizing simplicity and ease of deployment. Teams should view CAIRA as a starting point for their security journey, with the expectation that additional hardening will be required based on their specific threat model, compliance requirements, and organizational policies.

The security decisions in CAIRA are intentionally **transparent and documented** to help teams understand the trade-offs and make informed decisions about additional security controls needed for their specific use cases. We encourage teams to engage with their security professionals early in the adoption process to identify and implement appropriate additional controls.

For questions about security implementations or to report security vulnerabilities, please refer to our [Security Policy](https://github.com/microsoft/CAIRA/blob/main/SECURITY.md).
