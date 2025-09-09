#!/bin/bash
# configure-local-settings.sh - Configure local.settings.json for Function App development

set -e

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_message "$GREEN" "Configuring local.settings.json..."

# Get values from Terraform outputs
cd ../terraform/ai_hub
AI_HUB_NAME=$(terraform output -raw ai_hub_name)
AI_PROJECT_NAME=$(terraform output -raw ai_project_name)
RESOURCE_GROUP=$(terraform output -raw resource_group_name)

# Go to function-app directory
cd ../../function-app

# Create or update local.settings.json
cat > local.settings.json <<EOF
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AI_HUB_NAME": "$AI_HUB_NAME",
    "AI_PROJECT_NAME": "$AI_PROJECT_NAME",
    "AI_RESOURCE_GROUP": "$RESOURCE_GROUP"
  }
}
EOF

print_message "$GREEN" "Successfully configured local.settings.json with:"
print_message "$GREEN" "  AI Hub: $AI_HUB_NAME"
print_message "$GREEN" "  AI Project: $AI_PROJECT_NAME"
print_message "$GREEN" "  Resource Group: $RESOURCE_GROUP"
