# Contributing to CAIRA

Welcome to CAIRA (Composable AI Reference Architectures)! We're excited that you're interested in contributing to this open-source project that provides different reference architectures and infrastructure patterns for AI workloads on Azure.

## Microsoft CLA

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to grant us the rights to use your contribution. When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA.

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](CODE_OF_CONDUCT.md). For more information, see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com).

## How Can I Contribute?

There are many ways to contribute to CAIRA:

- **Report bugs** - Log a Bug Report with detailed reproduction steps
- **Suggest enhancements** - Open a Feature Request issue to discuss new features
- **Submit code changes** - Fix bugs or implement features - please ensure there is an associated issue with the PR!
- **Improve documentation** - Help make our docs clearer and more comprehensive
- **Review pull requests** - Help review and test changes from other contributors

## Quick Start

1. **Read our [Code of Conduct](CODE_OF_CONDUCT.md)**
1. **Set up your development environment** - Refer to the [developer guide](docs/developer.md)
1. **Choose your contribution type** - Refer to [Types of Contributions](docs/contributing/types_of_contributions.md)
1. **Follow our development workflow** - Refer to [Development Workflow](docs/contributing/development_workflow.md)
1. **Submit a pull request** - Refer to [Pull Request Guide](docs/contributing/pull_request_guide.md)

## Essential Guidelines

### Code Quality

- Use our linting tools: `task lint`
- Write clear, maintainable code

### Security

- Never commit secrets or credentials
- Report vulnerabilities via the resources available in [security guidelines](SECURITY.md).
- Follow Azure security best practices

### Testing

```bash
# Run all tests
task test

# Run linting
task lint
```

## Detailed Guides

| Topic                    | Guide                                                                   |
|--------------------------|-------------------------------------------------------------------------|
| **Contribution Types**   | [Contribution Types Guide](docs/contributing/types_of_contributions.md) |
| **Development Workflow** | [Developer Workflow Process](docs/contributing/development_workflow.md) |
| **Pull Request Process** | [Pull Request Guide](docs/contributing/pull_request_guide.md)           |
| **Code Review**          | [Code Review Guidelines](docs/contributing/code_review_guidelines.md)   |
| **Linting Tools**        | [Linters](docs/contributing/linters.md)                                 |

## Getting Help

- **Documentation**: Check our [docs](docs/) directory
- **Issues**: Search existing issues or create a new one
- **Developer Guide**: Consult the [developer guide](docs/developer.md) for setup help

Thank you for contributing to CAIRA!
