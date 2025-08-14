# Environment Setup

## Overview

This document provides step-by-step instructions for setting up your development environment to work with the Composable AI Reference Architectures (CAIRA). Before you can deploy a CAIRA configuration on Azure using Terraform, you need to ensure that your system is properly configured with the necessary tools and dependencies.

## Requirements

Before proceeding with the setup, you'll need:

- An **Azure account**.
- An **Azure subscription** with access to all resource types included in the chosen configuration.
- **Azure account roles**:
  - `Contributor` role at the subscription level, or Resource Group level if providing an existing one.
  - `User Access Administrator` role at the subscription level, or Resource Group level if providing an existing one.

## Choose Preferred Working Environment

Choose to proceed with the Visual Studio Code Development Container (_see the [CAIRA development container README](https://github.com/microsoft/CAIRA/blob/main/.devcontainer/README.md) for further detail_) or continue locally.

If proceeding locally, ensure all **required tooling** is installed before moving on.

If you just want to deploy one of the configurations, you can just install the [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) and [Terraform](https://www.terraform.io/downloads.html).

If you want to develop or contribute to CAIRA, you will need to install additional tools as described in the [Developer Guide](./developer.md).

## Authenticate with Azure

Authenticate to your Azure subscription. Terraform must be able to create and manage resources within Azure.

Use the following command to login to Azure:

```shell
az login
```

If you have access to multiple subscriptions, you can set the active subscription using the following command:

```shell
az account set --subscription "<your_subscription_id>"
```

Export the subscription ID as an environment variable to make it available to the AzureRM and AzAPI Terraform providers:

```shell
export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
```

### Verify Your Setup

To ensure everything is set up correctly, run the following commands:

1. **Check Terraform Installation:**

    ```shell
    terraform version
    ```

1. **Check Azure CLI Installation:**

    ```shell
    az version
    ```

1. **Verify Azure Authentication:**

    ```shell
    az account show
    ```

    This command should return details about your currently selected Azure subscription.

1. **Verify the `ARM_SUBSCRIPTION_ID` Environment Variable:**

    ```shell
    echo $ARM_SUBSCRIPTION_ID
    ```

    This should output the selected Azure subscription ID.

## Conclusion

Your environment should now be set up and ready to be used with CAIRA. If you encounter any issues during setup, consult the [troubleshooting guide](./troubleshooting.md) for help.
