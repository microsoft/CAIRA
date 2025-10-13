# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Variables for Azure Functions AI Integration Layer
############################################################

# Foundry Basic Outputs (Required as Inputs)
# These variables receive the outputs from the foundry_basic deployment

variable "foundry_resource_group_name" {
  type        = string
  description = "The name of the resource group from foundry_basic deployment"
}

variable "foundry_ai_foundry_id" {
  type        = string
  description = "The resource ID of the AI Foundry account from foundry_basic deployment"
}

variable "foundry_ai_foundry_endpoint" {
  type        = string
  description = "The endpoint URL of the AI Foundry account from foundry_basic deployment"
}

# tflint-ignore: terraform_unused_declarations
variable "foundry_ai_foundry_project_id" {
  type        = string
  description = "The resource ID of the AI Foundry Project from foundry_basic deployment"
}

variable "foundry_ai_foundry_project_name" {
  type        = string
  description = "The name of the AI Foundry Project from foundry_basic deployment"
}

variable "foundry_application_insights_name" {
  type        = string
  description = "The name of the Application Insights instance from foundry_basic deployment"
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
