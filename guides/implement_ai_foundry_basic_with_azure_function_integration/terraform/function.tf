############################################################
# Azure Functions Resources
############################################################

# Note: Uses Azure CLI for deployment to support managed identity storage access,
# which isn't fully supported by the Terraform azurerm provider (v4.0+).

# Storage Account for Function App (No shared key access)
resource "null_resource" "storage_account" {
  provisioner "local-exec" {
    command = <<-EOT
      # Create storage account without shared key access (policy compliant)
      az storage account create \
        --name ${replace(module.naming.storage_account.name_unique, "-", "")} \
        --resource-group ${local.resource_group_name} \
        --location ${local.location} \
        --sku Standard_LRS \
        --kind StorageV2 \
        --min-tls-version TLS1_2 \
        --allow-blob-public-access false \
        --allow-shared-key-access false \
        --default-action Allow \
        --tags ${join(" ", [for k, v in var.tags : "${k}='${v}'"])}

      # Note: File share will be created automatically by Function App
      # when it starts with managed identity permissions
    EOT
  }

  depends_on = [azurerm_resource_group.function]

  triggers = {
    storage_name = replace(module.naming.storage_account.name_unique, "-", "")
    rg_name      = local.resource_group_name
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      az storage account delete \
        --name ${self.triggers.storage_name} \
        --resource-group ${self.triggers.rg_name} \
        --yes
    EOT
    on_failure = continue
  }
}

# Get storage account details
data "external" "storage_details" {
  program = ["bash", "-c", <<-EOT
    STORAGE_NAME="${replace(module.naming.storage_account.name_unique, "-", "")}"
    RG_NAME="${local.resource_group_name}"

    # Get storage account ID (no connection string since keys are disabled)
    STORAGE_ID=$(az storage account show \
      --name $STORAGE_NAME \
      --resource-group $RG_NAME \
      --query id -o tsv 2>/dev/null || echo "")

    # Get the storage account resource ID for managed identity access
    STORAGE_RESOURCE_ID="/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RG_NAME/providers/Microsoft.Storage/storageAccounts/$STORAGE_NAME"

    echo "{\"id\": \"$STORAGE_ID\", \"name\": \"$STORAGE_NAME\", \"resource_id\": \"$STORAGE_RESOURCE_ID\"}"
  EOT
  ]

  depends_on = [null_resource.storage_account, time_sleep.wait_for_storage]
}

# Add a delay to ensure storage account is fully provisioned
resource "time_sleep" "wait_for_storage" {
  depends_on      = [null_resource.storage_account]
  create_duration = "30s"
}

# App Service Plan for Function App
resource "azurerm_service_plan" "function" {
  name                = module.naming.app_service_plan.name_unique
  resource_group_name = local.resource_group_name
  location            = local.location
  os_type             = "Linux"
  sku_name            = var.function_sku_size
  depends_on          = [azurerm_resource_group.function]
  tags                = var.tags

  lifecycle {
    create_before_destroy = false
  }
}

# Linux Function App with Managed Identity Storage Access
resource "null_resource" "function_app" {
  provisioner "local-exec" {
    command = <<-EOT
      # Create the function app with managed identity from the start
      az functionapp create \
        --resource-group ${local.resource_group_name} \
        --name ${local.function_app_name} \
        --storage-account ${data.external.storage_details.result.name} \
        --plan ${azurerm_service_plan.function.name} \
        --runtime python \
        --runtime-version ${var.python_version} \
        --functions-version 4 \
        --os-type Linux \
        --assign-identity \
        --tags ${join(" ", [for k, v in var.tags : "${k}='${v}'"])}

      # Get the function app's managed identity principal ID
      IDENTITY_ID=$(az functionapp identity show \
        --name ${local.function_app_name} \
        --resource-group ${local.resource_group_name} \
        --query principalId -o tsv)

      # Wait for identity to propagate to Azure AD
      echo "Waiting for managed identity to propagate..."
      sleep 15

      # Grant the function app's managed identity access to the storage account
      az role assignment create \
        --assignee $IDENTITY_ID \
        --role "Storage Blob Data Owner" \
        --scope ${data.external.storage_details.result.id}

      az role assignment create \
        --assignee $IDENTITY_ID \
        --role "Storage File Data SMB Share Contributor" \
        --scope ${data.external.storage_details.result.id}

      az role assignment create \
        --assignee $IDENTITY_ID \
        --role "Storage Queue Data Contributor" \
        --scope ${data.external.storage_details.result.id}

      # Wait for role assignments to propagate
      sleep 30

      # Configure site settings (explicitly disable always-on for SKU compatibility)
      az functionapp config set \
        --name ${local.function_app_name} \
        --resource-group ${local.resource_group_name} \
        --always-on false \
        --ftps-state Disabled \
        --http20-enabled true \
        --min-tls-version 1.2

      # Get subscription ID for the connection string
      SUBSCRIPTION_ID=$(az account show --query id -o tsv)

      # Set app settings with managed identity storage configuration
      az functionapp config appsettings set \
        --name ${local.function_app_name} \
        --resource-group ${local.resource_group_name} \
        --settings \
          "FUNCTIONS_WORKER_RUNTIME=python" \
          "FUNCTIONS_EXTENSION_VERSION=~4" \
          "WEBSITE_RUN_FROM_PACKAGE=1" \
          "WEBSITE_MOUNT_ENABLED=1" \
          "SCM_DO_BUILD_DURING_DEPLOYMENT=true" \
          "PYTHON_ENABLE_WORKER_EXTENSIONS=1" \
          "PYTHON_ISOLATE_WORKER_DEPENDENCIES=1" \
          "AZURE_AI_FOUNDRY_ENDPOINT=${local.ai_foundry_endpoint}" \
          "AZURE_AI_FOUNDRY_KEY=${local.ai_foundry_key}" \
          "AZURE_AI_FOUNDRY_PROJECT_NAME=${var.foundry_ai_foundry_project_name}" \
          "APPLICATIONINSIGHTS_CONNECTION_STRING=${data.azurerm_application_insights.this.connection_string}" \
          "APPINSIGHTS_INSTRUMENTATIONKEY=${data.azurerm_application_insights.this.instrumentation_key}" \
          "WEBSITE_ENABLE_SYNC_UPDATE_SITE=true" \
          "AzureWebJobsStorage__accountName=${data.external.storage_details.result.name}" \
          "AzureWebJobsStorage__credential=managedidentity"
    EOT
  }

  depends_on = [
    time_sleep.wait_for_storage,
    azurerm_service_plan.function,
    data.external.storage_details
  ]

  triggers = {
    function_name = local.function_app_name
    rg_name       = local.resource_group_name
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      az functionapp delete \
        --name ${self.triggers.function_name} \
        --resource-group ${self.triggers.rg_name} || true
      sleep 10
    EOT
    on_failure = continue
  }
}

# Get function app details
data "external" "function_details" {
  program = ["bash", "-c", <<-EOT
    FUNCTION_NAME="${local.function_app_name}"
    RG_NAME="${local.resource_group_name}"

    FUNCTION_ID=$(az functionapp show \
      --name $FUNCTION_NAME \
      --resource-group $RG_NAME \
      --query id -o tsv 2>/dev/null || echo "")

    DEFAULT_HOSTNAME=$(az functionapp show \
      --name $FUNCTION_NAME \
      --resource-group $RG_NAME \
      --query defaultHostName -o tsv 2>/dev/null || echo "")

    IDENTITY_ID=$(az functionapp identity show \
      --name $FUNCTION_NAME \
      --resource-group $RG_NAME \
      --query principalId -o tsv 2>/dev/null || echo "")

    OUTBOUND_IPS=$(az functionapp show \
      --name $FUNCTION_NAME \
      --resource-group $RG_NAME \
      --query outboundIpAddresses -o tsv 2>/dev/null || echo "")

    echo "{\"id\": \"$FUNCTION_ID\", \"hostname\": \"$DEFAULT_HOSTNAME\", \"identity_id\": \"$IDENTITY_ID\", \"outbound_ips\": \"$OUTBOUND_IPS\"}"
  EOT
  ]

  depends_on = [null_resource.function_app, time_sleep.wait_for_function]
}

# Add a delay to ensure function app is fully provisioned
resource "time_sleep" "wait_for_function" {
  depends_on      = [null_resource.function_app]
  create_duration = "30s"
}

# Role Assignment: Function App -> AI Foundry Contributor
resource "null_resource" "role_ai_foundry_contributor" {
  provisioner "local-exec" {
    command = <<-EOT
      az role assignment create \
        --assignee ${data.external.function_details.result.identity_id} \
        --role "Cognitive Services Contributor" \
        --scope ${var.foundry_ai_foundry_id}
    EOT
  }

  depends_on = [data.external.function_details]

  triggers = {
    principal_id = data.external.function_details.result.identity_id
    scope        = var.foundry_ai_foundry_id
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      az role assignment delete \
        --assignee ${self.triggers.principal_id} \
        --role "Cognitive Services Contributor" \
        --scope ${self.triggers.scope}
    EOT
    on_failure = continue
  }
}

# Role Assignment: Function App -> AI Foundry User
resource "null_resource" "role_ai_foundry_user" {
  provisioner "local-exec" {
    command = <<-EOT
      az role assignment create \
        --assignee ${data.external.function_details.result.identity_id} \
        --role "Cognitive Services User" \
        --scope ${var.foundry_ai_foundry_id}
    EOT
  }

  depends_on = [data.external.function_details]

  triggers = {
    principal_id = data.external.function_details.result.identity_id
    scope        = var.foundry_ai_foundry_id
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      az role assignment delete \
        --assignee ${self.triggers.principal_id} \
        --role "Cognitive Services User" \
        --scope ${self.triggers.scope}
    EOT
    on_failure = continue
  }
}

# Note: Storage Blob Data Contributor role is now assigned in the function_app resource
# This ensures it's available before the function starts

# Cleanup helper to ensure function app is deleted before service plan
resource "null_resource" "cleanup_function_before_plan" {
  triggers = {
    function_name = local.function_app_name
    rg_name       = local.resource_group_name
    plan_id       = azurerm_service_plan.function.id
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      if az functionapp show --name ${self.triggers.function_name} --resource-group ${self.triggers.rg_name} &>/dev/null; then
        echo "Deleting function app ${self.triggers.function_name}..."
        az functionapp delete --name ${self.triggers.function_name} --resource-group ${self.triggers.rg_name}
        sleep 5
      fi
    EOT
    on_failure = continue
  }

  depends_on = [null_resource.function_app]
}

# Diagnostic Settings for Function App
resource "null_resource" "diagnostic_settings" {
  provisioner "local-exec" {
    command = <<-EOT
      az monitor diagnostic-settings create \
        --name "${local.function_app_name}-diagnostics" \
        --resource ${data.external.function_details.result.id} \
        --workspace ${var.foundry_log_analytics_workspace_id} \
        --logs '[{"category": "FunctionAppLogs", "enabled": true}]' \
        --metrics '[{"category": "AllMetrics", "enabled": true}]'
    EOT
  }

  depends_on = [data.external.function_details]

  triggers = {
    resource_id = data.external.function_details.result.id
    name        = "${local.function_app_name}-diagnostics"
  }

  provisioner "local-exec" {
    when       = destroy
    command    = <<-EOT
      az monitor diagnostic-settings delete \
        --name "${self.triggers.name}" \
        --resource ${self.triggers.resource_id}
    EOT
    on_failure = continue
  }
}
