<!-- META
title: AI Foundry Independent Authorization with APIM and App Roles
description: Deployable CAIRA guide for model-level authorization using Azure AI Foundry, Microsoft Entra app registrations and roles, and APIM JWT policies.
author: CAIRA Team
ms.date: 04/06/2026
ms.topic: architecture
estimated_reading_time: 12
keywords:
   - azure ai foundry
   - apim
   - microsoft entra
   - app roles
   - jwt
   - terraform
-->

# AI Foundry Independent Authorization with APIM and App Roles

This guide provides a deployable reference architecture in Azure that enforces independent model authorization for Azure AI Foundry by combining:

- Microsoft Entra application registrations
- Application roles
- Azure API Management
- APIM JWT validation and route-level authorization policies

## What This Deploys

- Azure AI Foundry account and default project.
- Log Analytics and Application Insights for observability.
- API Management gateway for model routes.
- One API application registration with app roles derived from route rules.
- Client application registrations and role assignments.
- APIM per-operation JWT validation and model route enforcement.

## Architecture Files

- [terraform/main.tf](terraform/main.tf)
- [terraform/providers.tf](terraform/providers.tf)
- [terraform/variables.tf](terraform/variables.tf)
- [terraform/outputs.tf](terraform/outputs.tf)
- [terraform/terraform.tfvars.example](terraform/terraform.tfvars.example)
- [scripts/deploy.sh](scripts/deploy.sh)
- [assets/architecture.mmd](assets/architecture.mmd)

## Prerequisites

1. Azure subscription with permissions for resource creation and role assignments.
1. Microsoft Entra permissions to create application registrations, service principals, and app role assignments.
1. Terraform `>= 1.13`.
1. Azure CLI authenticated to the target subscription.

## Deployment Steps

1. Open [terraform](terraform).
1. Copy `terraform.tfvars.example` to `terraform.tfvars`.
1. Set `apim_publisher_email` and update `model_authorization_rules` and `client_applications` as needed.
1. Run:

```bash
terraform init
terraform validate
terraform plan
terraform apply
```

Or run the helper script:

```bash
./scripts/deploy.sh
```

## Authorization Flow

1. A client app requests a token for `api://<api_application_client_id>`.
1. The client calls an APIM route such as `/gpt4o-mini/chat/completions`.
1. APIM validates JWT issuer, audience, and role claim.
1. APIM rewrites the route to the mapped Foundry deployment endpoint.
1. APIM authenticates to Foundry using its managed identity.

## Token Request Example

```bash
TENANT_ID="<tenant-id>"
CLIENT_ID="<client-app-client-id>"
CLIENT_SECRET="<client-app-secret>"
AUDIENCE="api://<api-application-client-id>"

curl -s -X POST "https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "scope=${AUDIENCE}/.default" \
  -d "grant_type=client_credentials"
```

## APIM Call Example

```bash
APIM_MODELS_BASE_URL="https://<apim-name>.azure-api.net/models"
ACCESS_TOKEN="<token>"

curl -s -X POST "${APIM_MODELS_BASE_URL}/gpt4o-mini/chat/completions" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

## Notes on AVM Usage

This guide uses the following modules:

- `Azure/avm-res-insights-component/azurerm`
- `Azure/naming/azurerm`
- `modules/ai_foundry`
- `modules/ai_foundry_project`
- `modules/common_models`

Azure Verified Modules catalog reference:

- <<https://azure.github.io/Azure-Verified-Modules/indexes/terraform/tf-resource-modules/>

## Cleanup

```bash
terraform destroy
```
