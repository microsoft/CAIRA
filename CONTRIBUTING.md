# Contributing to CAIRA

CAIRA is a small reference library for coding agents building Azure AI solutions. If you want to use CAIRA in your own solution, start with the skill in `skills/caira/`. This guide is for repository contributors.

## Contributor workflow

Use the devcontainer when possible. For local development, install only the tools needed by the reference components:

- Task
- Node.js 24
- .NET 10 SDK
- Terraform
- Docker

Then run:

```bash
task bootstrap
task validate
```

Validation is intentionally simple: secret scanning, component dependency install, TypeScript typecheck/build, .NET build, Docker builds, and Terraform fmt/init/validate.
Run `task security`, `task validate:code`, or `task validate:containers` when you need to isolate one part of the validation flow. Run `task validate:audit`, `task security:trivy`, or `task validate:containers:trivy` when you need explicit dependency or Trivy scans outside the normal validation flow.

## Guidelines

- Keep each reference component independent and readable.
- Keep validation and tooling close to the component that uses it.
- Keep secrets and credentials in your local environment or cloud secret store.
- Keep documentation focused on how agents should use and maintain the references.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](CODE_OF_CONDUCT.md). For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com).
