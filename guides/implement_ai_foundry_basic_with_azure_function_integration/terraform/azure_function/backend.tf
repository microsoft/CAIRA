# backend.tf - Terraform backend configuration

terraform {
  backend "azurerm" {
    # Backend configuration will be provided during initialization
    # Use: terraform init -backend-config="backend-function.hcl"
    # Or:  terraform init \
    #        -backend-config="resource_group_name=rg-terraform-state" \
    #        -backend-config="storage_account_name=stterraformstate" \
    #        -backend-config="container_name=tfstate" \
    #        -backend-config="key=azure-function/terraform.tfstate"
  }
}
