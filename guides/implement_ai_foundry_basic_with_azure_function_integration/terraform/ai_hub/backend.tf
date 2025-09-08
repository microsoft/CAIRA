# backend.tf - Backend configuration for state management

terraform {
  backend "azurerm" {
    # Backend configuration will be provided during initialization
    # Use: terraform init -backend-config="backend.hcl"
    # Or:  terraform init \
    #        -backend-config="resource_group_name=rg-terraform-state" \
    #        -backend-config="storage_account_name=stterraformstate" \
    #        -backend-config="container_name=tfstate" \
    #        -backend-config="key=ai-foundry/terraform.tfstate"
  }
}
