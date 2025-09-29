############################################################
# Outputs for Azure Functions Integration
############################################################

output "function_app_id" {
  description = "The ID of the Function App"
  value       = azurerm_linux_function_app.main.id
}

output "function_app_name" {
  description = "The name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_default_hostname" {
  description = "The default hostname of the Function App"
  value       = azurerm_linux_function_app.main.default_hostname
}

output "function_app_url" {
  description = "The default URL of the Function App"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "function_app_identity_principal_id" {
  description = "The Principal ID of the Function App's managed identity"
  value       = azurerm_linux_function_app.main.identity[0].principal_id
}

output "function_app_outbound_ip_addresses" {
  description = "The outbound IP addresses of the Function App"
  value       = split(",", azurerm_linux_function_app.main.outbound_ip_addresses)
}

output "storage_account_id" {
  description = "The ID of the Storage Account"
  value       = azurerm_storage_account.function.id
}

output "storage_account_name" {
  description = "The name of the Storage Account"
  value       = azurerm_storage_account.function.name
}

output "service_plan_id" {
  description = "The ID of the App Service Plan"
  value       = azurerm_service_plan.function.id
}

output "resource_group_name" {
  description = "The name of the resource group containing the function resources"
  value       = azurerm_resource_group.function.name
}

output "resource_group_id" {
  description = "The ID of the resource group containing the function resources"
  value       = azurerm_resource_group.function.id
}

output "ai_foundry_endpoint" {
  description = "The endpoint URL for the AI Foundry service"
  value       = local.ai_foundry_endpoint
}
