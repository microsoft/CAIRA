# Commit Message Instructions

Generate commit messages following the Conventional Commits specification with scope to maintain consistent commit history.

**Reference**: [Conventional Commits Specification](https://www.conventionalcommits.org/en/v1.0.0/#specification)

## Guidelines

- Use the Conventional Commits format: `type(scope): description`
- Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`
- Scope is optional but recommended when applicable (e.g., component, module, or feature area)
- Keep the entire commit message under 100 characters
- Do not include file extensions in the scope
- Use imperative mood in the description (e.g., "add feature" not "added feature")
- Capitalize the first letter of the description
- Do not end with a period

## Examples

```text
feat(copilot): add VS Code instruction files integration
fix(devcontainer): update Copilot settings for better performance
docs(readme): update setup instructions for developers
chore(deps): bump Azure CLI to latest version
refactor(terraform): simplify module structure
```

## CAIRA-Specific Scopes

When working on CAIRA components, use these recommended scopes:

- `devcontainer`: Development container configuration
- `terraform`: Infrastructure as Code modules
- `docs`: Documentation updates
- `ci`: GitHub Actions and CI/CD
- `config`: Configuration files and settings
