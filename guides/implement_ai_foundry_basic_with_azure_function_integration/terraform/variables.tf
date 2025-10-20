# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Variables for Azure Functions AI Integration Layer
############################################################

# Foundry Basic Outputs (Required as Inputs)

variable "foundry_ai_foundry_id" {
  type        = string
  description = "The resource ID of the AI Foundry account from foundry_basic deployment"

  validation {
    condition     = can(regex("^/subscriptions/[^/]+/resourceGroups/[^/]+/providers/Microsoft.CognitiveServices/accounts/[^/]+$", var.foundry_ai_foundry_id))
    error_message = "foundry_ai_foundry_id must be a valid Azure Cognitive Services resource ID"
  }
}

variable "foundry_ai_foundry_project_id" {
  type        = string
  description = "The resource ID of the AI Foundry Project from foundry_basic deployment. Format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{name}/projects/{project-name}"

  validation {
    condition     = can(regex("^/subscriptions/[^/]+/resourceGroups/[^/]+/providers/Microsoft.CognitiveServices/accounts/[^/]+/projects/[^/]+$", var.foundry_ai_foundry_project_id))
    error_message = "foundry_ai_foundry_project_id must be a valid AI Foundry project ID with format: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.CognitiveServices/accounts/{name}/projects/{project-name}"
  }
}

variable "foundry_ai_foundry_project_name" {
  type        = string
  description = "The name of the AI Foundry project from foundry_basic deployment"
}

variable "foundry_application_insights_id" {
  type        = string
  description = "The resource ID of the Application Insights instance from foundry_basic deployment"

  validation {
    condition     = can(regex("^/subscriptions/[^/]+/resourceGroups/[^/]+/providers/[Mm]icrosoft.[Ii]nsights/components/[^/]+$", var.foundry_application_insights_id))
    error_message = "foundry_application_insights_id must be a valid Application Insights resource ID"
  }
}

variable "foundry_log_analytics_workspace_id" {
  type        = string
  description = "The resource ID of the Log Analytics workspace from foundry_basic deployment"
}

# Function-specific Configuration Variables

variable "project_name" {
  type        = string
  description = "Project name for the function app resources"
  default     = "ai-integration"
}

variable "function_sku_size" {
  type        = string
  description = "The SKU size for the Function App"
  default     = "B1"
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Tags to be applied to all resources"
}
