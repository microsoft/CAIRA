output "ai_foundry_id" {
  description = "The resource ID of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_id
}

output "ai_foundry_name" {
  description = "The name of the AI Foundry account."
  value       = module.ai_foundry.ai_foundry_name
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
  value       = module.ai_foundry.ai_model_deployment_ids
}

output "resource_group_id" {
  description = "The resource ID of the resource group."
  value       = local.resource_group_resource_id
}

output "resource_group_name" {
  description = "The name of the resource group."
  value       = var.resource_group_resource_id != null ? split("/", var.resource_group_resource_id)[4] : azurerm_resource_group.this[0].name
}
