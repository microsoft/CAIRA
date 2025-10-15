# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Outputs for Azure Functions Integration
############################################################

output "function_app_name" {
  description = "The name of the Function App"
  value       = azurerm_linux_function_app.main.name
}

output "function_app_url" {
  description = "The default URL of the Function App"
  value       = "https://${azurerm_linux_function_app.main.default_hostname}"
}

output "resource_group_name" {
  description = "The name of the resource group containing the function resources"
  value       = azurerm_resource_group.function.name
}

############################################################
# Outputs for Local Development Configuration
############################################################

output "ai_foundry_endpoint" {
  description = "The endpoint URL of the AI Foundry account (for local development)"
  value       = local.ai_foundry_endpoint
}

output "ai_foundry_project_name" {
  description = "The name of the AI Foundry project (for local development)"
  value       = local.ai_foundry_project_name
}

output "ai_foundry_project_id" {
  description = "The resource ID of the AI Foundry project (for local development)"
  value       = var.foundry_ai_foundry_project_id
}

output "foundry_resource_group_name" {
  description = "The name of the foundry_basic resource group (for local development)"
  value       = local.foundry_resource_group_name
}

output "subscription_id" {
  description = "The Azure subscription ID (for local development)"
  value       = local.ai_foundry_parsed.subscription_id
}
