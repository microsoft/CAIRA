#!/bin/bash
# deploy.sh - Single deployment script for AI Foundry with Functions
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_message() {
  echo -e "${1}${2}${NC}"
}

print_message "$GREEN" "Deploying AI Foundry Basic with Azure Functions..."

# Navigate to terraform directory
cd ../terraform

# Initialize Terraform
print_message "$YELLOW" "Initializing Terraform..."
terraform init

# Plan deployment
print_message "$YELLOW" "Planning deployment..."
terraform plan

# Apply deployment
print_message "$YELLOW" "Applying deployment..."
terraform apply

# Get outputs for function configuration
AI_FOUNDRY_ENDPOINT=$(terraform output -raw ai_foundry_endpoint)
FUNCTION_APP_NAME=$(terraform output -raw function_app_name)

print_message "$GREEN" "Deployment complete!"
print_message "$GREEN" "AI Foundry Endpoint: $AI_FOUNDRY_ENDPOINT"
print_message "$GREEN" "Function App: $FUNCTION_APP_NAME"

# Deploy function code
print_message "$YELLOW" "Deploying function code..."
cd ../function-app
func azure functionapp publish "$FUNCTION_APP_NAME" --python --build remote

print_message "$GREEN" "Function deployment complete!"
