############################################################
# Outputs for Azure Functions Integration
############################################################

output "function_app_id" {
  description = "The ID of the Function App"
  value       = data.external.function_details.result.id
}

output "function_app_name" {
  description = "The name of the Function App"
  value       = local.function_app_name
}

output "function_app_url" {
  description = "The default URL of the Function App"
  value       = "https://${data.external.function_details.result.hostname}"
}

output "function_app_identity_principal_id" {
  description = "The Principal ID of the Function App's managed identity"
  value       = data.external.function_details.result.identity_id
}

output "function_app_outbound_ip_addresses" {
  description = "The outbound IP addresses of the Function App"
  value       = split(",", data.external.function_details.result.outbound_ips)
}

output "storage_account_id" {
  description = "The ID of the Storage Account"
  value       = data.external.storage_details.result.id
}

output "storage_account_name" {
  description = "The name of the Storage Account"
  value       = data.external.storage_details.result.name
}

output "service_plan_id" {
  description = "The ID of the App Service Plan"
  value       = azurerm_service_plan.function.id
}

output "resource_group_name" {
  description = "The name of the resource group containing the function resources"
  value       = azurerm_resource_group.function.name
}

output "ai_foundry_endpoint" {
  description = "The endpoint URL for the AI Foundry service"
  value       = local.ai_foundry_endpoint
}

output "deployment_status" {
  description = "Status of the deployment including all resources"
  value = {
    storage_account = {
      created = null_resource.storage_account.id != null
      name    = data.external.storage_details.result.name
    }
    function_app = {
      created  = null_resource.function_app.id != null
      name     = local.function_app_name
      hostname = data.external.function_details.result.hostname
    }
    role_assignments = {
      ai_foundry_contributor = null_resource.role_ai_foundry_contributor.id != null
      ai_foundry_user        = null_resource.role_ai_foundry_user.id != null
      storage_roles_created  = null_resource.function_app.id != null
    }
    diagnostics = {
      configured = null_resource.diagnostic_settings.id != null
    }
  }
}
