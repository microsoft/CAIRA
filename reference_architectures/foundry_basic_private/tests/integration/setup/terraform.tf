terraform {
  required_version = ">= 1.13, < 2.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
  }
}

provider "azurerm" {
  storage_use_azuread = true
  features {}
}
