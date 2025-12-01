# Infrastructure Pool: Foundry Standard Private

## Overview

This module creates a durable infrastructure pool for testing the `foundry_standard_private` reference architecture. It provides shared networking, DNS, and capability host resources that persist across multiple test runs.

## Purpose

Instead of creating and destroying infrastructure for each test run, this pool:

- **Saves time**: Eliminates 8-12 minutes of setup per test run
- **Reduces costs**: Avoids repeated deployment/teardown cycles
- **Ensures consistency**: Same infrastructure across all test runs

## Resources Created

### Networking

- **Resource Group**: `rg-fstdprv-durable`
- **Virtual Network**: `vnet-fstdprv-durable` (172.16.0.0/16)
- **Connection Subnet**: `connections` (172.16.0.0/24) - for private endpoints

### DNS

- **Cognitive Services DNS Zone**: `privatelink.cognitiveservices.azure.com`
- **AI Services DNS Zone**: `privatelink.services.ai.azure.com`
- **OpenAI DNS Zone**: `privatelink.openai.azure.com`

All zones are linked to the VNet for private name resolution.

### Capability Hosts

- **Cosmos DB**: `cosmos-fstdprv-durable` (serverless, Session consistency)
- **Storage Account**: `stfstdprvdurable` (Standard LRS, shared key disabled)
- **AI Search**: `srch-fstdprv-durable` (Basic tier)

## Usage

### Initial Deployment

```bash
cd testing/infrastructure_pools/foundry_standard_private
terraform init
terraform apply
```

### Get Resource Names for Tests

```bash
terraform output -json
```

Use these outputs to configure test environment variables.

### Teardown (Only When Needed)

```bash
terraform destroy
```

**Note**: This infrastructure is designed to persist. Only destroy when:

- Changing region or network configuration
- Cleaning up after testing is complete
- Cost optimization during inactive periods

## Predictable Naming

This module uses **static naming** with the `durable` suffix instead of random suffixes. This means:

- Resource names are consistent across deployments
- No need to update GitHub variables after teardown/redeploy
- Easy to reference in scripts and documentation

Example names:

- `rg-fstdprv-durable`
- `vnet-fstdprv-durable`
- `cosmos-fstdprv-durable`
- `stfstdprvdurable`
- `srch-fstdprv-durable`

## Integration with Tests

Tests reference this infrastructure using the data module at `reference_architectures/foundry_standard_private/tests/integration/data/`.

Environment variables:

```bash
export TF_VAR_resource_group_name="rg-fstdprv-durable"
export TF_VAR_vnet_name="vnet-fstdprv-durable"
export TF_VAR_cosmosdb_account_name="cosmos-fstdprv-durable"
export TF_VAR_storage_account_name="stfstdprvdurable"
export TF_VAR_search_service_name="srch-fstdprv-durable"
```

## Variables

| Name        | Type   | Default         | Description                   |
|-------------|--------|-----------------|-------------------------------|
| `location`  | string | `swedencentral` | Azure region for deployment   |
| `base_name` | string | `fstdprv`       | Base name for resource naming |

## Outputs

| Name                    | Description              |
|-------------------------|--------------------------|
| `connection`            | Connection subnet object |
| `resource_group_name`   | Resource group name      |
| `resource_group_id`     | Resource group ID        |
| `virtual_network_id`    | Virtual network ID       |
| `private_dns_zones`     | Map of DNS zone names    |
| `cosmosdb_account_name` | Cosmos DB account name   |
| `storage_account_name`  | Storage account name     |
| `search_service_name`   | AI Search service name   |

## Maintenance

### Health Check

```bash
cd testing/infrastructure_pools/foundry_standard_private
terraform plan  # Should show no changes if healthy
```

### Update Infrastructure

```bash
# Make changes to configuration
terraform plan   # Review changes
terraform apply  # Apply updates
```

### Migrate to New Region

```bash
# 1. Update location variable
# 2. Destroy old infrastructure
terraform destroy

# 3. Deploy to new region
terraform apply

# 4. Update test environment variables with new resource names
```
