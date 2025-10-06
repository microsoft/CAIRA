# ADR: Public Network Access

Depending on the use case (quick test, shared environment, or production workload), teams may prefer to deploy resources exposed directly to the internet, or alternatively, leverage an existing virtual network and subnets to restrict access through private endpoints only.
Allowing deployments without requiring a pre-existing virtual network and subnet significantly lowers the entry barrier, especially for new users who want to try the platform quickly.

## Decision

We will provide both **public** and **private** versions of `foundry_standard` and `foundry_basic`.

## Alternatives

- **Private-only versions**
  While this would be the most secure option for production-ready environments, it introduces too much friction for experimentation and onboarding, limiting the effectiveness of the accelerator.

## Consequences

- **Positive**: Simplifies onboarding and enables quick experimentation without additional infrastructure requirements.
- **Negative**: There is a risk of forgetting to restrict public deployments when promoting solutions to higher environments, which could lead to resources being exposed without private endpoints.
