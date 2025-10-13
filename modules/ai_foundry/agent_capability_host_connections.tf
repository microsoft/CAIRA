# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

# Connection to Application Insights
resource "azapi_resource" "appinsights_connection" {
  count = var.application_insights != null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01"
  name                      = var.application_insights.name
  parent_id                 = azapi_resource.ai_foundry_project.id
  schema_validation_enabled = false


  body = {
    name = var.application_insights.name
    properties = {
      category      = "AppInsights"
      target        = var.application_insights.resource_id
      authType      = "ApiKey"
      isSharedToAll = false
      credentials = {
        key = var.application_insights.connection_string
      }
      metadata = {
        ApiType    = "Azure"
        ResourceId = var.application_insights.resource_id
      }
    }
  }

  depends_on = [
    azapi_resource.ai_foundry_project
  ]
}

# Connection to Cosmos DB
resource "azapi_resource" "cosmosdb_connection" {
  count = var.agent_capability_host_connections != null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01"
  name                      = var.agent_capability_host_connections.cosmos_db.name
  parent_id                 = azapi_resource.ai_foundry_project.id
  schema_validation_enabled = false

  depends_on = [
    azapi_resource.ai_foundry_project
  ]

  body = {
    name = var.agent_capability_host_connections.cosmos_db.name
    properties = {
      category = "CosmosDb"
      target   = var.agent_capability_host_connections.cosmos_db.endpoint
      authType = "AAD"
      metadata = {
        ApiType    = "Azure"
        ResourceId = var.agent_capability_host_connections.cosmos_db.resource_id
        location   = var.location
      }
    }
  }

}

# Connection to Storage Account
resource "azapi_resource" "storage_connection" {
  count = var.agent_capability_host_connections != null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01"
  name                      = var.agent_capability_host_connections.storage_account.name
  parent_id                 = azapi_resource.ai_foundry_project.id
  schema_validation_enabled = false

  depends_on = [
    azapi_resource.ai_foundry_project
  ]

  body = {
    name = var.agent_capability_host_connections.storage_account.name
    properties = {
      category = "AzureStorageAccount"
      target   = var.agent_capability_host_connections.storage_account.primary_blob_endpoint
      authType = "AAD"
      metadata = {
        ApiType    = "Azure"
        ResourceId = var.agent_capability_host_connections.storage_account.resource_id
        location   = var.location
      }
    }
  }

  response_export_values = [
    "identity.principalId"
  ]
}

# Connection to AI Search
resource "azapi_resource" "ai_search_connection" {
  count = var.agent_capability_host_connections != null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/projects/connections@2025-06-01"
  name                      = var.agent_capability_host_connections.ai_search.name
  parent_id                 = azapi_resource.ai_foundry_project.id
  schema_validation_enabled = false

  depends_on = [
    azapi_resource.ai_foundry_project
  ]

  body = {
    name = var.agent_capability_host_connections.ai_search.name
    properties = {
      category = "CognitiveSearch"
      target   = "https://${var.agent_capability_host_connections.ai_search.name}.search.windows.net"
      authType = "AAD"
      metadata = {
        ApiType    = "Azure"
        ApiVersion = "2025-05-01-preview"
        ResourceId = var.agent_capability_host_connections.ai_search.resource_id
        location   = var.location
      }
    }
  }

  response_export_values = [
    "identity.principalId"
  ]
}

# Optional destroy delay for AI Search connection
resource "time_sleep" "ai_search_connection_destroy_delay" {
  destroy_duration = "60s"

  # Ensure the connection is created before we can register this artificial dependency
  depends_on = [azapi_resource.ai_search_connection]
}

resource "azapi_resource" "ai_foundry_capability_host" {
  # Only create account-level capability host if there are connections but no agent subnet is provided
  count = var.agent_capability_host_connections != null && var.agents_subnet_id == null ? 1 : 0

  type                      = "Microsoft.CognitiveServices/accounts/capabilityHosts@2025-04-01-preview"
  name                      = "${azapi_resource.ai_foundry.name}-agents-capability-host"
  parent_id                 = azapi_resource.ai_foundry.id
  schema_validation_enabled = false

  body = {
    properties = {
      capabilityHostKind = "Agents"
    }
  }

  depends_on = [
    azapi_resource.cosmosdb_connection,
    azapi_resource.storage_connection,
    azapi_resource.ai_search_connection,

    time_sleep.wait_rbac
  ]
}

# Capability host for AI Foundry Agents
resource "azapi_resource" "ai_foundry_project_capability_host" {
  count = var.agent_capability_host_connections != null ? 1 : 0

  replace_triggers_external_values = var.agent_capability_host_connections

  depends_on = [
    azapi_resource.ai_foundry_capability_host,
    azapi_resource.cosmosdb_connection,
    azapi_resource.storage_connection,
    azapi_resource.ai_search_connection,
    time_sleep.ai_search_connection_destroy_delay,

    time_sleep.wait_rbac
  ]
  type                      = "Microsoft.CognitiveServices/accounts/projects/capabilityHosts@2025-04-01-preview"
  name                      = "agents-capability-host"
  parent_id                 = azapi_resource.ai_foundry_project.id
  schema_validation_enabled = false

  body = {
    properties = {
      capabilityHostKind = "Agents"

      vectorStoreConnections = [
        var.agent_capability_host_connections.ai_search.name
      ]

      storageConnections = [
        var.agent_capability_host_connections.storage_account.name
      ]

      threadStorageConnections = [
        var.agent_capability_host_connections.cosmos_db.name
      ]
    }
  }
}
