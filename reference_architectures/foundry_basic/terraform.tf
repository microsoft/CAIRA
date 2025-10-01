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

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
  }
  # Partner attribution set only when telemetry is enabled
  partner_id = var.enable_telemetry ? "acce1e78-408b-4687-9fad-66961e9298b1" : null
}
