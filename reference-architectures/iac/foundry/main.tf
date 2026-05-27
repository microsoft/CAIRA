locals {
  base_name_raw = trim(replace(lower(var.project_name), "/[^a-z0-9-]/", "-"), "-")
  base_name     = length(local.base_name_raw) > 0 ? local.base_name_raw : "caira"
  avm_base_name = length(trim(substr(local.base_name, 0, 9), "-")) >= 3 ? trim(substr(local.base_name, 0, 9), "-") : "caira"

  model_deployments = {
    "gpt-5-mini" = {
      name = "gpt-5-mini"
      model = {
        format  = "OpenAI"
        name    = "gpt-5-mini"
        version = "2025-08-07"
      }
      scale = {
        type     = "GlobalStandard"
        capacity = 10
      }
    }
  }
}

resource "azurerm_resource_group" "this" {
  name     = "rg-${local.base_name}"
  location = var.location
  tags     = var.tags
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "law-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = "appi-${local.base_name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.this.id
  tags                = var.tags
}

module "foundry" {
  source  = "Azure/avm-ptn-aiml-ai-foundry/azurerm"
  version = "0.11.0"

  base_name                  = local.avm_base_name
  location                   = var.location
  resource_group_resource_id = azurerm_resource_group.this.id
  enable_telemetry           = var.enable_telemetry
  tags                       = var.tags

  create_byor              = false
  create_private_endpoints = false

  diagnostic_settings = {
    to_law = {
      name                           = "diag-to-law"
      workspace_resource_id          = azurerm_log_analytics_workspace.this.id
      log_analytics_destination_type = "Dedicated"
      log_groups                     = ["allLogs"]
      metric_categories              = ["AllMetrics"]
    }
  }

  ai_foundry = {
    name                     = "aif-${local.base_name}"
    sku                      = "S0"
    disable_local_auth       = true
    allow_project_management = true
    create_ai_agent_service  = false
  }

  ai_model_deployments = local.model_deployments

  ai_projects = {
    default = {
      name         = "default-project"
      display_name = "Default Project"
      description  = "Default CAIRA reference project"
    }
  }

  depends_on = [time_sleep.wait_before_purge_foundry]
}

resource "azapi_resource" "appinsights_connection" {
  type                      = "Microsoft.CognitiveServices/accounts/connections@2025-06-01"
  name                      = azurerm_application_insights.this.name
  parent_id                 = module.foundry.ai_foundry_id
  schema_validation_enabled = false

  body = {
    name = azurerm_application_insights.this.name
    properties = {
      category      = "AppInsights"
      target        = azurerm_application_insights.this.id
      authType      = "ApiKey"
      isSharedToAll = true

      credentials = {
        key = azurerm_application_insights.this.connection_string
      }

      metadata = {
        ApiType    = "Azure"
        ResourceId = azurerm_application_insights.this.id
      }
    }
  }

  depends_on = [module.foundry]
}

resource "azapi_resource_action" "purge_ai_foundry" {
  method      = "DELETE"
  resource_id = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/providers/Microsoft.CognitiveServices/locations/${var.location}/resourceGroups/${azurerm_resource_group.this.name}/deletedAccounts/aif-${local.base_name}"
  type        = "Microsoft.Resources/resourceGroups/deletedAccounts@2025-09-01"
  when        = "destroy"
}

resource "time_sleep" "wait_before_purge_foundry" {
  destroy_duration = "60s"
  depends_on       = [azapi_resource_action.purge_ai_foundry]
}

data "azurerm_client_config" "current" {}
