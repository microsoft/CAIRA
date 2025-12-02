# CAIRA Kata Series Proposal

## Series Overview

This kata series provides a complete learning path from CAIRA beginner to production-ready deployment expert. The series is designed to build progressively, with each kata introducing new concepts while reinforcing previous learning.

**Total Series Time**: 6-7 hours of focused practice
**Target Audience**: Cloud engineers, DevOps professionals, AI platform engineers
**Prerequisites**: Basic Azure knowledge, familiarity with terminal/CLI

---

## Foundation Track: Build Foundation (2 hours)

### Kata 100: Gathering Requirements with CAIRA Assistant ✅
**Status**: EXISTS in microsoft/CAIRA repository
**Difficulty**: ⭐ Foundation (Level 1)
**Time**: 30 minutes
**File**: `100-gathering-requirements-with-caira-assistant.md`

**What Learners Will Do**:
- Activate and use the CAIRA Assistant chatmode in VS Code
- Ask effective requirements-gathering questions to understand business needs
- Analyze different business scenarios (POC, production, enterprise compliance)
- Match business requirements to CAIRA architecture choices
- Document architecture recommendations with clear justifications

**Learning Objectives**:
- Understand the four CAIRA reference architectures
- Use AI assistance for architecture decision-making
- Translate business requirements into technical architecture choices
- Document recommendations clearly and professionally

**Real-World Context**: You're consulting for a customer service team building an AI chatbot. They need production-level security, agent capabilities for knowledge retrieval, and GDPR compliance. Use CAIRA Assistant to determine the right architecture.

**Key Skills**: Requirements gathering, architecture selection, AI chatmode usage, technical documentation

**Prerequisites**: None - perfect starting point

**Success Criteria**:
- Completed requirements conversation with CAIRA Assistant
- Documented architecture recommendation with justification
- Can explain when to use each CAIRA architecture
- Understands trade-offs between basic and standard variants

---

### Kata 150: Understanding CAIRA Architecture Patterns
**Status**: NEW - To Be Created
**Difficulty**: ⭐ Foundation (Level 1)
**Time**: 30 minutes
**File**: `150-understanding-caira-architecture-patterns.md`

**What Learners Will Do**:
- Explore CAIRA reference architecture documentation systematically
- Compare resources deployed in basic vs standard architectures
- Analyze public vs private networking implications
- Fill out architecture comparison matrix with key differences
- Match 5 different business scenarios to appropriate architectures
- Calculate estimated costs for different architecture choices
- Use CAIRA Assistant to validate architecture understanding

**Learning Objectives**:
- Explain differences between all 4 CAIRA architectures in own words
- List resources included in each architecture from memory
- Understand when Azure AI Agent Service requires standard architecture
- Recognize cost implications of architecture choices
- Make informed architecture decisions based on requirements

**Real-World Scenarios**:
1. **Startup POC**: $200/month budget, public endpoints acceptable, no agent features needed
2. **Enterprise Chatbot**: Agent-based knowledge retrieval, private networking required, compliance needs
3. **Internal Developer Tool**: Standard features needed, no network isolation, moderate budget
4. **Healthcare AI**: HIPAA considerations, complete isolation, agent capabilities, audit logging
5. **Multi-National Deployment**: Data residency requirements, high availability, cost optimization

**Key Skills**: Architecture analysis, cost estimation, requirements mapping, decision documentation

**Prerequisites**:
- Completed Kata 100 (Gathering Requirements)
- Basic understanding of cloud infrastructure concepts

**Success Criteria**:
- Can name all 4 architectures and their primary use cases
- Completed architecture comparison matrix with accuracy
- Successfully matched all 5 scenarios to correct architectures
- Can explain basic vs standard resource differences
- Understands public vs private networking trade-offs

**Technologies**: CAIRA, Azure AI Foundry, Terraform (conceptual understanding)

---

### Kata 200: Deploying Your First CAIRA Architecture
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐ Skill (Level 2)
**Time**: 45 minutes
**File**: `200-deploying-first-caira-architecture.md`

**What Learners Will Do**:
- Clone the CAIRA repository and navigate to foundry_basic
- Configure Azure authentication and verify permissions
- Initialize Terraform workspace with required providers
- Review and customize basic terraform.tfvars file
- Execute terraform plan to preview infrastructure changes
- Deploy foundry_basic architecture end-to-end
- Validate resources in Azure Portal (AI Foundry, Resource Group, managed identities)
- Test deployment by accessing AI Foundry portal
- Deploy a simple GPT-4o model using Azure portal
- Clean up resources after validation

**Learning Objectives**:
- Execute complete Terraform deployment workflow (init → plan → apply)
- Understand CAIRA deployment prerequisites and permissions
- Validate successful infrastructure deployment
- Navigate Azure AI Foundry resources
- Perform basic cleanup and resource management

**Real-World Context**: Your team needs a development environment for AI experimentation. You've been tasked with deploying a foundry_basic architecture to Azure for proof-of-concept work. The environment needs to be operational within 1 hour and include a GPT-4o model deployment for initial testing.

**Key Skills**: Terraform workflow, Azure authentication, infrastructure validation, AI Foundry basics, resource cleanup

**Prerequisites**:
- Completed Kata 200 (Understanding Architecture Patterns)
- Azure subscription with Contributor + User Access Administrator roles
- VS Code with CAIRA repository cloned
- Azure CLI installed and configured

**Success Criteria**:
- Terraform successfully initialized without errors
- Infrastructure deployed with all resources created
- Can access Azure AI Foundry portal and view deployed resources
- GPT-4o model deployed and accessible
- All resources cleaned up (terraform destroy executed)
- Can explain each step of the deployment workflow

**Technologies**: Terraform, Azure CLI, Azure AI Foundry, CAIRA foundry_basic

**Common Pitfalls**:
- Insufficient Azure permissions (need both Contributor and User Access Administrator)
- Missing provider authentication configuration
- Resource naming conflicts (globally unique names required)
- Forgetting to run terraform init before plan/apply

---

## Skill Track: Build Proficiency (2.5 hours)

### Kata 250: Deploying CAIRA Standard Architecture
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐ Skill (Level 3)
**Time**: 45 minutes
**File**: `250-deploying-caira-standard-architecture.md`

**What Learners Will Do**:
- Review foundry_standard architecture documentation and resource list
- Understand additional resources: Cosmos DB, Azure Storage, AI Search
- Configure terraform.tfvars for standard deployment with custom values
- Deploy foundry_standard architecture end-to-end
- Validate agent-specific resources in Azure Portal
- Verify Azure AI Agent Service capability host connections
- Test knowledge retrieval using AI Search integration
- Upload sample documents to Azure Storage for RAG testing
- Query Cosmos DB to verify thread storage configuration
- Document architecture components and their integrations
- Clean up standard architecture resources

**Learning Objectives**:
- Deploy and validate complex multi-service CAIRA architecture
- Understand Azure AI Agent Service infrastructure requirements
- Configure RAG (Retrieval Augmented Generation) components
- Validate service integrations and capability host connections
- Manage more complex Terraform deployments

**Real-World Context**: Your customer service team is ready to move from POC to production AI agent deployment. They need full agent capabilities including knowledge retrieval from company documentation, conversation thread persistence, and document search. Deploy foundry_standard to support these agent features.

**Key Skills**: Multi-service deployment, agent architecture understanding, RAG configuration, service integration validation, production readiness assessment

**Prerequisites**:
- Completed Kata 300 (First CAIRA Deployment)
- Understanding of Azure AI Agent Service concepts
- Familiarity with RAG patterns (recommended)
- Azure subscription with sufficient quota for all services

**Success Criteria**:
- Standard architecture deployed with all 7+ services operational
- Cosmos DB, Storage, and AI Search verified and accessible
- Capability host connections validated in AI Foundry portal
- Sample documents uploaded and searchable
- Thread persistence verified in Cosmos DB
- Can explain the role of each agent-supporting service
- Successfully cleaned up all standard resources

**Technologies**: CAIRA foundry_standard, Azure AI Foundry, Cosmos DB, Azure AI Search, Azure Storage, Azure Monitor

**Common Pitfalls**:
- AI Search SKU quota limitations in subscription
- Cosmos DB connection string configuration errors
- Storage account firewall rules blocking access
- Missing service endpoint configurations

---

### Kata 300: Troubleshooting CAIRA Deployments
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐ Advanced (Level 3)
**Time**: 45 minutes
**File**: `300-troubleshooting-caira-deployments.md`

**What Learners Will Do**:
- Diagnose authentication and permission errors in Terraform output
- Resolve resource quota exceeded errors by checking subscription limits
- Fix naming conflicts for globally unique resources (storage accounts)
- Troubleshoot provider version compatibility issues
- Debug state file locking problems in multi-user scenarios
- Resolve resource dependency ordering errors
- Use Azure Activity Log to investigate deployment failures
- Interpret Terraform error messages and trace root causes
- Apply fixes using targeted terraform apply commands
- Document troubleshooting steps and solutions
- Implement preventive measures to avoid common issues

**Learning Objectives**:
- Read and interpret Terraform error messages effectively
- Diagnose Azure permission and quota issues
- Resolve state management and locking conflicts
- Use Azure diagnostic tools for infrastructure troubleshooting
- Apply targeted fixes without full redeployment
- Build troubleshooting methodology and documentation habits

**Real-World Scenarios**:
1. **Permission Denied**: Deployment fails with "insufficient privileges" - diagnose RBAC requirements
2. **Quota Exceeded**: AI Search deployment fails due to subscription limits - investigate and request increase
3. **Name Conflict**: Storage account name already exists - implement unique naming strategy
4. **State Locked**: Another team member's terraform process locked state - resolve safely
5. **Dependency Error**: Resources fail due to incorrect dependency ordering - identify and fix
6. **Provider Mismatch**: Version incompatibility between providers - resolve version constraints

**Key Skills**: Terraform debugging, Azure diagnostics, error analysis, root cause investigation, documentation

**Prerequisites**:
- Completed Kata 300 or 400 (either deployment kata)
- Experience with at least one failed deployment (real or simulated)
- Access to Azure Portal and Activity Logs

**Success Criteria**:
- Successfully diagnosed and resolved all 6 troubleshooting scenarios
- Can read Terraform error messages and identify root causes
- Knows where to find Azure diagnostic information
- Built personal troubleshooting checklist
- Documented solutions for future reference
- Can explain prevention strategies for each issue type

**Technologies**: Terraform, Azure CLI, Azure Portal diagnostics, CAIRA (any architecture)

**Common Pitfalls**:
- Rushing to fix without understanding root cause
- Not checking Azure Activity Logs for detailed error information
- Attempting terraform apply again without addressing underlying issue
- Modifying state file directly (dangerous!)

---

### Kata 350: Validating and Testing CAIRA Deployments
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐ Advanced (Level 3)
**Time**: 30 minutes
**File**: `350-validating-testing-caira-deployments.md`

**What Learners Will Do**:
- Create systematic validation checklist for CAIRA deployments
- Verify all expected resources exist in Azure Portal
- Test connectivity to deployed services (AI Foundry, AI Search, Cosmos DB)
- Validate RBAC assignments and managed identity permissions
- Perform smoke test with model deployment and inference
- Check resource tags and naming conventions compliance
- Verify network configurations (public endpoints or private links)
- Test disaster recovery readiness (backup configurations)
- Run integration tests for agent capability connections
- Document validation results and any discrepancies
- Create reusable validation scripts for future deployments

**Learning Objectives**:
- Build systematic deployment validation methodology
- Test infrastructure components independently and integrated
- Verify security and compliance configurations
- Automate validation checks where possible
- Document validation procedures for team use

**Real-World Context**: Before handing off the CAIRA deployment to the application team, you need to validate that all infrastructure is correctly configured, secure, and operational. Create a comprehensive validation suite that future deployments can use as a quality gate.

**Key Skills**: Infrastructure testing, validation scripting, compliance verification, documentation

**Prerequisites**:
- Completed Kata 400 (Standard Deployment)
- Deployed CAIRA infrastructure (any architecture)
- Basic understanding of Azure CLI or PowerShell

**Success Criteria**:
- Created comprehensive validation checklist (15+ items)
- All infrastructure components validated and operational
- RBAC and security configurations verified
- Integration tests passed for agent capabilities
- Validation script created for automation
- Documentation ready for team knowledge base

**Technologies**: Azure CLI, PowerShell, Azure Portal, CAIRA, bash scripting

---

## Expert Track: Production Readiness (2.5 hours)

### Kata 400: Customizing CAIRA for Your Requirements
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐⭐ Expert (Level 4)
**Time**: 45 minutes
**File**: `400-customizing-caira-requirements.md`

**What Learners Will Do**:
- Analyze organizational requirements for naming, tagging, and governance
- Customize terraform.tfvars with specific naming conventions and prefixes
- Override default SKUs for AI Search and other services (performance tuning)
- Add custom tags for cost tracking, department allocation, and compliance
- Configure optional features like Application Insights integration
- Modify location settings for data residency requirements (Canada Central example)
- Document customization decisions with rationale and impact analysis
- Validate customizations don't break CAIRA module contracts
- Test customized deployment in non-production environment
- Create customization template for future deployments
- Review customizations against Azure Well-Architected Framework

**Learning Objectives**:
- Safely customize CAIRA while maintaining module integrity
- Implement organizational governance requirements
- Balance customization with maintainability
- Document infrastructure-as-code decisions effectively
- Understand CAIRA module variable contracts and boundaries

**Real-World Context**: Your organization has specific requirements: resources must deploy to Canada Central for data residency, follow "proj-env-service-####" naming convention, include cost center tags (CC-12345), use Premium AI Search tier for production performance, and integrate with existing Application Insights workspace for centralized monitoring.

**Key Skills**: Variable management, governance implementation, naming conventions, tagging strategies, documentation

**Prerequisites**:
- Completed Kata 400 (Standard Deployment)
- Understanding of organizational governance requirements
- Familiarity with Terraform variable precedence

**Success Criteria**:
- All customizations implemented according to requirements
- Resources deployed with correct naming and tagging
- Data residency requirement met (Canada Central)
- Performance settings validated (Premium AI Search)
- Customization decisions documented with rationale
- Deployment validated without module contract violations
- Reusable customization template created

**Technologies**: Terraform, CAIRA, Azure governance, tagging frameworks

**Common Pitfalls**:
- Overriding variables that break module dependencies
- Creating naming conventions that violate Azure length limits
- Forgetting to document why customizations were made
- Not testing customizations before production deployment

---

### Kata 450: Securing CAIRA for Production
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐⭐ Expert (Level 4)
**Time**: 45 minutes
**File**: `450-securing-caira-production.md`

**What Learners Will Do**:
- Deploy foundry_standard_private architecture with complete network isolation
- Configure private endpoints for all Azure services
- Implement managed identities and disable API key authentication
- Set up RBAC with least-privilege access principles
- Configure virtual network and subnet security rules
- Enable encryption settings and Azure Key Vault integration
- Review security posture against Azure Security Benchmark
- Configure network security groups (NSGs) for traffic control
- Implement diagnostic logging for security audit trails
- Document security decisions in ADR (Architecture Decision Record) format
- Validate security configuration with Azure Advisor recommendations
- Create security hardening checklist for production deployments

**Learning Objectives**:
- Deploy and configure private networking for AI infrastructure
- Implement zero-trust security principles
- Configure identity and access management for production
- Document security architecture decisions formally
- Validate compliance with security frameworks

**Real-World Context**: Your enterprise security team requires all AI infrastructure to follow zero-trust principles for healthcare data (HIPAA considerations). Deploy foundry_standard_private with: no public endpoints, managed identities only (no API keys), complete network isolation, encryption at rest and in transit, least-privilege RBAC, and comprehensive audit logging. Document all security decisions for compliance review.

**Key Skills**: Private networking, identity management, security hardening, compliance awareness, ADR documentation

**Prerequisites**:
- Completed Kata 400 (Standard Deployment)
- Understanding of Azure networking fundamentals
- Familiarity with zero-trust security principles
- ADR template knowledge (recommended)

**Success Criteria**:
- Private architecture deployed with no public endpoints
- All services using private endpoints and managed identities
- API key authentication disabled across all services
- RBAC configured with least-privilege assignments
- Network security groups properly configured
- Encryption validated for data at rest and in transit
- Security posture reviewed against Azure Security Benchmark
- ADR document completed with security decisions and rationale
- Security hardening checklist created for future use

**Technologies**: CAIRA foundry_standard_private, Azure Private Link, Managed Identities, RBAC, NSGs, Azure Key Vault, ADR templates

**Common Pitfalls**:
- Forgetting to configure private DNS zones for private endpoints
- Overly permissive RBAC assignments
- Not documenting security trade-offs and decisions
- Incomplete private endpoint coverage (missing a service)

---

### Kata 500: Managing CAIRA Infrastructure Lifecycle
**Status**: NEW - To Be Created
**Difficulty**: ⭐⭐⭐⭐⭐ Legendary (Level 5)
**Time**: 45 minutes
**File**: `500-managing-caira-lifecycle.md`

**What Learners Will Do**:
- Update existing CAIRA deployment with new variable values (tags, SKUs)
- Add new resources to deployed environment using Terraform
- Use terraform plan to preview changes before applying updates
- Handle Terraform state file management and remote state configuration
- Resolve state locking scenarios in team collaboration contexts
- Perform controlled resource tear-down with terraform destroy
- Implement backup and restore procedures for Terraform state
- Add lifecycle management tags for resource governance
- Update model deployments and AI service configurations
- Document upgrade and maintenance procedures
- Create runbook for infrastructure refresh and updates
- Plan for environment decommissioning with data preservation

**Learning Objectives**:
- Manage infrastructure changes safely using Terraform workflow
- Handle state management and team collaboration scenarios
- Execute controlled updates without service disruption
- Implement backup and disaster recovery for IaC state
- Document operational procedures for infrastructure lifecycle

**Real-World Context**: Your CAIRA deployment has been running for 3 months. You need to: add a new GPT-4o model deployment, upgrade AI Search from Basic to Standard tier, update cost center tags for new fiscal year allocation, add Application Insights integration for better monitoring, and eventually plan for quarterly environment refresh while preserving trained model data and conversation history.

**Key Skills**: Terraform state management, change planning, safe updates, backup/restore procedures, operational documentation

**Prerequisites**:
- Completed Kata 700 or 800 (Customization or Security)
- Existing CAIRA deployment (at least 1 week old preferred)
- Understanding of Terraform state concepts
- Experience with production infrastructure management (helpful)

**Success Criteria**:
- Successfully updated deployment without disruption
- Added new resources using Terraform workflow
- Implemented remote state storage with locking
- Backed up and restored state file successfully
- Updated tags and SKUs without recreating resources
- Created infrastructure update runbook
- Documented decommissioning procedures
- Can explain safe infrastructure change management

**Technologies**: Terraform, Azure Storage (remote state), CAIRA, Azure CLI, Git (for state backup)

**Common Pitfalls**:
- Not running terraform plan before apply (preview changes!)
- Modifying state file directly instead of using Terraform commands
- Not backing up state before major changes
- Forcing unlock without verifying safety
- Deleting resources without considering data preservation

---

### Learning Path Progression

**Foundation Path** (for new CAIRA users):
1. Kata 100 → Kata 150 → Kata 200

**Standard Feature Path** (for agent capabilities):
1. Kata 100 → Kata 150 → Kata 200 → Kata 250 → Kata 350

**Troubleshooting Focus**:
1. Kata 200 or 250 → Kata 300 (when issues arise)

**Production Readiness Path** (complete series):
1. Kata 100 → 150 → 200 → 250 → 300 → 350 → 400 → 450 → 500

**Security-First Path** (for compliance-heavy environments):
1. Kata 100 → 150 → 450 → 250 → 350 → 500


**Time to Competency**:
- Basic proficiency: 2 hours (Katas 100-200)
- Production deployment: 4.5 hours (Katas 100-350)
- Full expertise: 6-7 hours (complete series through 500)

---

## Category README Structure (To Be Created)

**File**: `docs/learning/katas/caira-fundamentals/README.md`

**Required Sections** (per kata-category-readme.instructions.md):
1. Title + Brief Description
2. Category Overview (theme, technologies, progressive learning)
3. Prerequisites (Required Knowledge, Required Tools, Recommended Preparation)
4. Learning Path (visual progression diagram)
5. Category Katas (individual H3 sections for each kata 100-500)
6. Kata Comparison Matrix (table with all katas)
7. Suggested Learning Sequences (Beginners, Intermediate, Advanced)
8. Real-World Applications (industry contexts)
9. Common Challenges and Solutions
10. Integration with Learning Paths
11. Hands-On Labs (if applicable)
12. Additional Resources (documentation, community, related categories)
13. Feedback and Contributions
14. Version History
15. Standard Footer (AI attribution)

