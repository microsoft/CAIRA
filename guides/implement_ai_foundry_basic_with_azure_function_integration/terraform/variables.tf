# variables.tf - This extends the foundry_basic reference architecture with Azure Functions for serverless AI integration

# Inherit all variables from foundry_basic
variable "location" {
  type        = string
  description = "Azure region where resources should be deployed."
  default     = "swedencentral"
}

variable "resource_group_resource_id" {
  type        = string
  description = "Existing resource group ID. If not provided, a new one will be created."
  default     = null
}

variable "project_name" {
  type        = string
  description = "The name of the AI Foundry project"
  default     = "ai-functions"
}

variable "project_display_name" {
  type        = string
  description = "The display name of the AI Foundry project"
  default     = "AI Functions Integration"
}

variable "project_description" {
  type        = string
  description = "The description of the AI Foundry project"
  default     = "AI Foundry with Azure Functions for serverless AI integration"
}

variable "sku" {
  type        = string
  description = "The SKU for the AI Foundry resource"
  default     = "S0"
}

variable "enable_telemetry" {
  type        = bool
  default     = true
  description = "Controls whether telemetry is enabled"
}

variable "tags" {
  type        = map(string)
  default     = null
  description = "Tags to be applied to all resources"
}

# Function App specific variables
variable "function_app_sku" {
  type        = string
  description = "SKU for the Function App Service Plan"
  default     = "B1"
}
