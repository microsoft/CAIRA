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

output "deployment_status" {
  description = "Status of the deployment including all resources"
  value = {
    storage_account = {
      created = azurerm_storage_account.function.id != null
      name    = azurerm_storage_account.function.name
      id      = azurerm_storage_account.function.id
    }
    function_app = {
      created  = azurerm_linux_function_app.main.id != null
      name     = azurerm_linux_function_app.main.name
      hostname = azurerm_linux_function_app.main.default_hostname
      id       = azurerm_linux_function_app.main.id
    }
    role_assignments = {
      ai_foundry_contributor = azurerm_role_assignment.function_ai_foundry_contributor.id != null
      ai_foundry_user        = azurerm_role_assignment.function_ai_foundry_user.id != null
      storage_blob           = azurerm_role_assignment.function_storage_blob.id != null
      storage_file           = azurerm_role_assignment.function_storage_file.id != null
      storage_queue          = azurerm_role_assignment.function_storage_queue.id != null
    }
    diagnostics = {
      configured = azurerm_monitor_diagnostic_setting.function.id != null
      name       = azurerm_monitor_diagnostic_setting.function.name
    }
  }
}
