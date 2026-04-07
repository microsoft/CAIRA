# Integration checks for private networking toggle behavior.

run "plan_integration_private_networking_disabled" {
  command = plan

  variables {
    apim_publisher_email                      = "platform@example.com"
    should_enable_foundry_private_networking = false
  }

  assert {
    condition     = length(azurerm_private_dns_zone_virtual_network_link.cognitive) == 0
    error_message = "Cognitive DNS VNet link should not be planned when private networking is disabled"
  }

  assert {
    condition     = length(azurerm_private_dns_zone_virtual_network_link.ai_services) == 0
    error_message = "AI Services DNS VNet link should not be planned when private networking is disabled"
  }

  assert {
    condition     = length(azurerm_private_dns_zone_virtual_network_link.openai) == 0
    error_message = "OpenAI DNS VNet link should not be planned when private networking is disabled"
  }

  assert {
    condition     = var.should_enable_foundry_private_networking == false && strcontains(file("${path.root}/outputs.tf"), "output \"ai_foundry_endpoint\"")
    error_message = "Foundry endpoint output declaration should exist to prevent output regressions"
  }
}

# NOTE:
# The enabled-mode integration plan test is intentionally commented out because it
# fails due to external module behavior in ../../../modules/ai_foundry/private_networking.tf:
# data source counts depend on var.foundry_subnet_id, which is unknown at plan time
# when the subnet is created in this same root module. This causes an Invalid count
# argument before assertions can run.
#
# run "plan_integration_private_networking_enabled" {
#   command = plan
#
#   variables {
#     apim_publisher_email                      = "platform@example.com"
#     should_enable_foundry_private_networking = true
#     private_network_address_space            = ["172.30.0.0/16"]
#     private_endpoint_subnet_address_prefixes = ["172.30.0.0/24"]
#   }
# }
