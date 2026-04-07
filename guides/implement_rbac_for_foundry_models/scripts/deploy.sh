#!/usr/bin/env bash
# ---------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. Licensed under the MIT license.
# ---------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../terraform"

if [[ ! -f "${TERRAFORM_DIR}/terraform.tfvars" ]]; then
  echo "terraform.tfvars not found in ${TERRAFORM_DIR}."
  echo "Copy terraform.tfvars.example to terraform.tfvars and update values."
  exit 1
fi

cd "${TERRAFORM_DIR}"

echo "Initializing Terraform..."
terraform init

echo "Validating Terraform..."
terraform validate

echo "Planning Terraform deployment..."
terraform plan -out=tfplan

echo "Applying Terraform deployment..."
terraform apply tfplan

echo "Deployment complete."
echo "API audience client id: $(terraform output -raw api_application_client_id)"
echo "APIM models base URL:   $(terraform output -raw apim_models_base_url)"
