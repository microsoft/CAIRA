# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

terraform {
  required_version = ">= 1.13, < 2.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.6"
    }
  }
}

provider "azurerm" {
  storage_use_azuread = true
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
  }
  # Partner attribution set only when telemetry is enabled
  partner_id = var.enable_telemetry ? "acce1e78-4c91-4070-97a7-905d17db85ba" : null
}
