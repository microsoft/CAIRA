#!/bin/bash
# create-function-tfvars.sh - Auto-generate terraform.tfvars for Azure Function from AI Hub outputs

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")/terraform"
AI_HUB_DIR="$TERRAFORM_DIR/ai_hub"
FUNCTION_DIR="$TERRAFORM_DIR/azure_function"

echo -e "${GREEN}=== Creating Function App terraform.tfvars ===${NC}"

# Navigate to AI Hub directory to get outputs
cd "$AI_HUB_DIR"

echo "Checking AI Hub deployment..."

# Check if AI Hub has been deployed by trying to get an output
AI_HUB_NAME=$(terraform output -raw ai_hub_name 2>/dev/null || echo "")

if [ -z "$AI_HUB_NAME" ]; then
    echo -e "${RED}Error: Cannot retrieve AI Hub outputs.${NC}"
    echo "Please ensure AI Hub has been deployed:"
    echo "  cd $AI_HUB_DIR"
    echo "  terraform apply"
    exit 1
fi

echo "Retrieving AI Hub outputs..."
AI_PROJECT_NAME=$(terraform output -raw ai_project_name 2>/dev/null || echo "")
KEY_VAULT_NAME=$(terraform output -raw key_vault_name 2>/dev/null || echo "")
APP_INSIGHTS_NAME=$(terraform output -raw application_insights_name 2>/dev/null || echo "")
STORAGE_ACCOUNT_NAME=$(terraform output -raw storage_account_name 2>/dev/null || echo "")
RANDOM_SUFFIX=$(terraform output -raw random_suffix 2>/dev/null || echo "")
RESOURCE_GROUP=$(terraform output -raw resource_group_name 2>/dev/null || echo "")

# Check if we got all required values
if [ -z "$AI_HUB_NAME" ] || [ -z "$RESOURCE_GROUP" ]; then
    echo -e "${RED}Error: Could not retrieve AI Hub outputs.${NC}"
    echo "Make sure AI Hub deployment completed successfully."
    exit 1
fi

# Navigate to Function App directory
cd "$FUNCTION_DIR"

# Create terraform.tfvars
echo -e "${YELLOW}Creating terraform.tfvars in $FUNCTION_DIR${NC}"

cat > terraform.tfvars <<EOF
# Auto-generated from AI Hub deployment - $(date)
# AI Hub resource references
ai_hub_resource_group = "$RESOURCE_GROUP"
ai_hub_name = "$AI_HUB_NAME"
ai_project_name = "$AI_PROJECT_NAME"
key_vault_name = "$KEY_VAULT_NAME"
application_insights_name = "$APP_INSIGHTS_NAME"
ai_hub_storage_account_name = "$STORAGE_ACCOUNT_NAME"

# Use the same suffix as AI Hub for consistency
use_existing_suffix = true
existing_suffix = "$RANDOM_SUFFIX"

# Function App configuration
environment = "dev"
project_name = "aifoundry"
function_app_sku = "F1"  # Free tier

# Optional: Add IP restrictions if needed
# allowed_ip_ranges = ["192.168.1.0/24"]

# Optional: CORS settings
# cors_allowed_origins = ["https://myapp.azurewebsites.net"]
EOF

echo -e "${GREEN}✓ terraform.tfvars created successfully!${NC}"
echo ""
echo "File contents:"
echo "-------------------"
cat terraform.tfvars
echo "-------------------"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Review the terraform.tfvars file"
echo "2. Run: terraform init (if not already done)"
echo "3. Run: terraform plan"
echo "4. Run: terraform apply"
echo ""
echo -e "${YELLOW}Note: Function App requires storage keys to be enabled.${NC}"
echo "If your Azure Policy blocks this, you'll need to create an exemption."
