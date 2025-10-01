terraform {
  required_version = ">= 1.13, < 2.0"

  required_providers {
    # https://registry.terraform.io/providers/hashicorp/azurerm/latest
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    # https://registry.terraform.io/providers/Azure/azapi/latest
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.6"
    }
    # https://registry.terraform.io/providers/hashicorp/random/latest
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
    # https://registry.terraform.io/providers/hashicorp/time/latest
    time = {
      source  = "hashicorp/time"
      version = "~> 0.13"
    }
  }
}

