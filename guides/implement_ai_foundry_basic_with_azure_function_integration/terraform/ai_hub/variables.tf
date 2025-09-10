# variables.tf - Variable definitions

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "rg-ai-foundry-demo"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "westus2"
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

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}

