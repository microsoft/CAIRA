# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "ai_foundry_id" {
  description = "The resource ID of the AI Foundry account."
  value       = azapi_resource.ai_foundry.id
}

output "ai_foundry_name" {
  description = "The name of the AI Foundry account."
  value       = azapi_resource.ai_foundry.name
}

output "ai_foundry_endpoint" {
  description = "The endpoint URL of the AI Foundry account."
  value       = "https://${azapi_resource.ai_foundry.name}.cognitiveservices.azure.com/"
}

output "ai_foundry_project_id" {
  description = "The resource ID of the AI Foundry Project."
  value       = azapi_resource.ai_foundry_project.id
}

output "ai_foundry_project_name" {
  description = "The name of the AI Foundry Project."
  value       = azapi_resource.ai_foundry_project.name
}

output "ai_foundry_model_deployments_ids" {
  description = "The IDs of the AI Foundry model deployments."
  value       = [for deployment in azurerm_cognitive_deployment.model_deployments : deployment.id]
}

output "ai_foundry_project_identity_principal_id" {
  description = "The principal ID of the AI Foundry project system-assigned managed identity."
  value       = azapi_resource.ai_foundry_project.output.identity.principalId
}
