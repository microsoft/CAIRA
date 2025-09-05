# outputs.tf - Output definitions

output "function_app_details" {
  value = {
    name                = azurerm_linux_function_app.main.name
    hostname            = azurerm_linux_function_app.main.default_hostname
    identity_id         = azurerm_linux_function_app.main.identity[0].principal_id
    resource_group      = azurerm_resource_group.main.name
    invoke_url_template = "https://${azurerm_linux_function_app.main.default_hostname}/api/{functionName}"
  }
  description = "Function App deployment details"
}

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
    key_vault_name   = azurerm_key_vault.ai_hub.name
    key_vault_uri    = azurerm_key_vault.ai_hub.vault_uri
    managed_identity = azurerm_linux_function_app.main.identity[0].principal_id
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

# Simple outputs for CLI usage
output "function_app_name" {
  value       = azurerm_linux_function_app.main.name
  description = "Name of the Function App"
}

output "function_app_default_hostname" {
  value       = azurerm_linux_function_app.main.default_hostname
  description = "Default hostname of the Function App"
}

output "function_app_identity_principal_id" {
  value       = azurerm_linux_function_app.main.identity[0].principal_id
  description = "Principal ID of the Function App's managed identity"
}

output "ai_hub_name" {
  value       = azurerm_machine_learning_workspace.ai_hub.name
  description = "Name of the AI Hub"
}

output "ai_project_name" {
  value       = azurerm_machine_learning_workspace.ai_project.name
  description = "Name of the AI Project"
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
