# providers.tf - Provider configuration

# Configure the Azure Provider
provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    cognitive_account {
      purge_soft_delete_on_destroy = true
    }
  }
}

# Configure the Azure AD Provider (only if using Azure AD resources)
provider "azuread" {
  # Configuration options
}

# Configure the Random Provider (usually doesn't need configuration)
provider "random" {
  # Configuration options
}
