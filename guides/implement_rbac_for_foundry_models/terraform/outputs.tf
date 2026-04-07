# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

/*
 * Foundry Outputs
 */

output "ai_foundry_default_project_id" {
  description = "Resource ID of the default AI Foundry project."
  value       = module.default_project.ai_foundry_project_id
}

output "ai_foundry_default_project_name" {
  description = "Name of the default AI Foundry project."
  value       = module.default_project.ai_foundry_project_name
}

output "ai_foundry_endpoint" {
  description = "Endpoint URL of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_endpoint
}

output "ai_foundry_id" {
  description = "Resource ID of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_id
}

/*
 * APIM Outputs
 */

output "apim_gateway_base_url" {
  description = "Gateway base URL for API Management."
  value       = azurerm_api_management.this.gateway_url
}

output "apim_models_base_url" {
  description = "Base URL for model routes exposed through API Management."
  value       = "${azurerm_api_management.this.gateway_url}/models"
}

/*
 * Entra Outputs
 */

output "api_application_client_id" {
  description = "Client ID for the API application registration used as JWT audience."
  value       = azuread_application.api.client_id
}

output "client_application_client_ids" {
  description = "Map of client application client IDs by key."
  value = {
    for k, v in azuread_application.client : k => v.client_id
  }
}

output "client_application_object_ids" {
  description = "Map of client service principal object IDs by key."
  value = {
    for k, v in azuread_service_principal.client : k => v.object_id
  }
}
