#!/bin/bash
# configure-local-settings.sh - Configure local.settings.json for Function App development
# This script pulls configuration from Terraform outputs and AI Foundry model deployments

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

print_message "$GREEN" "Configuring local.settings.json for AI Foundry integration..."

# Get values from Terraform outputs
print_message "$YELLOW" "Getting AI Hub configuration from Terraform..."
cd ../terraform/ai_hub
AI_HUB_NAME=$(terraform output -raw ai_hub_name 2>/dev/null || echo "")
AI_PROJECT_NAME=$(terraform output -raw ai_project_name 2>/dev/null || echo "")
RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "")
SUBSCRIPTION_ID=$(terraform output -raw subscription_id 2>/dev/null || echo "")

if [ -z "$AI_HUB_NAME" ]; then
  print_message "$RED" "Error: Could not get AI Hub configuration from Terraform"
  print_message "$YELLOW" "Make sure you've deployed the AI Hub infrastructure first"
  exit 1
fi

print_message "$GREEN" "Found AI Hub configuration:"
print_message "$GREEN" "  Hub: $AI_HUB_NAME"
print_message "$GREEN" "  Project: $AI_PROJECT_NAME"
print_message "$GREEN" "  Resource Group: $RESOURCE_GROUP"

# Check for deployed model endpoints in AI Foundry
print_message "$YELLOW" "Checking for deployed model endpoints in AI Foundry..."

# Try to find online endpoints
ENDPOINT_NAME=$(az ml online-endpoint list \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$AI_HUB_NAME" \
  --query "[0].name" \
  -o tsv 2>/dev/null || echo "")

DEPLOYMENT_NAME=""
if [ ! -z "$ENDPOINT_NAME" ]; then
  print_message "$GREEN" "Found model endpoint: $ENDPOINT_NAME"

  # Try to get deployment name
  DEPLOYMENT_NAME=$(az ml online-deployment list \
    --endpoint-name "$ENDPOINT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$AI_HUB_NAME" \
    --query "[0].name" \
    -o tsv 2>/dev/null || echo "")

  if [ ! -z "$DEPLOYMENT_NAME" ]; then
    print_message "$GREEN" "Found deployment: $DEPLOYMENT_NAME"
  fi
else
  # Check for serverless endpoints
  print_message "$YELLOW" "No managed endpoints found, checking for serverless endpoints..."
  ENDPOINT_NAME=$(az ml serverless-endpoint list \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$AI_HUB_NAME" \
    --query "[0].name" \
    -o tsv 2>/dev/null || echo "")

  if [ ! -z "$ENDPOINT_NAME" ]; then
    print_message "$GREEN" "Found serverless endpoint: $ENDPOINT_NAME"
  else
    print_message "$YELLOW" "Warning: No model endpoints found in AI Foundry"
    print_message "$YELLOW" "You'll need to deploy a model first using:"
    print_message "$YELLOW" "  1. Azure AI Studio (https://ai.azure.com)"
    print_message "$YELLOW" "  2. Or run: ./deploy-ai-model.sh"
    ENDPOINT_NAME=""
    DEPLOYMENT_NAME=""
  fi
fi

# Go to function-app directory
cd ../../function-app

# Create or update local.settings.json
cat >local.settings.json <<EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AI_HUB_NAME": "$AI_HUB_NAME",
    "AI_PROJECT_NAME": "$AI_PROJECT_NAME",
    "AI_RESOURCE_GROUP": "$RESOURCE_GROUP",
    "AI_SUBSCRIPTION_ID": "$SUBSCRIPTION_ID",
    "MODEL_ENDPOINT_NAME": "$ENDPOINT_NAME",
    "MODEL_DEPLOYMENT_NAME": "$DEPLOYMENT_NAME"
  }
}
EOF

print_message "$GREEN" "Successfully configured local.settings.json with:"
print_message "$GREEN" "  AI Hub: $AI_HUB_NAME"
print_message "$GREEN" "  AI Project: $AI_PROJECT_NAME"
print_message "$GREEN" "  Resource Group: $RESOURCE_GROUP"
print_message "$GREEN" "  Subscription ID: $SUBSCRIPTION_ID"

if [ ! -z "$ENDPOINT_NAME" ]; then
  print_message "$GREEN" "  Model Endpoint: $ENDPOINT_NAME"
  if [ ! -z "$DEPLOYMENT_NAME" ]; then
    print_message "$GREEN" "  Model Deployment: $DEPLOYMENT_NAME"
  fi
else
  print_message "$YELLOW" ""
  print_message "$YELLOW" "Note: No model endpoints configured."
  print_message "$YELLOW" "Deploy a model to AI Foundry to enable the chat endpoint."
fi

# Update Function App settings if it exists and has endpoints configured
if [ ! -z "$ENDPOINT_NAME" ] && [ -f "../terraform/azure_function/terraform.tfstate" ]; then
  print_message "$YELLOW" ""
  print_message "$YELLOW" "Checking for deployed Function App..."
  cd ../terraform/azure_function
  FUNCTION_APP_NAME=$(terraform output -raw function_app_name 2>/dev/null || echo "")
  cd - >/dev/null

  if [ ! -z "$FUNCTION_APP_NAME" ]; then
    print_message "$YELLOW" "Found Function App: $FUNCTION_APP_NAME"
    read -p "Update Function App configuration? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      print_message "$YELLOW" "Updating Function App settings..."
      az functionapp config appsettings set \
        --name "$FUNCTION_APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
        "AI_HUB_NAME=$AI_HUB_NAME" \
        "AI_PROJECT_NAME=$AI_PROJECT_NAME" \
        "AI_RESOURCE_GROUP=$RESOURCE_GROUP" \
        "AI_SUBSCRIPTION_ID=$SUBSCRIPTION_ID" \
        "MODEL_ENDPOINT_NAME=$ENDPOINT_NAME" \
        "MODEL_DEPLOYMENT_NAME=$DEPLOYMENT_NAME" \
        --output none

      print_message "$GREEN" "Function App settings updated!"
    fi
  fi
fi

print_message "$GREEN" ""
print_message "$GREEN" "Local development environment is ready!"
print_message "$GREEN" "To start the function app locally, run:"
print_message "$GREEN" "  cd function-app"
print_message "$GREEN" "  func start"
