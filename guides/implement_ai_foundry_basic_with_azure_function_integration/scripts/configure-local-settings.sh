#!/bin/bash
# configure-local-settings.sh - Configure local settings for AI Foundry integration

set -e

# Get values from Terraform outputs
cd ../terraform
AI_FOUNDRY_ENDPOINT=$(terraform output -raw ai_foundry_endpoint)
AI_FOUNDRY_PROJECT_ID=$(terraform output -raw ai_foundry_project_id)
AI_FOUNDRY_PROJECT_NAME=$(terraform output -raw ai_foundry_project_name)
RESOURCE_GROUP=$(terraform output -raw resource_group_name)

# Get subscription ID from Azure CLI
AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create local.settings.json
cd ../function-app
cat >local.settings.json <<EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AI_FOUNDRY_ENDPOINT": "$AI_FOUNDRY_ENDPOINT",
    "AI_FOUNDRY_PROJECT_ID": "$AI_FOUNDRY_PROJECT_ID",
    "AI_FOUNDRY_PROJECT_NAME": "$AI_FOUNDRY_PROJECT_NAME",
    "RESOURCE_GROUP": "$RESOURCE_GROUP",
    "AZURE_SUBSCRIPTION_ID": "$AZURE_SUBSCRIPTION_ID"
  }
}
EOF

echo "Local settings configured successfully!"
