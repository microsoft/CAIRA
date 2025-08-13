# ========================================
# Local Values - Computed variables used throughout this configuration
# ========================================

locals {
  # Base name used as a suffix for all resource names to ensure consistency
  base_name = "basic"

  # Determine which resource group to use: either an existing one (if provided via variable)
  # or the new one created by this configuration
  resource_group_resource_id = var.resource_group_resource_id != null ? var.resource_group_resource_id : azurerm_resource_group.this[0].id

  # Extract the resource group name from the resource ID
  # Azure resource IDs follow the pattern: /subscriptions/{sub}/resourceGroups/{name}/...
  # Index [4] gives us the resource group name from the split path
  resource_group_name = var.resource_group_resource_id != null ? split("/", var.resource_group_resource_id)[4] : azurerm_resource_group.this[0].name
}

# ========================================
# Azure Resource Naming Convention Module
# ========================================
# This module generates standardized, unique names for Azure resources
# following Microsoft naming conventions to avoid conflicts across regions/subscriptions

module "naming" {
  # https://registry.terraform.io/modules/Azure/naming/azurerm/latest
  source        = "Azure/naming/azurerm"
  version       = "0.4.2"
  suffix        = [local.base_name] # Append "basic" to all generated names
  unique-length = 5                 # Add 5 random characters for uniqueness
}

# ========================================
# Resource Group - Container for all Azure resources
# ========================================
# Creates a new resource group only if one wasn't provided via variable
# Uses conditional creation: count = 1 when we need to create, count = 0 when using existing

resource "azurerm_resource_group" "this" {
  count    = var.resource_group_resource_id == null ? 1 : 0 # Create only if no existing RG provided
  location = var.location                                   # Azure region for deployment
  name     = module.naming.resource_group.name_unique       # Auto-generated unique name
  tags     = var.tags                                       # Apply any tags specified via variables
}

# ========================================
# Azure AI Foundry - Core AI/ML Platform
# ========================================
# This module creates the main AI Foundry environment including:
# - Cognitive Services account
# - Model deployments (AI models like GPT-4, embeddings, etc.)
# - AI projects (workspaces for organizing AI work and Agents)

module "ai_foundry" {
  # https://registry.terraform.io/modules/Azure/avm-ptn-aiml-ai-foundry/azurerm/latest
  source  = "Azure/avm-ptn-aiml-ai-foundry/azurerm"
  version = "0.6.0"

  base_name                  = local.base_name
  location                   = var.location
  resource_group_resource_id = local.resource_group_resource_id

  # AI Foundry hub configuration
  ai_foundry = {
    name = module.naming.cognitive_account.name_unique # Auto-generated unique name for the AI hub
  }

  # Model deployments - defines which AI models to deploy and their configurations
  # Each key represents a deployment name, value contains model details and scaling settings
  ai_model_deployments = {
    "gpt-4.1" = {
      name = "gpt-4.1"
      model = {
        format  = "OpenAI"     # Model provider (OpenAI, Meta, etc.)
        name    = "gpt-4.1"    # Specific model name
        version = "2025-04-14" # Model version (varies by provider/region)
      }
      scale = {
        type     = "GlobalStandard" # Pricing tier and availability
        capacity = 1                # Number of units to provision
      }
    }
  }

  # AI projects - workspaces for organizing experiments, data, and models
  ai_projects = {
    project = {
      name         = var.project_name         # Configurable via variables
      description  = var.project_description  # Project description
      display_name = var.project_display_name # Human-readable name shown in UI
    }
  }

  enable_telemetry = var.enable_telemetry # Opt-in telemetry for module improvement
  tags             = var.tags             # Apply consistent tags across all resources
}

# ========================================
# Log Analytics Workspace - Centralized Logging
# ========================================
# Collects and stores logs, metrics, and telemetry data from all Azure resources
# Provides query capabilities and integration with monitoring/alerting tools

resource "azurerm_log_analytics_workspace" "this" {
  location            = var.location                                      # Same region as other resources
  name                = module.naming.log_analytics_workspace.name_unique # Auto-generated unique name
  resource_group_name = local.resource_group_name                         # Target resource group
  retention_in_days   = 30                                                # How long to keep logs (30 days = cost-effective)
  sku                 = "PerGB2018"                                       # Pay-per-GB pricing model
  tags                = var.tags                                          # Apply consistent tags
}

# ========================================
# Application Insights - Application Performance Monitoring
# ========================================
# Provides application performance monitoring, distributed tracing, and telemetry
# for AI applications and services. Integrates with Log Analytics for advanced analytics.

module "application_insights" {
  source  = "Azure/avm-res-insights-component/azurerm"
  version = "0.2.0"

  location            = var.location                                   # Same region as other resources
  name                = module.naming.application_insights.name_unique # Auto-generated unique name
  resource_group_name = local.resource_group_name                      # Target resource group
  workspace_id        = azurerm_log_analytics_workspace.this.id        # Link to Log Analytics for data storage
  enable_telemetry    = var.enable_telemetry                           # Module telemetry setting
  application_type    = "other"                                        # Generic application type

}

# ========================================
# Application Insights Connection to AI Foundry Project
# ========================================
# Creates a connection between the AI Foundry project and Application Insights
# This allows AI tools and capabilities within the project to automatically send
# telemetry, metrics, and traces to Application Insights for monitoring and debugging

resource "azapi_resource" "appinsights_connection" {
  type      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01" # Azure API resource type
  name      = "${module.application_insights.name}-connection"                       # Connection name based on App Insights name
  parent_id = module.ai_foundry.ai_foundry_project_id["project"]                     # Target AI Foundry project

  body = {
    properties = {
      category      = "AppInsights"                           # Connection type for Application Insights
      target        = module.application_insights.resource_id # Application Insights resource to connect to
      authType      = "ApiKey"                                # Authentication method using API key
      isSharedToAll = false                                   # Restrict to this project only
      credentials = {
        key = module.application_insights.connection_string # Connection string contains the API key
      }
      metadata = {
        ApiType    = "Azure"                                 # Indicates this is an Azure service
        ResourceId = module.application_insights.resource_id # Reference to the App Insights resource
      }
    }
  }
}
