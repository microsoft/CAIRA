# Developer Guide

## Developer Environment

Depending on your needs and preferences, you can use a pre-configured development environment with either a devcontainer or GitHub Codespaces, or opt to develop on your local machine.

### Developer Containers

Using a pre-configured environment is the **preferred** approach as it comes with all the required tooling installed without changing your local environment. However, running a devcontainer requires Docker Desktop, so it may not be suitable for everyone.

To run on your machine with the cloned repo, follow [official getting started](https://code.visualstudio.com/docs/devcontainers/containers#_getting-started) and [open the folder containing the repository in a container](https://code.visualstudio.com/docs/devcontainers/containers#_quick-start-open-an-existing-folder-in-a-container).

[GitHub Codespaces](https://code.visualstudio.com/docs/remote/codespaces) provides a cloud-backed option. A Codespace can be created through GitHub in the browser or within VS Code. Both options are described in ["Creating a codespace for a repository"](https://docs.github.com/codespaces/developing-in-codespaces/creating-a-codespace-for-a-repository). As Codespace usage could lead to billable charges, please review [GitHub documentation on codespaces](https://docs.github.com/codespaces/about-codespaces/what-are-codespaces) for additional details.

### Local Environments

Local development is possible on Windows, Linux and macOS.

Prerequisites:

- [Go](https://go.dev/doc/install) `>= 1.24.3`
- [Python](https://www.python.org/downloads/) `>= 3.13` _OR_ [UV](https://docs.astral.sh/uv/getting-started/installation/)
- [NodeJS](https://nodejs.org/en/download/) `v22.15.0` or whatever is `LTS` with npm

Required tooling not included in the automated install:

- [Git](https://git-scm.com/downloads)
- [Task](https://taskfile.dev/installation)
- [Azure CLI](https://learn.microsoft.com/en-us/dotnet/azure/install-azure-cli)

To install the remaining required tooling, execute the following:

```sh
task tools
```
