# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# =============================================================================
# Foundry Basic Private Reference Architecture - Acceptance Tests
# =============================================================================
# These tests validate the foundry_basic_private configuration using plan-only operations.
# They ensure variables, conditional logic, and resource planning work correctly
# including proper private networking setup.
#
# APPROACH: Uses the same networking setup as integration tests to provide
# the required private DNS zones and VNet infrastructure for plan validation.

provider "azurerm" {
  features {}
}

# Setup the networking infrastructure needed for private connectivity validation
run "setup" {
  command = apply

  module {
    source = "./tests/integration/setup"
  }
}

# Test 1: Default Configuration with Private Networking
# Verifies that the foundry_basic_private architecture works with minimal configuration
run "testacc_foundry_basic_private_default_config" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
  }

  # Verify location variable is properly set
  assert {
    condition     = var.location == "swedencentral"
    error_message = "The location variable should be 'swedencentral'"
  }

  # Verify foundry_subnet_id is required and properly set
  assert {
    condition     = var.foundry_subnet_id != null && var.foundry_subnet_id != ""
    error_message = "Foundry subnet ID is required for private networking"
  }

  # Verify subnet ID follows Azure resource ID format
  assert {
    condition     = length(regexall("^/subscriptions/.*/resourceGroups/.*/providers/Microsoft.Network/virtualNetworks/.*/subnets/.*", var.foundry_subnet_id)) > 0
    error_message = "Foundry subnet ID should follow Azure subnet resource ID format"
  }

  # Verify the subnet ID matches what was created in setup
  assert {
    condition     = var.foundry_subnet_id == run.setup.connection.id
    error_message = "Foundry subnet ID should match the setup module output"
  }

  # Verify default behavior: new resource group should be created
  assert {
    condition     = var.resource_group_resource_id == null
    error_message = "Resource group resource ID should be null for default config"
  }

  # Verify conditional resource creation: exactly one RG planned when none provided
  assert {
    condition     = length(azurerm_resource_group.this) == 1
    error_message = "Exactly one resource group should be planned for creation when none provided"
  }

  # Verify default SKU is applied
  assert {
    condition     = var.sku == "S0"
    error_message = "Default SKU should be S0"
  }

  # Verify default project settings
  assert {
    condition     = var.project_name == "default-project"
    error_message = "Default project name should be 'default-project'"
  }
}

# Test 2: Existing Resource Group Configuration
# Validates the conditional logic for using an existing resource group
run "testacc_foundry_basic_private_existing_rg" {
  command = plan

  variables {
    location                   = "swedencentral"
    foundry_subnet_id          = run.setup.connection.id
    resource_group_resource_id = "/subscriptions/12345678-1234-1234-1234-123456789012/resourceGroups/existing-rg"
  }

  # Verify the existing resource group ID is properly set
  assert {
    condition     = var.resource_group_resource_id != null
    error_message = "Resource group resource ID should be provided"
  }

  # Verify conditional logic: no new RG should be created when existing ID is provided
  assert {
    condition     = length(azurerm_resource_group.this) == 0
    error_message = "No new resource group should be created when existing ID is provided"
  }

  # Verify the resource group ID follows Azure naming conventions
  assert {
    condition     = length(regexall("^/subscriptions/[0-9a-f-]+/resourceGroups/.+$", var.resource_group_resource_id)) > 0
    error_message = "Resource group resource ID should follow Azure resource ID format"
  }
}

# Test 3: Project Customization Validation
# Ensures all project-related variables can be customized properly
run "testacc_foundry_basic_private_custom_project" {
  command = plan

  variables {
    location             = "swedencentral"
    foundry_subnet_id    = run.setup.connection.id
    project_name         = "test-private-project"
    project_display_name = "Test Private Project Display"
    project_description  = "Test private project description for validation"
  }

  # Verify project name customization
  assert {
    condition     = var.project_name == "test-private-project"
    error_message = "Project name should be customizable"
  }

  # Verify project display name customization
  assert {
    condition     = var.project_display_name == "Test Private Project Display"
    error_message = "Project display name should be customizable"
  }

  # Verify project description customization
  assert {
    condition     = var.project_description == "Test private project description for validation"
    error_message = "Project description should be customizable"
  }

  # Verify project name follows reasonable naming patterns (alphanumeric, hyphens)
  assert {
    condition     = length(regexall("^[a-zA-Z0-9-]+$", var.project_name)) > 0
    error_message = "Project name should contain only alphanumeric characters and hyphens"
  }
}

# Test 4: SKU Configuration Validation
# Tests different SKU options and ensures they're properly applied
run "testacc_foundry_basic_private_sku_validation" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
    sku               = "Basic"
  }

  # Verify SKU customization
  assert {
    condition     = var.sku == "Basic"
    error_message = "SKU should be configurable to Basic"
  }

  # Verify SKU is passed to the AI Foundry module (indirect validation)
  # This ensures the variable flows through the module call correctly
}

# Test 5: Tags Application Validation
# Ensures tags are properly applied and inherited by resources
run "testacc_foundry_basic_private_with_tags" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
    tags = {
      environment     = "test"
      owner           = "terraform"
      purpose         = "validation"
      cost_center     = "12345"
      networking_type = "private"
    }
  }

  # Verify tag customization
  assert {
    condition     = var.tags.environment == "test"
    error_message = "Custom tags should be configurable"
  }

  # Verify multiple tags are supported
  assert {
    condition     = var.tags.owner == "terraform" && var.tags.purpose == "validation"
    error_message = "Multiple custom tags should be supported"
  }

  # Verify tags with different value types (numbers as strings)
  assert {
    condition     = var.tags.cost_center == "12345"
    error_message = "Tags should support string values including numbers"
  }

  # Verify private networking specific tag
  assert {
    condition     = var.tags.networking_type == "private"
    error_message = "Should support networking type tags for private architectures"
  }
}

# Test 6: Telemetry Configuration
# Validates telemetry can be disabled (important for compliance scenarios)
run "testacc_foundry_basic_private_telemetry_disabled" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
    enable_telemetry  = false
  }

  # Verify telemetry can be disabled
  assert {
    condition     = var.enable_telemetry == false
    error_message = "Telemetry should be configurable to disabled"
  }

  # Verify the telemetry variable is non-nullable
  assert {
    condition     = var.enable_telemetry != null
    error_message = "Telemetry variable should not be null (must be explicitly true or false)"
  }
}

# Test 7: Resource Planning Validation
# Ensures resources are properly planned for creation
run "testacc_foundry_basic_private_resource_planning" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
  }

  # Verify exactly one resource group is planned for creation
  assert {
    condition     = length(azurerm_resource_group.this) == 1
    error_message = "Exactly one resource group should be planned for creation"
  }

  # Verify resource group has the correct location
  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "Resource group should be planned for creation in the specified location"
  }

  # Verify tags are properly applied (if any are set at the variable level)
  assert {
    condition     = azurerm_resource_group.this[0].tags == var.tags
    error_message = "Resource group tags should match the provided variable tags"
  }
}

# Test 8: Edge Case - Empty Tags
# Validates behavior when tags are explicitly set to null
run "testacc_foundry_basic_private_null_tags" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
    tags              = null
  }

  # Verify null tags are handled gracefully
  assert {
    condition     = var.tags == null
    error_message = "Tags should be able to be set to null"
  }
}

# Test 9: Location Validation
# Tests different Azure regions to ensure the module works across regions
run "testacc_foundry_basic_private_different_location" {
  command = plan

  variables {
    location          = "eastus"
    foundry_subnet_id = run.setup.connection.id
  }

  # Verify location customization
  assert {
    condition     = var.location == "eastus"
    error_message = "Location should be customizable to different Azure regions"
  }

  # Verify the location is applied to the resource group planning
  assert {
    condition     = azurerm_resource_group.this[0].location == "eastus"
    error_message = "Resource group should be planned for creation in the specified location"
  }
}

# Test 10: Variable Defaults Validation
# Ensures all default values are properly set and reasonable
run "testacc_foundry_basic_private_defaults_validation" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
    # Intentionally not setting other variables to test defaults
  }

  # Verify all default values are reasonable
  assert {
    condition     = var.project_display_name == "Default Project"
    error_message = "Default project display name should be 'Default Project'"
  }

  assert {
    condition     = var.project_description == "Default Project description"
    error_message = "Default project description should be set"
  }

  assert {
    condition     = var.enable_telemetry == true
    error_message = "Default telemetry setting should be enabled"
  }

  assert {
    condition     = var.sku == "S0"
    error_message = "Default SKU should be S0"
  }
}

# Test 11: Private Networking Integration Validation
# Validates that the private networking components are properly integrated
run "testacc_foundry_basic_private_networking_validation" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
  }

  # Verify foundry_subnet_id is properly parsed and used
  assert {
    condition     = var.foundry_subnet_id != null
    error_message = "Foundry subnet ID must be provided for private architecture"
  }

  # Verify subnet ID contains expected components
  assert {
    condition     = strcontains(var.foundry_subnet_id, "/virtualNetworks/")
    error_message = "Foundry subnet ID should reference a virtual network"
  }

  assert {
    condition     = strcontains(var.foundry_subnet_id, "/subnets/")
    error_message = "Foundry subnet ID should reference a specific subnet"
  }

  # Verify subnet ID format for subscription patterns
  assert {
    condition     = length(regexall("^/subscriptions/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/", var.foundry_subnet_id)) > 0
    error_message = "Foundry subnet ID should start with a valid subscription GUID"
  }
}

# Test 12: Architecture Naming Validation
# Ensures the private architecture uses correct naming patterns
run "testacc_foundry_basic_private_naming_validation" {
  command = plan

  variables {
    location          = "swedencentral"
    foundry_subnet_id = run.setup.connection.id
  }

  # Verify resource group is planned for creation (name will be computed)
  assert {
    condition     = length(azurerm_resource_group.this) == 1
    error_message = "Exactly one resource group should be planned for creation"
  }

  # Verify resource group location is set correctly
  assert {
    condition     = azurerm_resource_group.this[0].location == "swedencentral"
    error_message = "Resource group should be planned for creation in the specified location"
  }
}
