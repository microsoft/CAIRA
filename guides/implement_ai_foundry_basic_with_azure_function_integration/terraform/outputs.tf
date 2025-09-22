############################################################
# Outputs for Azure Functions AI Integration Layer
############################################################

# Function App Outputs
output "function_app_id" {
  description = "The resource ID of the Function App"
  value       = azurerm_linux_function_app.this.id
}

output "function_app_name" {
  description = "The name of the Function App"
  value       = azurerm_linux_function_app.this.name
}

output "function_app_default_hostname" {
  description = "The default hostname of the Function App"
  value       = azurerm_linux_function_app.this.default_hostname
}

output "function_app_url" {
  description = "The URL of the Function App"
  value       = "https://${azurerm_linux_function_app.this.default_hostname}"
}

output "function_app_identity_principal_id" {
  description = "The principal ID of the Function App's system-assigned managed identity"
  value       = azurerm_linux_function_app.this.identity[0].principal_id
}

output "function_app_identity_tenant_id" {
  description = "The tenant ID of the Function App's system-assigned managed identity"
  value       = azurerm_linux_function_app.this.identity[0].tenant_id
}

# Storage Account Outputs
output "storage_account_id" {
  description = "The resource ID of the storage account used by the Function App"
  value       = azurerm_storage_account.function.id
}

output "storage_account_name" {
  description = "The name of the storage account used by the Function App"
  value       = azurerm_storage_account.function.name
}

# Service Plan Outputs
output "service_plan_id" {
  description = "The resource ID of the App Service Plan"
  value       = azurerm_service_plan.function.id
}

output "service_plan_name" {
  description = "The name of the App Service Plan"
  value       = azurerm_service_plan.function.name
}

# Connection Information
output "function_app_outbound_ip_addresses" {
  description = "The outbound IP addresses of the Function App"
  value       = split(",", azurerm_linux_function_app.this.outbound_ip_addresses)
}

output "function_app_possible_outbound_ip_addresses" {
  description = "The possible outbound IP addresses of the Function App"
  value       = split(",", azurerm_linux_function_app.this.possible_outbound_ip_addresses)
}
