# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

output "ai_foundry_project_id" {
  description = "The resource ID of the AI Foundry Project."
  value       = azapi_resource.ai_foundry_project.id
}

output "ai_foundry_project_name" {
  description = "The name of the AI Foundry Project."
  value       = var.project_name
}

output "ai_foundry_project_identity_principal_id" {
  description = "The principal ID of the AI Foundry project system-assigned managed identity."
  value       = azapi_resource.ai_foundry_project.output.identity.principalId
}
