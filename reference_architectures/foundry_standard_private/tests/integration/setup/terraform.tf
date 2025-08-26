terraform {
  required_version = ">= 1.13, < 2.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    # https://registry.terraform.io/providers/hashicorp/time/latest
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
    }
  }
}

provider "azurerm" {
  storage_use_azuread = true
  features {}
}
