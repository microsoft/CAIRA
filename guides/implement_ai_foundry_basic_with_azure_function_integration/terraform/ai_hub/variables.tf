# variables.tf - Variable definitions

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-ai-foundry-demo"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "West US"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "aifoundry"

  validation {
    condition     = can(regex("^[a-z0-9]{3,12}$", var.project_name))
    error_message = "Project name must be 3-12 lowercase alphanumeric characters."
  }
}

variable "ai_model_deployment_name" {
  description = "Name of the AI model deployment"
  type        = string
  default     = "gpt-4-deployment"
}

variable "enable_private_endpoints" {
  description = "Enable private endpoints for enhanced security"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

# Export suffix for use by Function App deployment
variable "export_suffix" {
  description = "Export the random suffix for Function App naming consistency"
  type        = bool
  default     = true
}
