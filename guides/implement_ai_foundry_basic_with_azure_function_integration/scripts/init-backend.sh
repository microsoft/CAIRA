#!/bin/bash
# init-backend.sh - Initialize Terraform backend with automatic policy detection and Azure AD fallback

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
BACKEND_RG="rg-terraform-state"
BACKEND_CONTAINER="tfstate"
LOCATION="eastus"

# Detect script location and navigate to terraform directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to verify directory structure
verify_directory_structure() {
    print_header "Verifying Directory Structure"

    print_info "Script location: $SCRIPT_DIR"
    print_info "Project root: $PROJECT_ROOT"
    print_info "Terraform directory: $TERRAFORM_DIR"

    # Check if terraform directory exists
    if [ ! -d "$TERRAFORM_DIR" ]; then
        print_error "Terraform directory not found at: $TERRAFORM_DIR"
        echo ""
        echo "Expected directory structure:"
        echo "  guides/implement_ai_foundry_basic_with_azure_functions/"
        echo "  ├── scripts/"
        echo "  │   └── init-backend.sh (this script)"
        echo "  └── terraform/"
        echo "      ├── main.tf"
        echo "      ├── variables.tf"
        echo "      └── ..."
        exit 1
    fi

    # Check for required terraform files
    local required_files=("main.tf" "variables.tf" "outputs.tf")
    local missing_files=()

    for file in "${required_files[@]}"; do
        if [ ! -f "$TERRAFORM_DIR/$file" ]; then
            missing_files+=("$file")
        fi
    done

    if [ ${#missing_files[@]} -gt 0 ]; then
        print_warning "Missing Terraform files: ${missing_files[*]}"
        echo "  Make sure you have all required Terraform files in: $TERRAFORM_DIR"
    else
        print_success "All required Terraform files found"
    fi

    # Change to terraform directory
    cd "$TERRAFORM_DIR" || exit 1
    print_success "Changed to terraform directory: $(pwd)"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    local all_good=true

    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        echo "  Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        all_good=false
    else
        print_success "Azure CLI installed ($(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo 'version check failed'))"
    fi

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed"
        echo "  Install from: https://www.terraform.io/downloads"
        all_good=false
    else
        local tf_version=$(terraform version -json 2>/dev/null | grep -o '"terraform_version":"[^"]*' | cut -d'"' -f4 || echo "unknown")
        print_success "Terraform installed (version: $tf_version)"
    fi

    # Check Azure login status
    print_info "Checking Azure login status..."
    if ! az account show &> /dev/null; then
        print_warning "Not logged into Azure"
        echo ""
        echo "Please login to Azure:"
        echo -e "${BLUE}  az login${NC}"
        echo ""
        echo "After logging in, run this script again:"
        echo -e "${BLUE}  $0 $ENVIRONMENT${NC}"
        exit 1
    else
        CURRENT_SUB=$(az account show --query name -o tsv)
        CURRENT_SUB_ID=$(az account show --query id -o tsv)
        CURRENT_USER=$(az account show --query user.name -o tsv)
        CURRENT_TENANT=$(az account show --query tenantId -o tsv)

        print_success "Logged in as: $CURRENT_USER"
        print_success "Subscription: $CURRENT_SUB"
        print_info "Subscription ID: $CURRENT_SUB_ID"

        # Ask if this is the correct subscription
        echo ""
        read -p "Is this the correct subscription? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo "To switch subscriptions, run:"
            echo -e "${BLUE}  az account list --output table${NC}"
            echo -e "${BLUE}  az account set --subscription \"<subscription-name-or-id>\"${NC}"
            echo ""
            echo "Then run this script again:"
            echo -e "${BLUE}  $0 $ENVIRONMENT${NC}"
            exit 1
        fi
    fi

    if [ "$all_good" = false ]; then
        print_error "Please install missing prerequisites and try again"
        exit 1
    fi

    echo ""
}

# Function to test if key-based auth works
test_key_based_auth() {
    local storage_account=$1
    local resource_group=$2

    # Try to get storage account keys
    if az storage account keys list \
        --resource-group "$resource_group" \
        --account-name "$storage_account" \
        --query "[0].value" -o tsv &>/dev/null; then

        # Try to list containers with the key to verify it actually works
        local test_key=$(az storage account keys list \
            --resource-group "$resource_group" \
            --account-name "$storage_account" \
            --query "[0].value" -o tsv)

        if az storage container list \
            --account-name "$storage_account" \
            --account-key "$test_key" &>/dev/null; then
            return 0  # Key-based auth works
        fi
    fi

    return 1  # Key-based auth doesn't work
}

# Function to setup Azure AD authentication
setup_azure_ad_auth() {
    local storage_account=$1
    local resource_group=$2

    print_info "Setting up Azure AD authentication..."

    # Get current user's object ID
    CURRENT_USER_ID=$(az ad signed-in-user show --query id -o tsv)

    # Assign Storage Blob Data Contributor role
    print_info "Assigning Storage Blob Data Contributor role..."

    # Check if role assignment already exists
    existing_assignment=$(az role assignment list \
        --assignee "$CURRENT_USER_ID" \
        --scope "/subscriptions/$CURRENT_SUB_ID/resourceGroups/$resource_group/providers/Microsoft.Storage/storageAccounts/$storage_account" \
        --role "Storage Blob Data Contributor" \
        --query "[0].id" -o tsv 2>/dev/null)

    if [ -z "$existing_assignment" ]; then
        az role assignment create \
            --role "Storage Blob Data Contributor" \
            --assignee "$CURRENT_USER_ID" \
            --scope "/subscriptions/$CURRENT_SUB_ID/resourceGroups/$resource_group/providers/Microsoft.Storage/storageAccounts/$storage_account" \
            --output none

        print_success "Role assigned. Waiting for propagation..."
        sleep 10
    else
        print_success "Role assignment already exists"
    fi
}

# Function to create or find backend storage
setup_backend_storage() {
    print_header "Setting up Terraform Backend Storage"

    # Check if resource group exists
    if az group show --name "$BACKEND_RG" &> /dev/null; then
        print_success "Backend resource group exists: $BACKEND_RG"

        # Find existing storage account
        EXISTING_STORAGE=$(az storage account list \
            --resource-group "$BACKEND_RG" \
            --query "[?starts_with(name, 'stterraform')].name" \
            -o tsv | head -n 1)

        if [ -n "$EXISTING_STORAGE" ]; then
            BACKEND_STORAGE="$EXISTING_STORAGE"
            print_success "Using existing storage account: $BACKEND_STORAGE"
        else
            # Create new storage account
            BACKEND_STORAGE="stterraform$(date +%s)"
            print_info "Creating new storage account: $BACKEND_STORAGE"

            # Create with standard settings
            az storage account create \
                --name "$BACKEND_STORAGE" \
                --resource-group "$BACKEND_RG" \
                --location "$LOCATION" \
                --sku Standard_LRS \
                --encryption-services blob \
                --min-tls-version TLS1_2 \
                --output none

            print_success "Created storage account: $BACKEND_STORAGE"
        fi
    else
        # Create resource group and storage account
        print_info "Creating backend resource group: $BACKEND_RG"
        az group create --name "$BACKEND_RG" --location "$LOCATION" --output none
        print_success "Created resource group: $BACKEND_RG"

        BACKEND_STORAGE="stterraform$(date +%s)"
        print_info "Creating storage account: $BACKEND_STORAGE"

        az storage account create \
            --name "$BACKEND_STORAGE" \
            --resource-group "$BACKEND_RG" \
            --location "$LOCATION" \
            --sku Standard_LRS \
            --encryption-services blob \
            --min-tls-version TLS1_2 \
            --output none

        print_success "Created storage account: $BACKEND_STORAGE"
    fi

    # Test authentication method
    print_info "Testing authentication methods..."

    USE_AZURE_AD=false

    # First, check if key-based auth is even allowed on the account
    KEY_AUTH_SETTING=$(az storage account show \
        --name "$BACKEND_STORAGE" \
        --resource-group "$BACKEND_RG" \
        --query "allowSharedKeyAccess" -o tsv)

    if [ "$KEY_AUTH_SETTING" == "false" ]; then
        print_warning "Key-based authentication is disabled on storage account"

        # Try to enable it
        print_info "Attempting to enable key-based authentication..."
        if az storage account update \
            --name "$BACKEND_STORAGE" \
            --resource-group "$BACKEND_RG" \
            --allow-shared-key-access true \
            --output none 2>/dev/null; then

            sleep 2
            # Test if it actually works (policy might still block it)
            if test_key_based_auth "$BACKEND_STORAGE" "$BACKEND_RG"; then
                print_success "Key-based authentication enabled and working"
                USE_AZURE_AD=false
            else
                print_warning "Key-based auth enabled but blocked by Azure Policy"
                USE_AZURE_AD=true
            fi
        else
            print_warning "Cannot enable key-based authentication (blocked by policy)"
            USE_AZURE_AD=true
        fi
    else
        # Key-based auth is allowed on the account, but test if it actually works
        if test_key_based_auth "$BACKEND_STORAGE" "$BACKEND_RG"; then
            print_success "Key-based authentication is available and working"
            USE_AZURE_AD=false
        else
            print_warning "Key-based auth is enabled but not working (likely blocked by policy)"
            USE_AZURE_AD=true
        fi
    fi

    # Create container based on authentication method
    if [ "$USE_AZURE_AD" == "true" ]; then
        print_info "Using Azure AD authentication due to security policies"

        # Setup Azure AD authentication
        setup_azure_ad_auth "$BACKEND_STORAGE" "$BACKEND_RG"

        # Create container using Azure AD auth
        print_info "Creating container with Azure AD authentication..."

        # Check if container exists
        if az storage container show \
            --name "$BACKEND_CONTAINER" \
            --account-name "$BACKEND_STORAGE" \
            --auth-mode login &> /dev/null; then
            print_success "Container already exists: $BACKEND_CONTAINER"
        else
            # Create container with retry logic
            local retry_count=0
            local max_retries=3

            while [ $retry_count -lt $max_retries ]; do
                if az storage container create \
                    --name "$BACKEND_CONTAINER" \
                    --account-name "$BACKEND_STORAGE" \
                    --auth-mode login \
                    --output none 2>/dev/null; then
                    print_success "Created container: $BACKEND_CONTAINER (using Azure AD auth)"
                    break
                else
                    retry_count=$((retry_count + 1))
                    if [ $retry_count -lt $max_retries ]; then
                        print_warning "Container creation failed, retrying in 5 seconds... (attempt $retry_count/$max_retries)"
                        sleep 5
                    else
                        print_error "Failed to create container after $max_retries attempts"
                        echo "Please try running the script again in a few minutes"
                        exit 1
                    fi
                fi
            done
        fi
    else
        print_success "Using standard key-based authentication"

        # Get storage account key
        print_info "Getting storage account key..."
        ACCOUNT_KEY=$(az storage account keys list \
            --resource-group "$BACKEND_RG" \
            --account-name "$BACKEND_STORAGE" \
            --query "[0].value" -o tsv)

        # Check if container exists
        if az storage container show \
            --name "$BACKEND_CONTAINER" \
            --account-name "$BACKEND_STORAGE" \
            --account-key "$ACCOUNT_KEY" &> /dev/null; then
            print_success "Container already exists: $BACKEND_CONTAINER"
        else
            print_info "Creating container: $BACKEND_CONTAINER"
            az storage container create \
                --name "$BACKEND_CONTAINER" \
                --account-name "$BACKEND_STORAGE" \
                --account-key "$ACCOUNT_KEY" \
                --output none
            print_success "Created container: $BACKEND_CONTAINER (using key-based auth)"
        fi
    fi

    # Export for use in backend config
    export BACKEND_USE_AZUREAD=$USE_AZURE_AD
    export BACKEND_STORAGE
    export BACKEND_RG

    echo ""
}

# Function to create backend config file
create_backend_config() {
    print_header "Creating Backend Configuration"

    # We're already in the terraform directory

    # Backup existing backend.hcl if it exists
    if [ -f "backend.hcl" ]; then
        print_warning "Backing up existing backend.hcl to backend.hcl.backup"
        cp backend.hcl backend.hcl.backup
    fi

    # Create backend.hcl file based on authentication method
    if [ "$BACKEND_USE_AZUREAD" == "true" ]; then
        cat > backend.hcl <<EOF
# Terraform Backend Configuration
# Generated on $(date)
# Environment: ${ENVIRONMENT}
# Authentication: Azure AD (enforced by Azure Policy)
#
# DO NOT COMMIT THIS FILE TO GIT!
#
# Note: Your organization enforces Azure AD authentication for storage accounts.
# This is a security best practice that prevents the use of storage account keys.

resource_group_name  = "${BACKEND_RG}"
storage_account_name = "${BACKEND_STORAGE}"
container_name       = "${BACKEND_CONTAINER}"
key                  = "ai-foundry/${ENVIRONMENT}/terraform.tfstate"
use_azuread_auth     = true
subscription_id      = "${CURRENT_SUB_ID}"
tenant_id            = "${CURRENT_TENANT}"

# Azure AD authentication is being used because:
# - Your subscription has Azure Policies that block key-based authentication
# - This is more secure and follows Microsoft best practices
# - You've been granted 'Storage Blob Data Contributor' role automatically
EOF
        print_success "Created backend.hcl with Azure AD authentication"
        print_info "Note: Using Azure AD auth due to organizational security policies"
    else
        cat > backend.hcl <<EOF
# Terraform Backend Configuration
# Generated on $(date)
# Environment: ${ENVIRONMENT}
# Authentication: Storage Account Key
#
# DO NOT COMMIT THIS FILE TO GIT!

resource_group_name  = "${BACKEND_RG}"
storage_account_name = "${BACKEND_STORAGE}"
container_name       = "${BACKEND_CONTAINER}"
key                  = "ai-foundry/${ENVIRONMENT}/terraform.tfstate"
EOF
        print_success "Created backend.hcl with standard key-based authentication"
    fi

    print_info "Location: $TERRAFORM_DIR/backend.hcl"

    # Show the configuration
    echo ""
    echo "Backend Configuration Summary:"
    echo "------------------------------"
    echo "Resource Group:  $BACKEND_RG"
    echo "Storage Account: $BACKEND_STORAGE"
    echo "Container:       $BACKEND_CONTAINER"
    echo "State File:      ai-foundry/${ENVIRONMENT}/terraform.tfstate"
    if [ "$BACKEND_USE_AZUREAD" == "true" ]; then
        echo "Authentication:  Azure AD (Policy Enforced)"
        echo ""
        echo -e "${YELLOW}Important:${NC} Your organization requires Azure AD authentication."
        echo "This is automatically configured and no action is needed from you."
    else
        echo "Authentication:  Storage Account Key"
    fi
    echo ""
}

# Function to check for file issues
check_terraform_files() {
    print_header "Checking Terraform Files"

    # Check for duplicate providers
    if [ -f "providers.tf" ] && [ -f "versions.tf" ]; then
        if grep -q "required_providers" providers.tf 2>/dev/null; then
            print_warning "Found 'required_providers' in providers.tf"
            echo "  The 'required_providers' block should only be in versions.tf"
            echo "  Please move it from providers.tf to versions.tf"
        else
            print_success "No duplicate providers configuration found"
        fi
    fi

    # Check if backend.hcl is in .gitignore
    if [ -f ".gitignore" ]; then
        if grep -q "backend.hcl" .gitignore; then
            print_success "backend.hcl is in .gitignore"
        else
            print_warning "backend.hcl is not in .gitignore"
            echo "backend.hcl" >> .gitignore
            print_success "Added backend.hcl to .gitignore"
        fi
    else
        print_warning "No .gitignore file found, creating one"
        cat > .gitignore <<EOF
# Terraform files
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
*.tfplan
tfplan
backend.hcl
terraform.tfvars
*.auto.tfvars

# Local settings
local.settings.json
.env

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF
        print_success "Created .gitignore with common exclusions"
    fi

    echo ""
}

# Function to initialize Terraform
initialize_terraform() {
    print_header "Initializing Terraform"

    print_info "Working directory: $(pwd)"

    # Clean up any existing terraform directories
    if [ -d ".terraform" ]; then
        print_info "Cleaning existing Terraform cache..."
        rm -rf .terraform
        rm -f .terraform.lock.hcl
    fi

    # Initialize with backend config
    print_info "Running terraform init..."

    if [ "$BACKEND_USE_AZUREAD" == "true" ]; then
        print_info "Initializing with Azure AD authentication..."
        echo ""
        echo "Note: If initialization fails, it may be due to role propagation delay."
        echo "Simply wait a minute and run the script again."
        echo ""
    fi

    if terraform init -backend-config="backend.hcl" -upgrade; then
        print_success "Terraform initialized successfully!"
    else
        print_error "Terraform initialization failed"
        echo ""

        if [ "$BACKEND_USE_AZUREAD" == "true" ]; then
            echo "Since you're using Azure AD authentication, the issue might be:"
            echo "1. Role assignment hasn't propagated yet (wait 30 seconds and retry)"
            echo "2. Your Azure CLI session needs refresh: az logout && az login"
            echo "3. Check you have 'Storage Blob Data Contributor' role:"
            echo ""
            echo -e "${BLUE}az role assignment list --assignee \"$CURRENT_USER\" --scope /subscriptions/$CURRENT_SUB_ID/resourceGroups/$BACKEND_RG --output table${NC}"
        else
            echo "Common fixes:"
            echo "1. Ensure you're logged into Azure: az login"
            echo "2. Check the backend.hcl file is correct"
            echo "3. Verify you have permissions to the subscription"
        fi
        echo ""
        echo "To retry, run: $0 $ENVIRONMENT"
        exit 1
    fi

    echo ""
}

# Main execution
main() {
    print_header "AI Foundry Infrastructure - Terraform Setup"
    echo "Environment: ${ENVIRONMENT}"
    echo "Script running from: $SCRIPT_DIR"
    echo ""

    # Run checks and setup
    verify_directory_structure
    check_prerequisites
    check_terraform_files
    setup_backend_storage
    create_backend_config
    initialize_terraform

    print_header "Setup Complete! 🎉"
    echo ""
    echo "Current directory: $(pwd)"
    echo ""
    echo "Next steps:"
    echo "1. Review the configuration:"
    echo -e "   ${BLUE}terraform validate${NC}"
    echo ""
    echo "2. Review the deployment plan:"
    echo -e "   ${BLUE}terraform plan${NC}"
    echo ""
    echo "3. Deploy the infrastructure:"
    echo -e "   ${BLUE}terraform apply${NC}"
    echo ""

    if [ "$BACKEND_USE_AZUREAD" == "true" ]; then
        echo "Authentication Note:"
        echo "  Your Terraform state is secured with Azure AD authentication."
        echo "  This is enforced by your organization's security policies."
        echo ""
    fi

    echo "Your Terraform state will be stored in:"
    echo "  Storage Account: $BACKEND_STORAGE"
    echo "  Container: $BACKEND_CONTAINER"
    echo "  Key: ai-foundry/${ENVIRONMENT}/terraform.tfstate"
    echo ""
    print_success "Happy deploying!"
}

# Show usage if --help is provided
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [environment]"
    echo ""
    echo "Initialize Terraform backend for AI Foundry infrastructure"
    echo ""
    echo "Arguments:"
    echo "  environment    Environment name (default: dev)"
    echo ""
    echo "Examples:"
    echo "  $0             # Initialize for dev environment"
    echo "  $0 staging     # Initialize for staging environment"
    echo "  $0 prod        # Initialize for production environment"
    echo ""
    echo "This script automatically detects and handles:"
    echo "  - Azure Policy enforcement for storage authentication"
    echo "  - Key-based vs Azure AD authentication requirements"
    echo "  - Existing resources and reuses them appropriately"
    echo "  - Role assignments for Azure AD authentication"
    echo ""
    echo "Script location: $SCRIPT_DIR"
    echo "Terraform directory: $PROJECT_ROOT/terraform"
    echo ""
    exit 0
fi

# Run main function
main
