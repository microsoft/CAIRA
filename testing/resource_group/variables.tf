# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

variable "location" {
  type        = string
  description = "The Azure location where the resource group will be created."
  default     = "swedencentral"
}

variable "name" {
  type        = string
  description = "The name of the resource group."
  default     = null
}
