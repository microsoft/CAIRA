#!/bin/bash
# deploy-ai-model.sh - Deploy a model to AI Foundry workspace

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

print_message "$GREEN" "Deploying model to AI Foundry..."

# Get resource group and workspace from Terraform or use defaults
if [ -f "../terraform/ai_hub/terraform.tfstate" ]; then
    cd ../terraform/ai_hub
    RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "rg-ai-foundry-demo")
    AI_HUB_NAME=$(terraform output -raw ai_hub_name 2>/dev/null || echo "")
    cd - > /dev/null
else
    RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-ai-foundry-demo"}
    AI_HUB_NAME=${AI_HUB_NAME:-""}
fi

if [ -z "$AI_HUB_NAME" ]; then
    print_message "$RED" "Error: Could not determine AI Hub name"
    print_message "$YELLOW" "Please deploy AI Hub infrastructure first"
    exit 1
fi

print_message "$GREEN" "Using AI Hub: $AI_HUB_NAME"
print_message "$GREEN" "Resource Group: $RESOURCE_GROUP"

# Check existing endpoints
print_message "$YELLOW" "Checking for existing model endpoints..."
EXISTING_ENDPOINT=$(az ml online-endpoint list \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$AI_HUB_NAME" \
    --query "[0].name" \
    -o tsv 2>/dev/null || echo "")

if [ ! -z "$EXISTING_ENDPOINT" ]; then
    print_message "$YELLOW" "Found existing endpoint: $EXISTING_ENDPOINT"
    read -p "Use existing endpoint? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_message "$GREEN" "Using existing endpoint: $EXISTING_ENDPOINT"
        print_message "$GREEN" "Configuration complete!"
        exit 0
    fi
fi

# Check ML compute quota
print_message "$YELLOW" "Checking ML compute quota..."
QUOTA=$(az ml compute list-usage \
    --location "$(az ml workspace show --name $AI_HUB_NAME --resource-group $RESOURCE_GROUP --query location -o tsv)" \
    --resource-group "$RESOURCE_GROUP" \
    --workspace-name "$AI_HUB_NAME" \
    --query "[?name=='standardDSv2Family'].limit" \
    -o tsv 2>/dev/null || echo "0")

if [ "$QUOTA" == "0" ]; then
    print_message "$RED" "Warning: No ML compute quota available"
    print_message "$YELLOW" "You have the following options:"
    print_message "$YELLOW" "1. Request ML compute quota via Azure Support"
    print_message "$YELLOW" "2. Try serverless model deployment (if available in your region)"
    print_message "$YELLOW" "3. Use Azure AI Studio to deploy models manually"

    read -p "Try serverless deployment? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_message "$YELLOW" "Please deploy a model manually via Azure AI Studio:"
        print_message "$YELLOW" "https://ai.azure.com"
        exit 0
    fi

    DEPLOYMENT_TYPE="serverless"
else
    print_message "$GREEN" "ML compute quota available: $QUOTA cores"
    DEPLOYMENT_TYPE="managed"
fi

# Deployment options
if [ "$DEPLOYMENT_TYPE" == "serverless" ]; then
    print_message "$YELLOW" "Attempting serverless model deployment..."

    # Try to deploy a serverless model
    ENDPOINT_NAME="serverless-model-endpoint"

    # Create serverless endpoint YAML
    cat > serverless-endpoint.yaml <<EOF
\$schema: https://azuremlschemas.azureedge.net/latest/serverlessEndpoint.schema.json
name: $ENDPOINT_NAME
model_id: azureml://registries/azureml/models/Phi-3-mini-4k-instruct/labels/latest
EOF

    print_message "$YELLOW" "Attempting to deploy Phi-3-mini serverless endpoint..."
    if az ml serverless-endpoint create \
        --file serverless-endpoint.yaml \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$AI_HUB_NAME" 2>/dev/null; then
        print_message "$GREEN" "Successfully created serverless endpoint: $ENDPOINT_NAME"
    else
        print_message "$RED" "Serverless deployment not available in this region"
        print_message "$YELLOW" "Please deploy a model manually via Azure AI Studio:"
        print_message "$YELLOW" "https://ai.azure.com"
        rm serverless-endpoint.yaml
        exit 1
    fi

    rm serverless-endpoint.yaml

else
    # Managed endpoint deployment
    print_message "$YELLOW" "Creating managed model endpoint..."

    ENDPOINT_NAME="managed-model-endpoint"
    DEPLOYMENT_NAME="model-deployment"

    # Create managed endpoint
    print_message "$YELLOW" "Creating endpoint: $ENDPOINT_NAME"
    az ml online-endpoint create \
        --name "$ENDPOINT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$AI_HUB_NAME" \
        --auth-mode key

    # Create deployment YAML
    cat > deployment.yaml <<EOF
\$schema: https://azuremlschemas.azureedge.net/latest/managedOnlineDeployment.schema.json
name: $DEPLOYMENT_NAME
endpoint_name: $ENDPOINT_NAME
model: azureml://registries/azureml/models/gpt2/labels/latest
instance_type: Standard_DS2_v2
instance_count: 1
EOF

    print_message "$YELLOW" "Creating deployment: $DEPLOYMENT_NAME"
    if az ml online-deployment create \
        --file deployment.yaml \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$AI_HUB_NAME" \
        --all-traffic; then
        print_message "$GREEN" "Successfully created managed deployment"
    else
        print_message "$RED" "Failed to create deployment"
        print_message "$YELLOW" "This might be due to quota limitations or model availability"
        print_message "$YELLOW" "Please try deploying via Azure AI Studio:"
        print_message "$YELLOW" "https://ai.azure.com"
        rm deployment.yaml
        exit 1
    fi

    rm deployment.yaml
fi

# Get endpoint details
print_message "$GREEN" ""
print_message "$GREEN" "=== Model Deployment Complete ==="
print_message "$GREEN" "Endpoint Name: $ENDPOINT_NAME"

if [ "$DEPLOYMENT_TYPE" == "managed" ]; then
    print_message "$GREEN" "Deployment Name: $DEPLOYMENT_NAME"

    # Get endpoint URI
    SCORING_URI=$(az ml online-endpoint show \
        --name "$ENDPOINT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --workspace-name "$AI_HUB_NAME" \
        --query "scoring_uri" -o tsv)
    print_message "$GREEN" "Scoring URI: $SCORING_URI"
fi

print_message "$GREEN" ""
print_message "$GREEN" "Model deployed successfully!"
print_message "$GREEN" "Run ./configure-local-settings.sh to update your configuration"

# Update Function App if it exists
if [ -f "../terraform/azure_function/terraform.tfstate" ]; then
    cd ../terraform/azure_function
    FUNCTION_APP_NAME=$(terraform output -raw function_app_name 2>/dev/null || echo "")
    cd - > /dev/null

    if [ ! -z "$FUNCTION_APP_NAME" ]; then
        print_message "$YELLOW" ""
        print_message "$YELLOW" "Found Function App: $FUNCTION_APP_NAME"
        read -p "Update Function App configuration? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_message "$YELLOW" "Updating Function App settings..."

            DEPLOYMENT_VALUE=""
            if [ "$DEPLOYMENT_TYPE" == "managed" ]; then
                DEPLOYMENT_VALUE="$DEPLOYMENT_NAME"
            fi

            az functionapp config appsettings set \
                --name "$FUNCTION_APP_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --settings \
                "MODEL_ENDPOINT_NAME=$ENDPOINT_NAME" \
                "MODEL_DEPLOYMENT_NAME=$DEPLOYMENT_VALUE" \
                --output none

            print_message "$GREEN" "Function App settings updated!"
        fi
    fi
fi
