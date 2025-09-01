# Security Considerations Instructions for GitHub Copilot

These instructions guide GitHub Copilot in providing comprehensive security analysis and guidance when users interact with the CAIRA repository. The focus is on Terraform modules, reference architectures, and CI/CD pipelines. Always prompt the user to conduct a human-driven security review and never assume that code from the repository is fully secure without manual validation.

## 1. Identify Common Security Risks

- Authentication & Identity
  - Detect any `disableLocalAuth = false` in Azure Cognitive Services and recommend enforcing Azure AD only.
  - Identify system-assigned identities without user-assigned identities; suggest least-privilege user-assigned identities.
  - Warn if GitHub Actions OIDC or service principal tokens are broadly exposed without restrictions.

- Network Exposure
  - Flag `publicNetworkAccess = "Enabled"` on any service (AI Foundry, AI Search, Cosmos DB, Storage). Suggest `Disabled` with private endpoints.
  - Detect open IP ranges (e.g., ip_range_filter includes `0.0.0.0`). Recommend narrowing to trusted CIDRs.
  - Verify presence of NSGs, Azure Firewall, or WAF policies around AI endpoints.

- Encryption & Key Management
  - Highlight missing `encryptionWithCmk.enforcement` blocks; enforce Key Vault–backed encryption.
  - Warn when platform-managed keys are used for sensitive data at rest; suggest CMK integration.
  - Identify storage accounts or resource logs that may expose connection strings or instrumentation keys.

- Input Validation & Injection
  - Check for missing `validation` blocks in `variables.tf`; recommend regex or `allowed_values` constraints.
  - Warn about unsanitized inputs like `customSubDomainName` that could lead to DNS hijacking or template injection.

- Terraform State & CI/CD
  - Detect absence of a remote state backend or missing encryption/locking settings; recommend AzureRM backend with `encrypt = true` and `lock = true`.
  - Ensure `.gitignore` excludes all sensitive patterns (`*.tfvars`, `.env`, credentials files).
  - Verify presence of tfsec, Checkov, or Azure Policy scan steps in GitHub Actions workflows.

- RBAC & Role Assignments
  - Warn against broad role assignments (e.g., Owner, Contributor) for service identities; suggest scoped, least-privilege roles.
  - Highlight missing conditional access or role assignment scopes.

## 2. Provide Concrete Mitigations

- Code Examples
  - Show Terraform HCL snippets to disable local auth, enforce private endpoints, configure CMK, and add variable validation.
  - Provide Azure CLI commands via `azure_cli-generate_azure_cli_command` where appropriate.

- Compliance Mapping
  - Map each security recommendation to compliance controls (SOC-2 CC6.4, ISO 27001 A.10.1, NIST SP 800-53 SC-28).
  - Generate a simple compliance checklist for enterprise users.

- Reference Documentation
  - Point to official Azure documentation on Private Endpoints, Managed Identities, Key Vault encryption, and Terraform best practices.

## 3. Emphasize Human-Driven Security Review

- Always prompt the user to manually inspect and validate any automated remediation suggestions.
- Remind users that repository code and Copilot recommendations are starting points, not guaranteed solutions.
- Suggest running third-party tools (tfsec, Checkov, tflint, gitleaks) and conducting threat modeling sessions.

## 4. Best Practices for Copilot Guidance

- Use clear, actionable language: "Ensure", "Verify", "Configure", "Enforce".
- Include inline code examples only for small snippets; reference larger sections in repository docs.
- When in doubt, ask the user for additional context before providing security advice.

## GitHub Copilot Instructions

### 1. Provide Accurate Security Guidance for Enterprise CAIRA Deployments

- Automatically scan all CAIRA Terraform modules, reference architectures, and CI/CD workflows to detect insecure defaults and misconfigurations:
  - Detect `disableLocalAuth = false` in Cognitive Services and recommend `disableLocalAuth = true` to enforce Azure AD authentication.
  - Identify `publicNetworkAccess = "Enabled"` settings and suggest `publicNetworkAccess = "Disabled"` with private endpoint alternatives.
  - Flag `networkAcls.defaultAction = "Allow"` and propose changing to `defaultAction = "Deny"` with explicit `ipRules` for trusted networks.
  - Highlight missing `encryptionWithCmk.enforcement` blocks and enforce Key Vault–backed encryption in Terraform.

- Generate remediation examples, both Terraform HCL and Azure CLI. Sample Terraform fix:

  ```hcl
  resource "azurerm_cognitive_account" "secure_search" {
    name                = "caira-search"
    resource_group_name = var.rg_name
    location            = var.location
    disableLocalAuth    = true
    publicNetworkAccess = "Disabled"
    networkAcls {
      defaultAction = "Deny"
      ipRules       = [var.trusted_ip_cidr]
    }
    encryptionWithCmk {
      keyVaultKeyUri     = azurerm_key_vault_key.cmk.id
      enforcementEnabled = true
    }
  }
  ```

- Map each security finding to compliance requirements (SOC-2 CC6.4, ISO 27001 A.10.1, NIST SP 800-53 SC-28) and generate a compliance checklist.

### 2. Assist with Proper Network Isolation and Private Endpoint Configuration

- Enumerate all CAIRA services that must be isolated: Machine Learning, Cognitive Services, Cosmos DB, Storage Accounts.

- Provide Terraform modules for private endpoints and DNS zones:

  ```hcl
  resource "azurerm_private_endpoint" "ml_pe" {
    name                = "pe-caira-ml"
    resource_group_name = var.rg_name
    subnet_id           = azurerm_subnet.ai_subnet.id
    private_service_connection {
      name                           = "caira-ml-connection"
      private_connection_resource_id = azurerm_machine_learning_workspace.main.id
      subresource_names              = ["amlworkspace"]
    }
  }

  resource "azurerm_private_dns_zone" "ml_dns" {
    name                = "privatelink.azureml.azure.com"
    resource_group_name = var.rg_name
  }

  resource "azurerm_private_dns_zone_virtual_network_link" "ml_dns_link" {
    name                  = "link-ml-dns-vnet"
    resource_group_name   = var.rg_name
    private_dns_zone_name = azurerm_private_dns_zone.ml_dns.name
    virtual_network_id    = azurerm_virtual_network.main.id
  }
  ```

- Recommend Network Security Group rules to allow only necessary traffic:

  ```hcl
  resource "azurerm_network_security_group" "ml_nsg" {
    name                = "nsg-ml"
    resource_group_name = var.rg_name
    location            = var.location

    security_rule {
      name                       = "AllowHTTPS"
      priority                   = 100
      direction                  = "Inbound"
      access                     = "Allow"
      protocol                   = "Tcp"
      source_address_prefix      = var.trusted_ip_cidr
      destination_port_range     = "443"
    }

    security_rule {
      name                       = "DenyAllOther"
      priority                   = 200
      direction                  = "Inbound"
      access                     = "Deny"
      protocol                   = "*"
      source_address_prefix      = "*"
      destination_address_prefix = "*"
    }
  }
  ```

### 3. Suggest Security Best Practices for Capability Hosts and Agent Services

- Enforce least-privilege by assigning User-Assigned Managed Identities:

  ```hcl
  resource "azurerm_user_assigned_identity" "agent_identity" {
    name                = "caira-agent-identity"
    resource_group_name = var.rg_name
    location            = var.location
  }
  ```

- Illustrate secure secret injection from Key Vault in AzAPI resource definitions:

  ```hcl
  properties = {
    instrumentationKey = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.app_insights.secret_uri})"
  }
  ```

- Require storage encryption and HTTPS-only traffic for vector and thread stores:

  ```hcl
  resource "azurerm_storage_account" "vector_store" {
    enable_https_traffic_only = true
    encryption {
      key_source       = "Microsoft.Keyvault"
      key_vault_key_id = azurerm_key_vault_key.cmk.id
    }
  }
  ```

### 4. Guide Users Through Secure Configuration and Compliance Requirements

- Add variable validations to enforce secure defaults:

  ```hcl
  variable "disable_local_auth" {
    type    = bool
    default = true
    validation {
      condition     = var.disable_local_auth == true
      error_message = "Production deployments must disable local auth."
    }
  }
  variable "public_network_access" {
    type    = string
    default = "Disabled"
    validation {
      condition     = var.public_network_access == "Disabled"
      error_message = "Public network access must be disabled."
    }
  }
  ```

- Integrate tfsec and Checkov scans in GitHub Actions:

  ```yaml
  - name: Run tfsec
    uses: aquasecurity/tfsec-action@v1
  - name: Run Checkov
    uses: bridgecrewio/checkov-action@v10
  ```

- Configure a secure Terraform backend with remote state encryption and locking:

  ```hcl
  terraform {
    backend "azurerm" {
      resource_group_name  = "rg-tfstate"
      storage_account_name = "sacaira"
      container_name       = "tfstate"
      key                  = "production.tfstate"
      encrypt              = true
      lock                 = true
    }
  }
  ```

- Reference Azure Policy for naming, network, and encryption guardrails:

  ```hcl
  module "policy_initiative" {
    source  = "Azure/policy/azurerm//modules/initiative"
    version = "1.0.0"
    policies = [
      { policy_definition_id = "/providers/Microsoft.Authorization/policyDefinitions/azure_caf_naming" }
    ]
  }
  ```
