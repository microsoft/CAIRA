# Required role assignments for the resources to be used as Agent connections

resource "azurerm_role_assignment" "cosmosdb_operator_ai_foundry_project" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    resource.time_sleep.wait_project_identities
  ]
  name                 = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}${var.resource_group_id}cosmosdboperator")
  scope                = var.agent_capability_host_connections.cosmos_db.resource_id
  role_definition_name = "Cosmos DB Operator"
  principal_id         = azapi_resource.ai_foundry_project.output.identity.principalId
}

resource "azurerm_role_assignment" "storage_blob_data_contributor_ai_foundry_project" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    resource.time_sleep.wait_project_identities
  ]
  name                 = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}${var.agent_capability_host_connections.storage_account.name}storageblobdatacontributor")
  scope                = var.agent_capability_host_connections.storage_account.resource_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azapi_resource.ai_foundry_project.output.identity.principalId
}

resource "azurerm_role_assignment" "search_index_data_contributor_ai_foundry_project" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    resource.time_sleep.wait_project_identities
  ]
  name                 = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}${var.agent_capability_host_connections.ai_search.name}searchindexdatacontributor")
  scope                = var.agent_capability_host_connections.ai_search.resource_id
  role_definition_name = "Search Index Data Contributor"
  principal_id         = azapi_resource.ai_foundry_project.output.identity.principalId
}

resource "azurerm_role_assignment" "search_service_contributor_ai_foundry_project" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    resource.time_sleep.wait_project_identities
  ]
  name                 = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}${var.agent_capability_host_connections.ai_search.name}searchservicecontributor")
  scope                = var.agent_capability_host_connections.ai_search.resource_id
  role_definition_name = "Search Service Contributor"
  principal_id         = azapi_resource.ai_foundry_project.output.identity.principalId
}

##########################

## Pause 60 seconds to allow for role assignments to propagate
##
resource "time_sleep" "wait_rbac" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    azurerm_role_assignment.cosmosdb_operator_ai_foundry_project[0],
    azurerm_role_assignment.storage_blob_data_contributor_ai_foundry_project[0],
    azurerm_role_assignment.search_index_data_contributor_ai_foundry_project[0],
    azurerm_role_assignment.search_service_contributor_ai_foundry_project[0]
  ]
  create_duration = "60s"
}

##########################

# Required data plane role assignments for the resources to be used as Agent connections

locals {
  # Convert the AI Foundry Project internalId to a GUID format
  project_id_guid = "${substr(azapi_resource.ai_foundry_project.output.properties.internalId, 0, 8)}-${substr(azapi_resource.ai_foundry_project.output.properties.internalId, 8, 4)}-${substr(azapi_resource.ai_foundry_project.output.properties.internalId, 12, 4)}-${substr(azapi_resource.ai_foundry_project.output.properties.internalId, 16, 4)}-${substr(azapi_resource.ai_foundry_project.output.properties.internalId, 20, 12)}"
}

resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_db_sql_role_aifp_user_thread_message_store" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    azapi_resource.ai_foundry_project_capability_host
  ]
  name                = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}userthreadmessage_dbsqlrole")
  resource_group_name = var.agent_capability_host_connections.cosmos_db.resource_group_name
  account_name        = var.agent_capability_host_connections.cosmos_db.name
  scope               = "${var.agent_capability_host_connections.cosmos_db.resource_id}/dbs/enterprise_memory/colls/${local.project_id_guid}-thread-message-store"
  role_definition_id  = "${var.agent_capability_host_connections.cosmos_db.resource_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = azapi_resource.ai_foundry_project.output.identity.principalId
}

resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_db_sql_role_aifp_system_thread_name" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    azurerm_cosmosdb_sql_role_assignment.cosmosdb_db_sql_role_aifp_user_thread_message_store
  ]
  name                = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}systemthread_dbsqlrole")
  resource_group_name = var.agent_capability_host_connections.cosmos_db.resource_group_name
  account_name        = var.agent_capability_host_connections.cosmos_db.name
  scope               = "${var.agent_capability_host_connections.cosmos_db.resource_id}/dbs/enterprise_memory/colls/${local.project_id_guid}-system-thread-message-store"
  role_definition_id  = "${var.agent_capability_host_connections.cosmos_db.resource_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = azapi_resource.ai_foundry_project.output.identity.principalId
}

resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_db_sql_role_aifp_entity_store_name" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    azurerm_cosmosdb_sql_role_assignment.cosmosdb_db_sql_role_aifp_system_thread_name
  ]
  name                = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}entitystore_dbsqlrole")
  resource_group_name = var.agent_capability_host_connections.cosmos_db.resource_group_name
  account_name        = var.agent_capability_host_connections.cosmos_db.name
  scope               = "${var.agent_capability_host_connections.cosmos_db.resource_id}/dbs/enterprise_memory/colls/${local.project_id_guid}-agent-entity-store"
  role_definition_id  = "${var.agent_capability_host_connections.cosmos_db.resource_id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002"
  principal_id        = azapi_resource.ai_foundry_project.output.identity.principalId
}

## Create the necessary data plane role assignments to the Azure Storage Account containers created by the AI Foundry Project
##
resource "azurerm_role_assignment" "storage_blob_data_owner_ai_foundry_project" {
  count = var.agent_capability_host_connections != null && var.agent_capability_host_connections.create_required_role_assignments ? 1 : 0

  depends_on = [
    azapi_resource.ai_foundry_project_capability_host
  ]
  name                 = uuidv5("dns", "${azapi_resource.ai_foundry_project.name}${azapi_resource.ai_foundry_project.output.identity.principalId}${var.agent_capability_host_connections.storage_account.name}storageblobdataowner")
  scope                = var.agent_capability_host_connections.storage_account.resource_id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = azapi_resource.ai_foundry_project.output.identity.principalId
  condition_version    = "2.0"
  condition            = <<-EOT
  (
    (
      !(ActionMatches{'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/tags/read'})
      AND !(ActionMatches{'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/filter/action'})
      AND !(ActionMatches{'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/tags/write'})
    )
    OR
    (@Resource[Microsoft.Storage/storageAccounts/blobServices/containers:name] StringStartsWithIgnoreCase '${local.project_id_guid}'
    AND @Resource[Microsoft.Storage/storageAccounts/blobServices/containers:name] StringLikeIgnoreCase '*-azureml-agent')
  )
  EOT
}
