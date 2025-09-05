
# backend.tf - Backend configuration for state management

terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstate"
    container_name       = "tfstate"
    key                  = "ai-foundry/terraform.tfstate"
  }
}
