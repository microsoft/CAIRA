terraform {
  required_version = ">= 1.12, < 2.0.0"
  required_providers {
    azapi = {
      source  = "azure/azapi"
      version = "2.5.0"
    }
  }
}

provider "azapi" {}
