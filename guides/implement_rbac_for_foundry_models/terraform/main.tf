/**
 * # AI Foundry Independent Model Authorization Architecture
 *
 * Deploys a complete reference architecture with:
 * - Azure AI Foundry account and project
 * - API Management gateway
 * - Microsoft Entra application registrations and app roles
 * - APIM JWT validation and per-route role enforcement
 */

# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

data "azurerm_client_config" "current" {}

locals {
  base_name                  = var.base_name
  resource_group_resource_id = var.resource_group_resource_id != null ? var.resource_group_resource_id : azurerm_resource_group.this[0].id
  resource_group_name        = var.resource_group_resource_id != null ? provider::azapi::parse_resource_id("Microsoft.Resources/resourceGroups", var.resource_group_resource_id).resource_group_name : azurerm_resource_group.this[0].name

  route_map = {
    for rule in var.model_authorization_rules : "${lower(rule.method)}:${rule.route}" => rule
  }

  app_role_values = toset([for rule in var.model_authorization_rules : rule.required_role])
}

module "common_models" {
  source = "../../../modules/common_models"
}

module "naming" {
  source        = "Azure/naming/azurerm"
  version       = "0.4.3"
  suffix        = [local.base_name]
  unique-length = 5
}

resource "azurerm_resource_group" "this" {
  count    = var.resource_group_resource_id == null ? 1 : 0
  location = var.location
  name     = module.naming.resource_group.name_unique
  tags     = var.tags
}

resource "azurerm_virtual_network" "foundry_private" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                = module.naming.virtual_network.name
  location            = var.location
  resource_group_name = local.resource_group_name
  address_space       = var.private_network_address_space
  tags                = var.tags
}

resource "azurerm_subnet" "foundry_private_endpoint" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                 = "foundry-private-endpoints"
  resource_group_name  = local.resource_group_name
  virtual_network_name = azurerm_virtual_network.foundry_private[0].name
  address_prefixes     = var.private_endpoint_subnet_address_prefixes

  # Required to allow private endpoint resources in the subnet.
  private_endpoint_network_policies = "Disabled"
}

resource "azurerm_private_dns_zone" "cognitive" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                = "privatelink.cognitiveservices.azure.com"
  resource_group_name = local.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "cognitive" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                  = "${module.naming.private_dns_zone.name}-cognitive-link"
  resource_group_name   = local.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.cognitive[0].name
  virtual_network_id    = azurerm_virtual_network.foundry_private[0].id
  tags                  = var.tags
}

resource "azurerm_private_dns_zone" "ai_services" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                = "privatelink.services.ai.azure.com"
  resource_group_name = local.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "ai_services" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                  = "${module.naming.private_dns_zone.name}-ai-services-link"
  resource_group_name   = local.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.ai_services[0].name
  virtual_network_id    = azurerm_virtual_network.foundry_private[0].id
  tags                  = var.tags
}

resource "azurerm_private_dns_zone" "openai" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                = "privatelink.openai.azure.com"
  resource_group_name = local.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "openai" {
  count = var.should_enable_foundry_private_networking ? 1 : 0

  name                  = "${module.naming.private_dns_zone.name}-openai-link"
  resource_group_name   = local.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.openai[0].name
  virtual_network_id    = azurerm_virtual_network.foundry_private[0].id
  tags                  = var.tags
}

resource "azurerm_log_analytics_workspace" "this" {
  location            = var.location
  name                = module.naming.log_analytics_workspace.name_unique
  resource_group_name = local.resource_group_name
  retention_in_days   = 30
  sku                 = "PerGB2018"
  tags                = var.tags
}

module "application_insights" {
  source  = "Azure/avm-res-insights-component/azurerm"
  version = "0.3.0"

  location            = var.location
  name                = module.naming.application_insights.name_unique
  resource_group_name = local.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.this.id
  enable_telemetry    = var.enable_telemetry
  application_type    = "other"
  tags                = var.tags
}

module "ai_foundry" {
  source = "../../../modules/ai_foundry"

  application_insights = module.application_insights
  foundry_subnet_id    = var.should_enable_foundry_private_networking ? azurerm_subnet.foundry_private_endpoint[0].id : null
  location             = var.location
  name                 = module.naming.cognitive_account.name_unique
  resource_group_id    = local.resource_group_resource_id
  sku                  = var.sku
  tags                 = var.tags

  model_deployments = [
    module.common_models.gpt_4o_mini,
    module.common_models.gpt_5_nano,
    module.common_models.text_embedding_3_large
  ]

  depends_on = [
    azurerm_private_dns_zone_virtual_network_link.ai_services,
    azurerm_private_dns_zone_virtual_network_link.cognitive,
    azurerm_private_dns_zone_virtual_network_link.openai
  ]
}

module "default_project" {
  source = "../../../modules/ai_foundry_project"

  ai_foundry_id = module.ai_foundry.ai_foundry_id
  location      = var.location
}

resource "azuread_application" "api" {
  display_name     = "${local.base_name}-model-gateway-api"
  sign_in_audience = "AzureADMyOrg"
  owners           = [data.azurerm_client_config.current.object_id]

  dynamic "app_role" {
    for_each = local.app_role_values
    content {
      allowed_member_types = ["Application"]
      description          = "Allows invoking model route protected by ${app_role.value}."
      display_name         = replace(app_role.value, ".", " ")
      enabled              = true
      id                   = uuidv5("url", "https://caira/${local.base_name}/roles/${app_role.value}")
      value                = app_role.value
    }
  }

  web {
    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = false
    }
  }
}

resource "azuread_service_principal" "api" {
  client_id = azuread_application.api.client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application" "client" {
  for_each = var.client_applications

  display_name     = each.value.display_name
  sign_in_audience = each.value.sign_in_audience
  owners           = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "client" {
  for_each = var.client_applications

  client_id = azuread_application.client[each.key].client_id
  owners    = [data.azurerm_client_config.current.object_id]
}

locals {
  api_app_role_ids = {
    for role in azuread_application.api.app_role : role.value => role.id
  }

  client_role_pairs = flatten([
    for client_key, client in var.client_applications : [
      for role in client.assigned_roles : {
        client_key = client_key
        role       = role
      }
    ]
  ])

  client_role_pairs_map = {
    for pair in local.client_role_pairs : "${pair.client_key}:${pair.role}" => pair
  }
}

resource "azuread_app_role_assignment" "client_to_api" {
  for_each = local.client_role_pairs_map

  app_role_id         = local.api_app_role_ids[each.value.role]
  principal_object_id = azuread_service_principal.client[each.value.client_key].object_id
  resource_object_id  = azuread_service_principal.api.object_id
}

resource "azurerm_api_management" "this" {
  identity {
    type = "SystemAssigned"
  }

  location            = var.location
  name                = module.naming.api_management.name_unique
  publisher_email     = var.apim_publisher_email
  publisher_name      = var.apim_publisher_name
  resource_group_name = local.resource_group_name
  sku_name            = var.apim_sku_name
  tags                = var.tags
}

resource "azurerm_role_assignment" "apim_to_foundry" {
  principal_id         = azurerm_api_management.this.identity[0].principal_id
  role_definition_name = "Cognitive Services OpenAI User"
  scope                = module.ai_foundry.ai_foundry_id
}

resource "azurerm_api_management_api" "model_gateway" {
  api_management_name = azurerm_api_management.this.name
  display_name        = "Foundry Model Authorization Gateway"
  name                = "model-gateway"
  path                = "models"
  protocols           = ["https"]
  resource_group_name = local.resource_group_name
  revision            = "1"
  service_url         = module.ai_foundry.ai_foundry_endpoint
}

resource "azurerm_api_management_api_operation" "model_route" {
  for_each = local.route_map

  api_management_name = azurerm_api_management.this.name
  api_name            = azurerm_api_management_api.model_gateway.name
  display_name        = "${upper(each.value.method)} ${each.value.route}"
  method              = upper(each.value.method)
  operation_id        = substr(replace(replace(replace(lower(each.key), "/", "-"), ":", "-"), "_", "-"), 0, 76)
  resource_group_name = local.resource_group_name
  url_template        = each.value.route

  response {
    status_code = 200
  }
}

resource "azurerm_api_management_api_operation_policy" "model_route" {
  for_each = local.route_map

  api_management_name = azurerm_api_management.this.name
  api_name            = azurerm_api_management_api.model_gateway.name
  operation_id        = azurerm_api_management_api_operation.model_route[each.key].operation_id
  resource_group_name = local.resource_group_name

  xml_content = <<XML
<policies>
  <inbound>
    <base />
    <validate-jwt header-name="Authorization"
                  failed-validation-httpcode="401"
                  failed-validation-error-message="Unauthorized"
                  require-scheme="Bearer">
      <openid-config url="https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0/.well-known/openid-configuration" />
      <audiences>
        <audience>api://${azuread_application.api.client_id}</audience>
      </audiences>
      <required-claims>
        <claim name="roles" match="any">
          <value>${each.value.required_role}</value>
        </claim>
      </required-claims>
    </validate-jwt>

    <authentication-managed-identity resource="https://cognitiveservices.azure.com/" output-token-variable-name="msi-token" />
    <set-header name="Authorization" exists-action="override">
      <value>@("Bearer " + (string)context.Variables["msi-token"])</value>
    </set-header>

    <set-backend-service base-url="${module.ai_foundry.ai_foundry_endpoint}" />
    <rewrite-uri template="/openai/deployments/${each.value.deployment_name}/chat/completions?api-version=${var.foundry_api_version}" />
  </inbound>

  <backend>
    <base />
  </backend>

  <outbound>
    <base />
  </outbound>

  <on-error>
    <base />
  </on-error>
</policies>
XML

  depends_on = [azurerm_role_assignment.apim_to_foundry]
}
