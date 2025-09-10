#outputs.tf - Output definitions for Azure Function Configuration

output "function_app_details" {
  value = {
    name                = azurerm_linux_function_app.main.name
    hostname            = azurerm_linux_function_app.main.default_hostname
    identity_id         = azurerm_linux_function_app.main.identity[0].principal_id
    resource_group      = data.azurerm_resource_group.main.name
    invoke_url_template = "https://${azurerm_linux_function_app.main.default_hostname}/api/{functionName}"
  }
  description = "Function App deployment details"
}

output "function_app_name" {
  value       = azurerm_linux_function_app.main.name
  description = "Name of the Function App"
}

output "function_app_default_hostname" {
  value       = azurerm_linux_function_app.main.default_hostname
  description = "Default hostname of the Function App"
}

output "function_app_identity_principal_id" {
  value       = azurerm_linux_function_app.main.identity[0].principal_id
  description = "Principal ID of the Function App's managed identity"
}

output "storage_account_name" {
  value       = data.azurerm_storage_account.function_app.name
  description = "Name of the Function App storage account"
}

output "app_service_plan_name" {
  value       = azurerm_service_plan.main.name
  description = "Name of the App Service Plan"
}

output "deployment_instructions" {
  value = <<-EOT
========================================
Function App Deployment Complete! 🎉
========================================

Environment: ${var.environment}
Function App: ${azurerm_linux_function_app.main.name}

Next Steps:
-----------

1. Deploy your Azure Function code:
func azure functionapp publish ${azurerm_linux_function_app.main.name} --python

2. Test the Function endpoint:
URL: https://${azurerm_linux_function_app.main.default_hostname}/api/{functionName}

Get function key:
az functionapp function keys list \
--resource-group ${data.azurerm_resource_group.main.name} \
--name ${azurerm_linux_function_app.main.name} \
--function-name <your-function-name>

3. Monitor your function:
Application Insights: ${data.azurerm_application_insights.main.name}

View logs:
az monitor app-insights query \
--app ${data.azurerm_application_insights.main.name} \
--resource-group ${data.azurerm_resource_group.main.name} \
--query "traces | take 20"

Security Note:
-------------
The Function App has been configured with a system-assigned managed identity
and granted necessary permissions to access AI Foundry resources.
Principal ID: ${azurerm_linux_function_app.main.identity[0].principal_id}

Connected AI Resources:
----------------------
- AI Hub: ${data.azurerm_machine_learning_workspace.ai_hub.name}
- AI Project: ${data.azurerm_machine_learning_workspace.ai_project.name}
- Key Vault: ${data.azurerm_key_vault.ai_hub.name}

========================================
EOT

  description = "Post-deployment instructions"
}
