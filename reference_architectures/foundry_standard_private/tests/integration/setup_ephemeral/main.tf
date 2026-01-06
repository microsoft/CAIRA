# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

############################################################
# Ephemeral Agent Subnet Setup for Integration Tests
#
# Creates ONLY the agent subnet with dynamic CIDR allocation
# based on test run ID. This subnet is destroyed after test
# completion.
#
# Why ephemeral?
# - Agent subnets cannot be reused across Container App Environments
# - Dynamic CIDR enables parallel test execution
# - Each test gets exclusive subnet with unique address range
############################################################

terraform {
  required_version = ">= 1.13, < 2.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.9"
    }
  }
}

provider "azurerm" {
  features {
  }
}

# Lookup durable VNet from Pool 2
data "azurerm_virtual_network" "this" {
  name                = var.vnet_name
  resource_group_name = var.vnet_resource_group
}

# Generate unique CIDR based on test run ID
locals {
  # Convert run ID to number and mod by 254 to get octet (2-255)
  # Octet 0 reserved for connections subnet
  # Octet 1 reserved for future use
  # Octets 2-255 available for agent subnets (254 slots)
  octet_value = (tonumber(var.test_run_id) % 254) + 2

  # Generate CIDR: 172.16.X.0/24 where X is 2-255
  agent_cidr = "172.16.${local.octet_value}.0/24"

  # Subnet name includes run ID for traceability
  agent_name = "agent-${var.test_run_id}"
}

# Create ephemeral agent subnet with delegation
resource "azurerm_subnet" "agent" {
  name                 = local.agent_name
  resource_group_name  = data.azurerm_virtual_network.this.resource_group_name
  virtual_network_name = data.azurerm_virtual_network.this.name
  address_prefixes     = [local.agent_cidr]

  # Required to allow Private Endpoints in the subnet
  private_endpoint_network_policies = "Disabled"

  # Delegation allows Container App Environments to use this subnet
  delegation {
    name = "Microsoft.App/environments"
    service_delegation {
      name = "Microsoft.App/environments"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action"
      ]
    }
  }
}

# CRITICAL: Wait for service association link cleanup on destroy
# When AI Foundry with networkInjections (agent subnet injection) is destroyed,
# Azure creates a Container App Environment that establishes service association
# links to the subnet. These links must be cleaned up before the subnet can be
# deleted, otherwise you'll get error:
# "InUseSubnetCannotBeDeleted: Subnet is in use by .../serviceAssociationLinks/..."
#
# The wait happens DURING DESTROY ONLY to allow Azure time to clean up links.
# Using a null_resource with triggers ensures the wait occurs in the destroy phase.
resource "time_sleep" "wait_for_service_link_cleanup" {
  destroy_duration = var.subnet_destroy_time_sleep
  create_duration  = "0s" # No wait on create

  # Dummy trigger to ensure resource is created and can be destroyed
  triggers = {
    always_run = timestamp()
  }

  lifecycle {
    # Always recreate so destroy_duration is applied on every destroy
    replace_triggered_by = [terraform_data.subnet_cleanup_trigger]
  }

  # CRITICAL: Ensure subnet waits for service link cleanup before deletion
  depends_on = [azurerm_subnet.agent]
}

# Terraform data resource that changes on every apply to trigger time_sleep replacement
resource "terraform_data" "subnet_cleanup_trigger" {
  input = timestamp()
}
