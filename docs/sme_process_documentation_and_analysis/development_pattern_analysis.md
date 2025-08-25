# CAIRA Development Pattern Analysis

## Authors: @jimmykurian, @ardnaxelarak, @tessmichi

---

## Overview

This analysis identifies and catalogs repeatable development patterns within CAIRA reference architecture creation, providing templates, decision matrices, and complexity scoring to enable effective Copilot instruction generation for pattern automation.

---

## 1. Catalog of Common Development Patterns and Variations

### 1.1 Deployment Architecture Patterns

#### Pattern: Three-Tier AI Foundry Deployment

**Variations**:

- **Basic Tier Pattern**
  - Public networking configuration
  - Microsoft-managed resources
  - Portal-based deployment
  - Default security settings

- **Enterprise Tier Pattern**
  - Network isolation implementation
  - BYOD (Bring Your Own Device) resource management
  - Infrastructure-as-Code deployment
  - Enhanced security configuration

- **Agent-Enabled Enterprise Pattern**
  - Full network isolation with agent service
  - Container apps environment integration
  - Subnet delegation requirements
  - Mandatory IaC implementation

#### Pattern: Capability Host Lifecycle Management

**Variations**:

- **Parent Capability Host Creation**
  - AI Foundry level implementation
  - Kind = "agents" configuration
  - Dependency ordering management

- **Child Capability Host Creation**
  - Project level implementation
  - Connection ID array management
  - Parent dependency validation

#### Pattern: Networking Configuration

**Variations**:

- **Basic Public Networking**
  - No custom VNet requirements
  - Default DNS configuration
  - Simplified subnet structure

- **Enterprise Private Networking**
  - Customer-provided VNet integration
  - Multiple subnet allocation (/27 agent, separate private endpoints)
  - Private DNS zone configuration
  - Subnet delegation to Microsoft.ContainerApps/environments

### 1.2 Resource Provisioning Patterns

#### Pattern: Core AI Foundry Component Setup

**Variations**:

- **Minimal Configuration**
  - AI Foundry Account creation
  - Basic project setup
  - Default connections

- **Enterprise Configuration**
  - AI Search integration
  - Cosmos DB setup (RU provisioning)
  - Storage Account with RBAC
  - App Insights with Log Analytics

#### Pattern: Identity and Security Configuration

**Variations**:

- **System-Assigned Managed Identity**
  - Customer Managed Key encryption support
  - Standard RBAC configuration

- **User-Assigned Managed Identity**
  - Additional configuration complexity
  - Specific scope requirements

## 2. Template Structures for Different Architecture Scenarios

Based on the three-tier deployment architecture defined in the CAIRA SME knowledge, each scenario requires specific components and configurations:

### 2.1 Tier 1: Basic AI Foundry Template Structure

**Scenario Characteristics** (from document):

- Target Users: "Customers who trust Microsoft defaults"
- Complexity: "Low"
- Portal Support: "Full portal support available"

**Required Components**:

```yaml
Core_AI_Foundry_Components:
  - AI Foundry Account (Cognitive services account, kind: AI services)
  - AI Foundry Projects (with GUID and human-friendly name)
  - App Insights (required at AI Foundry resource level)
  - Shared Connections (at AI Foundry level preferred)

Networking_Configuration:
  - Type: Public networking
  - DNS: Default Azure DNS
  - Private Endpoints: None required

Identity_Configuration:
  - Managed Identity: System-assigned (standard configuration)

Deployment_Method:
  - Portal: Fully supported
  - IaC: Optional (terraform/bicep available)
  - Timeline: "30 minutes from terraform apply to operational instance"
```

### 2.2 Tier 2: Enterprise AI Foundry Template Structure

**Scenario Characteristics**:

- Target Users: "Enterprise customers with security requirements"
- Approach: "BYOD (Bring Your Own Device) resource management"
- Complexity: "High"
- Portal Support: "Limited - basic isolation possible through portal"

**Required Components**:

```yaml
Customer_Provided_Prerequisites:
  - Virtual Network (customer VNet - never create within CAIRA modules)
  - Subnets:
    - Private endpoint subnet (separate from other subnets)
  - AI Search (vector stores for agent functionality)
  - Cosmos DB (thread storage - optional, provision throughput or serverless)
  - Storage Account (file uploads and agent data)
  - App Insights (depends on Log Analytics workspace)
  - Private DNS Zones (multiple zones for different service endpoints)

AI_Foundry_Configuration:
  - All Basic tier components
  - Network isolation enabled
  - RBAC configuration across multiple resource scopes
  - Service principal requirements for specific scopes

Security_Configuration:
  - Customer Managed Key encryption (requires system-assigned managed identities)
  - RBAC vs local auth configuration for Storage Account

Deployment_Method:
  - Portal: Limited support for basic isolation
  - IaC: Recommended (terraform/bicep)
  - Prerequisites: Significant networking setup required
```

### 2.3 Tier 3: Agent-Enabled Enterprise AI Foundry Template Structure

**Scenario Characteristics**:

- Target Users: "Enterprise customers requiring protected agents"
- Complexity: "Highest"
- Portal Support: "NONE - Infrastructure-as-Code mandatory"

**Required Components**:

```yaml
All_Enterprise_Prerequisites_Plus:
  - Container Apps Environment
  - Cosmos DB (REQUIRED for thread storage - not optional)
  - AI Search (REQUIRED for vector stores)

Agent_Specific_Networking:
  - Agent Subnet:
    - Minimum size: /27
    - Recommended size: /21 (production)
    - Delegation: Microsoft.ContainerApps/environments
    - Constraint: Cannot reuse for multiple AI Foundry instances
  - Private Endpoint Subnet (separate from agent subnet)
  - Multiple Private DNS Zones:
    - privatelink.cognitiveservices.azure.com
    - privatelink.openai.azure.com
    - privatelink.search.windows.net
    - privatelink.documents.azure.com
    - privatelink.blob.core.windows.net

Capability_Host_Configuration:
  - Parent Capability Host (AI Foundry level):
    - Kind: "agents" (required field)
    - Creation: IaC only (bicep/terraform)
    - Lifecycle: Cannot update in-place (destroy/recreate required)
  - Child Capability Hosts (Project level):
    - Connection IDs: Must pass as arrays
    - Dependency: Parent must exist first
    - Hierarchy: Strict ordering requirement

Regional_Constraints:
  - Class A Subnets: Limited regions, allowlisting required
    - Supported: West US, East US, East US 2, Central US, Japan East, France Central, Spain Central, UAE North
    - Contact: fosteramanda@microsoft.com for allowlisting
  - Class B/C Subnets: GA in all AI Foundry Agent Service regions

Deployment_Method:
  - Portal: NOT SUPPORTED
  - IaC: MANDATORY (bicep/terraform only)
  - Prerequisites: Container apps environment, subnet delegation
```

---

## 3. Code Generation Decision Matrices

### 3.1 Deployment Type Decision Matrix

| Customer Requirement   | Portal Possible | IaC Required  | Recommended Pattern      | Complexity |
|------------------------|-----------------|---------------|--------------------------|------------|
| Basic PoC/Development  | ✅ Yes           | ❌ No          | Basic Tier               | Low        |
| Network Isolation Only | ⚠️ Limited      | ✅ Yes         | Enterprise Tier          | Medium     |
| Protected Agents       | ❌ No            | ✅ Yes         | Agent-Enabled Enterprise | High       |
| Custom DNS             | ❌ No            | ✅ Yes         | Enterprise+              | High       |
| CMK Encryption         | ❌ No            | ✅ Yes         | Enterprise+              | Medium     |
| Multi-Project          | ✅ Yes           | ✅ Recommended | Any Tier                 | Low-High   |

### 3.2 Resource Selection Decision Matrix

| Scenario              | AI Search | Cosmos DB | Storage RBAC | App Insights | Container Apps |
|-----------------------|-----------|-----------|--------------|--------------|----------------|
| Basic Development     | Optional  | Optional  | Local Auth   | Required     | Not Supported  |
| Enterprise w/o Agents | Required  | Optional  | RBAC         | Required     | Not Required   |
| Enterprise w/ Agents  | Required  | Required  | RBAC         | Required     | Required       |
| Multi-Region          | Required  | Required  | RBAC         | Required     | Per Region     |

### 3.3 Networking Configuration Decision Matrix

| Network Requirement    | Subnet Count    | Subnet Sizes          | DNS Zones | Delegation Required       |
|------------------------|-----------------|-----------------------|-----------|---------------------------|
| Public Networking      | 0               | N/A                   | 0         | No                        |
| Private Endpoints Only | 1               | /28 minimum           | 5+        | No                        |
| Agent Service          | 2+              | /27 agent min, /28 PE | 5+        | Yes (ContainerApps)       |
| Multi-AI Foundry       | 2+ per instance | /21 agent recommended | Shared    | Yes (unique per instance) |

---

## 4. Pattern Complexity Scoring Matrix (ICI Framework)

Based on Hohpe & Woolf's Enterprise Integration Patterns, the Integration Complexity Index (ICI) quantifies pattern complexity through integration points, data transformations, protocol transitions, and asynchronous operations.

**ICI Formula**: Integration Points + (Data Transformations × 2) + (Protocol Transitions × 2) + (Async Operations × 3)

| Pattern                      | Integration Points | Data Transforms | Protocol Transitions | Async Operations | ICI Score | Automation Feasibility |
|------------------------------|--------------------|-----------------|----------------------|------------------|-----------|------------------------|
| Basic AI Foundry Setup       | 2                  | 0               | 0                    | 0                | **2**     | Full Automation        |
| Multi-Project Setup          | 3                  | 1               | 0                    | 0                | **5**     | Full Automation        |
| RBAC Configuration           | 5                  | 1               | 0                    | 1                | **10**    | High Automation        |
| CMK Encryption               | 4                  | 2               | 1                    | 1                | **13**    | Semi-Automation        |
| Enterprise Network Isolation | 6                  | 2               | 3                    | 1                | **19**    | Semi-Automation        |
| Capability Host Lifecycle    | 6                  | 3               | 2                    | 2                | **22**    | Guided Assistance      |
| Agent Service Configuration  | 9                  | 4               | 5                    | 3                | **36**    | Expert Guidance        |

**Automation Feasibility Thresholds**:

- **Full Automation** (ICI 0-5): Direct template deployment, no user intervention
- **High Automation** (ICI 6-12): Template with validation checkpoints
- **Semi-Automation** (ICI 13-20): Multi-stage with user confirmation gates
- **Guided Assistance** (ICI 21-30): Step-by-step manual execution with guidance
- **Expert Guidance** (ICI 31+): Complex manual implementation with expert support

### 4.1 Key Complexity Drivers

**Integration Points** (1x multiplier):

- Each external service or resource that must be connected
- Example: Agent Service requires 9 integrations (VNet, Subnets, Container Apps, Cosmos DB, AI Search, Storage, DNS, Capability Hosts, Projects)

**Data Transformations** (2x multiplier):

- Format changes, mappings, or conversions required
- Example: Connection IDs must be transformed to arrays for capability hosts

**Protocol Transitions** (2x multiplier):

- Changes in communication protocols or deployment methods
- Example: Portal → IaC mandatory for agent-enabled scenarios

**Async Operations** (3x multiplier):

- Operations requiring wait states or eventual consistency
- Example: Capability host destroy/recreate cycles, DNS propagation

### 4.2 Automation Priority Recommendations

**Priority 1 - Immediate Automation** (ICI ≤ 12):

- Basic AI Foundry Setup (2)
- Multi-Project Setup (5)
- RBAC Configuration (10)

**Priority 2 - Phased Automation** (ICI 13-20):

- CMK Encryption (13)
- Enterprise Network Isolation (19)

**Priority 3 - Guided Implementation** (ICI > 20):

- Capability Host Lifecycle (22)
- Agent Service Configuration (36)

---

## 5. Implementation Recommendations

### 5.1 Copilot Instruction Generation Strategy

1. **Pattern Recognition Phase**
   - Analyze user requirements against decision matrices
   - Identify matching patterns from catalog
   - Select appropriate template structure

1. **Complexity Assessment Phase**
   - Calculate complexity score
   - Determine automation feasibility
   - Select appropriate Copilot strategy

1. **Code Generation Phase**
   - Apply selected template
   - Inject customer-specific variables

1. **Validation Phase**
   - Check dependency requirements
   - Validate networking constraints
   - Ensure security compliance

### 5.2 Key Success Factors

- **Clear Scenario Separation**: Maintain distinct paths for basic vs enterprise implementations
- **Infrastructure Maturity Assessment**: Evaluate customer IaC readiness early
- **Networking Prerequisites**: Document and validate networking requirements upfront
- **Lifecycle Management**: Implement proper destroy/recreate patterns for capability hosts
- **Documentation Quality**: Address scattered PG documentation through consolidated guidance

---

## Conclusion

```Text
// TODO
```

**Next Steps**:

1. Implement Priority 1 automation patterns in Copilot instructions
1. Develop validation frameworks for medium-complexity patterns
1. Create expert guidance documentation for low-automation patterns
1. Establish feedback loops for continuous pattern refinement

---

*Analysis completed: 8/26/2025*
*Based on CAIRA SME Knowledge Guide and domain expertise from @cmaclaughlin*
