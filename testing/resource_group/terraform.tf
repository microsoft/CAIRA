terraform {
  required_version = ">= 1.12, < 2.0.0"
  required_providers {
    # https://registry.terraform.io/providers/Azure/azapi/latest
    azapi = {
      source  = "azure/azapi"
      version = "~> 2.6"
    }
  }
}
