# Developing CAIRA reference components

CAIRA components are examples for agents to inspect, copy, and adapt. Keep every component small, readable, and independently validatable.

## Component model

- `reference-architectures/iac/foundry/` owns the Foundry foundation.
- `reference-architectures/iac/container-apps/` owns hosting for exactly two containers: API and frontend.
- `reference-architectures/app/api/**` contains unified API + agent examples. There is no separate agent container.
- `reference-architectures/app/frontend/**` contains frontend references.

Keep new contributions focused on independently useful reference components with clear validation steps.

## Validation

Run:

```bash
task validate
```

This is the same command used by the pull request workflow. It runs secret scanning and then delegates to each component's native tools:

- TypeScript: `npm run typecheck`, `npm run build`, Docker build.
- C#: `dotnet build`, vulnerability audit, Docker build.
- Terraform: `terraform fmt -check`, `terraform init -backend=false`, `terraform validate`.

For narrower checks, run `task security`, `task validate:code`, or `task validate:containers`. Dependency audits and Trivy scans are separate from the normal validation flow and can be run with `task validate:audit`, `task security:trivy`, or `task validate:containers:trivy`.

Prefer component-local scripts that preserve independent validation.
