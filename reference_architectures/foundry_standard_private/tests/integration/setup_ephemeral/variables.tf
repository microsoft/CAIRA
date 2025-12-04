# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

variable "test_run_id" {
  description = "Unique test run identifier (e.g., GitHub Actions run ID). Used to generate unique CIDR allocation."
  type        = string

  validation {
    condition     = can(regex("^[0-9]+$", var.test_run_id))
    error_message = "test_run_id must be a numeric string (e.g., GitHub Actions run ID)"
  }
}

variable "vnet_name" {
  description = "Name of the durable VNet from infrastructure pool"
  type        = string
  default     = "vnet-fstdprv-durable"
}

variable "vnet_resource_group" {
  description = "Resource group containing the durable VNet"
  type        = string
  default     = "rg-fstdprv-durable"
}

variable "subnet_destroy_time_sleep" {
  description = "Wait time for service association link cleanup after Container App Environment deletion"
  type        = string
  default     = "15m"

  validation {
    condition     = can(regex("^[0-9]+[smh]$", var.subnet_destroy_time_sleep))
    error_message = "subnet_destroy_time_sleep must be a valid duration (e.g., '5m', '300s', '1h')"
  }
}
