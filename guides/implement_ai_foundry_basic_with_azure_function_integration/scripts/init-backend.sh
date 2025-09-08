#!/bin/bash
# init-backend.sh - Initialize Terraform backend for AI Foundry & Azure Function modules

set -e

# Configuration
ENVIRONMENT="${1:-dev}"
BACKEND_RG="rg-terraform-state"
BACKEND_CONTAINER="tfstate"
LOCATION="eastus"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get directories
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")/terraform"

echo -e "${GREEN}=== Terraform Backend Setup ===${NC}"
echo "Environment: $ENVIRONMENT"
echo ""

# Check Azure login
if ! az account show &> /dev/null; then
    echo -e "${RED}Not logged into Azure. Please run: az login${NC}"
    exit 1
fi

SUBSCRIPTION=$(az account show --query name -o tsv)
echo "Using subscription: $SUBSCRIPTION"
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Create resource group if needed
echo "Setting up backend storage..."
if ! az group show --name "$BACKEND_RG" &> /dev/null; then
    az group create --name "$BACKEND_RG" --location "$LOCATION" --output none
fi

# Find or create storage account
STORAGE=$(az storage account list --resource-group "$BACKEND_RG" \
    --query "[?starts_with(name, 'stterraform')].name" -o tsv | head -n 1)

if [ -z "$STORAGE" ]; then
    STORAGE="stterraform$(date +%s)"
    az storage account create \
        --name "$STORAGE" \
        --resource-group "$BACKEND_RG" \
        --location "$LOCATION" \
        --sku Standard_LRS \
        --output none
fi

echo "Storage account: $STORAGE"

# Test if we can use keys or need Azure AD
USE_AZUREAD=false
if ! az storage account keys list \
    --resource-group "$BACKEND_RG" \
    --account-name "$STORAGE" &>/dev/null; then
    USE_AZUREAD=true
fi

# Try to enable key access if it's disabled
if [ "$USE_AZUREAD" = false ]; then
    KEY=$(az storage account keys list \
        --resource-group "$BACKEND_RG" \
        --account-name "$STORAGE" \
        --query "[0].value" -o tsv 2>/dev/null || true)

    if [ -z "$KEY" ] || ! az storage container list \
        --account-name "$STORAGE" \
        --account-key "$KEY" &>/dev/null; then
        USE_AZUREAD=true
    fi
fi

# Create container
if [ "$USE_AZUREAD" = true ]; then
    echo "Using Azure AD authentication (required by policy)"

    # Assign role if needed
    USER_ID=$(az ad signed-in-user show --query id -o tsv)
    az role assignment create \
        --role "Storage Blob Data Contributor" \
        --assignee "$USER_ID" \
        --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$BACKEND_RG/providers/Microsoft.Storage/storageAccounts/$STORAGE" \
        --output none 2>/dev/null || true

    sleep 5  # Wait for role propagation

    # Create container with Azure AD
    az storage container create \
        --name "$BACKEND_CONTAINER" \
        --account-name "$STORAGE" \
        --auth-mode login \
        --output none 2>/dev/null || true
else
    echo "Using key-based authentication"

    # Create container with key
    az storage container create \
        --name "$BACKEND_CONTAINER" \
        --account-name "$STORAGE" \
        --account-key "$KEY" \
        --output none 2>/dev/null || true
fi

# Initialize backend for both modules
MODULES=("ai_hub" "azure_function")
for MODULE in "${MODULES[@]}"; do
    MODULE_DIR="$TERRAFORM_DIR/$MODULE"

    # Check if module directory exists
    if [ ! -d "$MODULE_DIR" ]; then
        echo -e "${YELLOW}Warning: Module directory not found: $MODULE_DIR - skipping${NC}"
        continue
    fi

    echo ""
    echo -e "${GREEN}Configuring backend for: $MODULE${NC}"
    cd "$MODULE_DIR"

    # Determine state key based on module
    if [ "$MODULE" = "ai_hub" ]; then
        STATE_KEY="ai-hub/$ENVIRONMENT/terraform.tfstate"
    else
        STATE_KEY="azure-function/$ENVIRONMENT/terraform.tfstate"
    fi

    # Create backend.hcl
    cat > backend.hcl <<EOF
# Generated: $(date)
# Module: $MODULE
# Environment: $ENVIRONMENT
resource_group_name  = "$BACKEND_RG"
storage_account_name = "$STORAGE"
container_name       = "$BACKEND_CONTAINER"
key                  = "$STATE_KEY"
EOF

    if [ "$USE_AZUREAD" = true ]; then
        echo "use_azuread_auth = true" >> backend.hcl
    fi

    echo "Created backend.hcl in $MODULE_DIR"

    # Initialize Terraform
    echo "Initializing Terraform for $MODULE..."
    rm -rf .terraform .terraform.lock.hcl 2>/dev/null || true

    if terraform init -backend-config="backend.hcl" -upgrade; then
        echo -e "${GREEN}✓ Backend initialized for $MODULE${NC}"
    else
        echo -e "${RED}Warning: Terraform init failed for $MODULE${NC}"
        if [ "$USE_AZUREAD" = true ]; then
            echo "If using Azure AD, wait 30 seconds for role propagation and try again"
        fi
    fi
done

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "State will be stored in:"
echo "  Storage: $STORAGE"
echo "  Container: $BACKEND_CONTAINER"
echo "  AI Hub Key: ai-hub/$ENVIRONMENT/terraform.tfstate"
echo "  Function Key: azure-function/$ENVIRONMENT/terraform.tfstate"
echo ""
echo -e "${YELLOW}Remember: Don't commit backend.hcl files to git${NC}"
echo ""
echo "Next steps:"
echo "  cd terraform/ai_hub"
echo "  terraform plan"
echo "  terraform apply"
