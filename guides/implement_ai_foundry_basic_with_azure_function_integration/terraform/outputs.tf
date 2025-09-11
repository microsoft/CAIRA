# outputs.tf - This extends the foundry_basic reference architecture with Azure Functions for serverless AI integration

# AI Foundry outputs (from foundry_basic module)
output "ai_foundry_id" {
  description = "The resource ID of the AI Foundry account"
  value       = module.foundry_basic.ai_foundry_id
}

output "ai_foundry_name" {
  description = "The name of the AI Foundry account"
  value       = module.foundry_basic.ai_foundry_name
}

output "ai_foundry_endpoint" {
  description = "The endpoint of the AI Foundry account"
  value       = "https://${module.foundry_basic.ai_foundry_name}.cognitiveservices.azure.com/"
}

output "ai_foundry_project_id" {
  description = "The resource ID of the AI Foundry Project"
  value       = module.foundry_basic.ai_foundry_project_id
}

output "ai_foundry_project_name" {
  description = "The name of the AI Foundry Project"
  value       = module.foundry_basic.ai_foundry_project_name
}

output "resource_group_name" {
  description = "The name of the resource group"
  value       = module.foundry_basic.resource_group_name
}

# Function App outputs
output "function_app_name" {
  description = "The name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "The URL of the Function App"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "function_app_identity_principal_id" {
  description = "The principal ID of the Function App managed identity"
  value       = azurerm_linux_function_app.main.identity[0].principal_id
}

# Monitoring outputs
output "application_insights_id" {
  description = "The resource ID of Application Insights"
  value       = module.foundry_basic.application_insights_id
}

output "log_analytics_workspace_id" {
  description = "The resource ID of Log Analytics workspace"
  value       = module.foundry_basic.log_analytics_workspace_id
}
