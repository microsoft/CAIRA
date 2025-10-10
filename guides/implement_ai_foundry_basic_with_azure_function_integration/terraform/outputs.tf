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
