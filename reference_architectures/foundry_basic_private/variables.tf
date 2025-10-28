# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

variable "location" {
  type        = string
  description = "Azure region where the resource should be deployed."
  default     = "swedencentral"
  nullable    = false
}

variable "resource_group_resource_id" {
  type        = string
  description = "The resource group resource id where the module resources will be deployed. If not provided, a new resource group will be created."
  default     = null
}

variable "sku" {
  type        = string
  description = "The SKU for the AI Foundry resource. The default is 'S0'."
  default     = "S0"
}

variable "enable_telemetry" {
  type        = bool
  default     = true
  description = <<DESCRIPTION
This variable controls whether or not telemetry is enabled for the module.
For more information see https://aka.ms/avm/telemetryinfo.
If it is set to false, then no telemetry will be collected.
DESCRIPTION
  nullable    = false
}

variable "tags" {
  type        = map(string)
  default     = null
  description = "(Optional) Tags to be applied to all resources."
}

variable "foundry_subnet_id" {
  description = "The subnet ID for the AI Foundry private endpoints."
  type        = string
}

variable "monitor_private_link_scope_resource_id" {
  description = "The resource ID of the Monitor Private Link Scope to link Application Insights to."
  type        = string
  default     = null
}
