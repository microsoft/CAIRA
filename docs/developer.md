<!-- META
title: Developer Guide
description: Guide for setting up and using the CAIRA development environment.
author: CAIRA Team
ms.date: 08/18/2025
ms.topic: guide
estimated_reading_time: 6
keywords:
  - devcontainer
  - codespaces
  - local development
  - prerequisites
  - tooling
  - automation
  - cross-platform
  - azure cli
-->

# Developer Guide

## Developer Environment

Depending on your needs and preferences, you can use a pre-configured development environment with either a devcontainer or GitHub Codespaces, or opt to develop on your local machine.

### Developer Containers

Using a pre-configured environment is the **preferred** approach as it comes with all the required tooling installed without changing your local environment. However, running a devcontainer requires Docker Desktop, so it may not be suitable for everyone.

To run on your machine with the cloned repo, follow [official getting started](https://code.visualstudio.com/docs/devcontainers/containers#_getting-started) and [open the folder containing the repository in a container](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-an-existing-folder-in-a-container).

[GitHub Codespaces](https://code.visualstudio.com/docs/remote/codespaces) provides a cloud-backed option. A Codespace can be created through GitHub in the browser or within VS Code. Both options are described in ["Creating a codespace for a repository"](https://docs.github.com/codespaces/developing-in-codespaces/creating-a-codespace-for-a-repository). As Codespace usage could lead to billable charges, please review [GitHub documentation on codespaces](https://docs.github.com/codespaces/about-codespaces/what-are-codespaces) for additional details.

### Local Environments

Local development is possible on Windows (with WSL 2), Linux and macOS.

Prerequisites:

- [NodeJS](https://nodejs.org/en/download/) `v22.15.0` or whatever is `LTS` with npm

Required tooling not included in the automated install:

- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Git](https://git-scm.com/downloads)
- [Task](https://taskfile.dev/installation)
- [Azure CLI](https://learn.microsoft.com/en-us/dotnet/azure/install-azure-cli)

To install the remaining required tooling, execute the following:

```sh
task tools
```

## Integration Tests

Integration tests can be run locally or in a devcontainer/Codespace. Some integration tests require additional setup, such as existing Azure resources provided by infrastructure pools or specific environment variables.

To create/verify the existence of the required Azure resources and run all integration tests, execute the following:

```sh
task tf:test:int:all:local
```

If this is the first time you are running the integration tests, you will be prompted to authenticate with Azure and select a subscription. It will be used to create the required infrastructure pools and resources during the tests.

If you want to run only specific integration tests for a specific reference architecture, go to the corresponding folder under `reference_architectures` and run:

```sh
task tf:test:int:local
```
