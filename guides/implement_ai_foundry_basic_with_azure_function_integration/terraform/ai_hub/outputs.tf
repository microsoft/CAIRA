# outputs.tf - Output values for AI Foundry deployment

output "ai_foundry_details" {
  value = {
    hub_name      = azurerm_machine_learning_workspace.ai_hub.name
    project_name  = azurerm_machine_learning_workspace.ai_project.name
    discovery_url = azurerm_machine_learning_workspace.ai_hub.discovery_url
    workspace_id  = azurerm_machine_learning_workspace.ai_hub.workspace_id
    studio_url    = "https://ai.azure.com"
  }
  description = "AI Foundry deployment details"
}

output "security_details" {
  value = {
    key_vault_name = azurerm_key_vault.ai_hub.name
    key_vault_uri  = azurerm_key_vault.ai_hub.vault_uri
  }
  description = "Security configuration details"
  sensitive   = true
}

output "monitoring_details" {
  value = {
    app_insights_name            = azurerm_application_insights.main.name
    app_insights_connection      = azurerm_application_insights.main.connection_string
    app_insights_instrumentation = azurerm_application_insights.main.instrumentation_key
  }
  description = "Monitoring configuration details"
  sensitive   = true
}

output "connection_strings" {
  value = {
    ai_hub_connection = "Endpoint=${azurerm_machine_learning_workspace.ai_hub.discovery_url};SubscriptionId=${data.azurerm_client_config.current.subscription_id};ResourceGroup=${azurerm_resource_group.main.name};WorkspaceName=${azurerm_machine_learning_workspace.ai_hub.name}"
  }
  description = "Connection strings for application configuration"
  sensitive   = true
}

# Deployment instructions output
output "deployment_instructions" {
  value = <<-EOT
========================================
Deployment Complete! 🎉
========================================

Environment: ${var.environment}
Resource Group: ${azurerm_resource_group.main.name}

Next Steps:
-----------

1. Access AI Studio to deploy models:
URL: https://ai.azure.com
Workspace: ${azurerm_machine_learning_workspace.ai_hub.name}
Project: ${azurerm_machine_learning_workspace.ai_project.name}

2. Deploy AI models via AI Studio:
- Navigate to the Model Catalog
- Select and deploy your desired models
- Configure endpoints and deployments

3. Monitor your AI resources:
Application Insights: ${azurerm_application_insights.main.name}

View logs:
az monitor app-insights query \
--app ${azurerm_application_insights.main.name} \
--resource-group ${azurerm_resource_group.main.name} \
--query "traces | take 20"

4. For local development:
- Login: az login
- Set subscription: az account set --subscription "${data.azurerm_client_config.current.subscription_id}"
- Use Azure SDK with DefaultAzureCredential for authentication

Important Resources:
-------------------
- Key Vault: ${azurerm_key_vault.ai_hub.name}
- AI Hub: ${azurerm_machine_learning_workspace.ai_hub.name}
- AI Project: ${azurerm_machine_learning_workspace.ai_project.name}
- Storage: ${data.azurerm_storage_account.ai_hub.name}

Security Note:
-------------
The AI Hub and Project are configured with system-assigned managed identities.
Storage account has key access disabled for enhanced security.

========================================
EOT

  description = "Post-deployment instructions and quick reference"
}

# Simple outputs for CLI usage
output "ai_hub_name" {
  value       = azurerm_machine_learning_workspace.ai_hub.name
  description = "Name of the AI Hub"
}

output "ai_project_name" {
  value       = azurerm_machine_learning_workspace.ai_project.name
  description = "Name of the AI Project"
}

output "ai_hub_discovery_url" {
  value       = azurerm_machine_learning_workspace.ai_hub.discovery_url
  description = "Discovery URL for the AI Hub"
}

output "key_vault_name" {
  value       = azurerm_key_vault.ai_hub.name
  description = "Name of the Key Vault"
}

output "application_insights_name" {
  value       = azurerm_application_insights.main.name
  description = "Name of Application Insights"
}

output "resource_group_name" {
  value       = azurerm_resource_group.main.name
  description = "Name of the resource group"
}

output "resource_group_location" {
  value       = azurerm_resource_group.main.location
  description = "Location of the resource group"
}

output "storage_account_name" {
  value       = data.azurerm_storage_account.ai_hub.name
  description = "Name of the storage account for AI Hub"
}

output "storage_account_id" {
  value       = data.azurerm_storage_account.ai_hub.id
  description = "Resource ID of the storage account"
}

output "ai_hub_id" {
  value       = azurerm_machine_learning_workspace.ai_hub.id
  description = "Resource ID of the AI Hub"
}

output "ai_project_id" {
  value       = azurerm_machine_learning_workspace.ai_project.id
  description = "Resource ID of the AI Project"
}

output "key_vault_id" {
  value       = azurerm_key_vault.ai_hub.id
  description = "Resource ID of the Key Vault"
}

output "application_insights_id" {
  value       = azurerm_application_insights.main.id
  description = "Resource ID of Application Insights"
}

output "application_insights_connection_string" {
  value       = azurerm_application_insights.main.connection_string
  description = "Connection string for Application Insights"
  sensitive   = true
}

output "application_insights_instrumentation_key" {
  value       = azurerm_application_insights.main.instrumentation_key
  description = "Instrumentation key for Application Insights"
  sensitive   = true
}

output "random_suffix" {
  value       = random_string.suffix.result
  description = "Random suffix used for resource naming"
}

output "subscription_id" {
  value       = data.azurerm_client_config.current.subscription_id
  description = "Current subscription ID"
}

output "tenant_id" {
  value       = data.azurerm_client_config.current.tenant_id
  description = "Current tenant ID"
}
