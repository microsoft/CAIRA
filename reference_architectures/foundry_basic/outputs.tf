# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "ai_foundry_id" {
  description = "The resource ID of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_id
}

output "ai_foundry_name" {
  description = "The name of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_name
}

output "ai_foundry_endpoint" {
  description = "The endpoint URL of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_endpoint
}

output "ai_foundry_project_id" {
  description = "The resource ID of the AI Foundry Project."
  value       = module.ai_foundry.ai_foundry_project_id
}

output "ai_foundry_project_name" {
  description = "The name of the AI Foundry Project."
  value       = module.ai_foundry.ai_foundry_project_name
}

output "ai_foundry_model_deployments_ids" {
  description = "The IDs of the AI Foundry model deployments."
  value       = module.ai_foundry.ai_foundry_model_deployments_ids
}

output "resource_group_id" {
  description = "The resource ID of the resource group."
  value       = local.resource_group_resource_id
}

output "resource_group_name" {
  description = "The name of the resource group."
  value       = local.resource_group_name
}

output "ai_foundry_project_identity_principal_id" {
  description = "The principal ID of the AI Foundry project system-assigned managed identity."
  value       = module.ai_foundry.ai_foundry_project_identity_principal_id
}

output "application_insights_id" {
  description = "The resource ID of the Application Insights instance."
  value       = module.application_insights.resource_id
}

output "log_analytics_workspace_id" {
  description = "The resource ID of the Log Analytics workspace."
  value       = azurerm_log_analytics_workspace.this.id
}
