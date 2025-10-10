# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

terraform {
  required_version = ">= 1.13, < 2.0"

  required_providers {
    # https://registry.terraform.io/providers/hashicorp/azurerm/latest
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

