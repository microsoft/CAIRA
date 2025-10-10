# Transparency Note for CAIRA (Composable AI Reference Architecture)

## What is a Transparency Note?

An AI system includes not only the technology, but also the people who will use it, the people who will be affected by it, and the environment in which it is deployed. Creating a system that is fit for its intended purpose requires an understanding of how the technology works, what its capabilities and limitations are, and how to achieve the best performance. Microsoft's Transparency Notes are intended to help you understand how our AI technology works, the choices system owners can make that influence system performance and behavior, and the importance of thinking about the whole system, including the technology, the people, and the environment. You can use Transparency Notes when developing or deploying your own system, or share them with the people who will use or be affected by your system.

Microsoft’s Transparency Notes are part of a broader effort at Microsoft to put our AI Principles into practice. To find out more, see the [Microsoft AI principles](https://www.microsoft.com/ai/responsible-ai).

## The basics of CAIRA (Composable AI Reference Architecture)

### Introduction

CAIRA (Composable AI Reference Architecture) provides a modular, composable foundation that accelerates the setup of AI environments on Azure using Infrastructure as Code (IaC). It offers baseline configurations for AI development and production environments, proven in enterprise scenarios, allowing for consistent, scalable, and reliable deployments in a fraction of the time. The system takes the form of Terraform templates and includes an AI-powered chat mode to guide users through deployment, architecture decisions, and troubleshooting. The output is provisioned resources in an Azure environment.

### Key terms

| Term                             | Definition                                                                                                                                                                                                                         |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **CAIRA**                        | Composable AI Reference Architecture. A collection of Infrastructure as Code (IaC) templates and guidance to accelerate the deployment of AI environments on Azure.                                                                |
| **Infrastructure as Code (IaC)** | The management of infrastructure (networks, virtual machines, load balancers, and connection topology) in a descriptive model, using the same versioning as DevOps team uses for source code. CAIRA uses Terraform for its IaC.    |
| **Azure AI Foundry**             | A service that provides a comprehensive and collaborative environment for building, training, and deploying machine learning models and AI applications on Azure.                                                                  |
| **Reference Architecture (RA)**  | A collection of templates, patterns, and best practices that serve as a starting point for designing and deploying a solution. CAIRA provides several reference architectures (e.g., `foundry_basic`, `foundry_standard_private`). |
| **CAIRA chat mode**              | An AI guide integrated into the development environment that assists with deploying CAIRA, making architecture decisions, and troubleshooting.                                                                                     |

## Capabilities

### System behavior

CAIRA's core functionality is providing pre-built, tested, and modular Infrastructure as Code for deploying complex AI environments on Azure. It simplifies the process of setting up services like Azure AI Foundry, networking, and other dependent resources. The system's behavior is deterministic based on the chosen reference architecture and user-provided configuration.

An integrated AI chat mode enhances the user experience. This chat mode draws from the repository's documentation and best practices to provide step-by-step guidance, explain architectural choices based on the Azure Well-Architected Framework, and help troubleshoot deployment issues. This is not a free-form conversational AI; its purpose is scoped to assisting with the discovery, deployment, and maintenance of the CAIRA templates.

### Use cases

#### Intended uses

CAIRA can be used in multiple scenarios. The system's intended uses include:

* **Experimentation:** A development team needing to quickly experiment with Azure AI Foundry can use CAIRA's basic reference architecture to spin up a lightweight, reliable environment for proofs-of-concept and testing.
* **Enterprise Starting Point:** A team can use CAIRA's standard or private reference architectures as a secure, compliant, and robust starting point for building a production-grade AI platform, customizing it to their specific enterprise requirements.

#### Considerations when choosing other use cases

We encourage teams to leverage CAIRA in their innovative solutions. However, here are some considerations when choosing a use case:

* **Architecture Choice:** The reference architectures are designed for different purposes. Using the `foundry_basic` public architecture for a production system that handles sensitive data is not recommended. Users should select the architecture (`foundry_standard_private`, for example) that matches their security and compliance needs.
* **Customization:** While CAIRA is extensible, significant deviations from the tested patterns may introduce risks. Users are responsible for validating the security and reliability of their customizations.

##### Unsupported uses

* **Running as a Live AI System:** CAIRA is an accelerator for deploying infrastructure. The "AI chat mode" component is for developer guidance and does not constitute a persistent, interactive AI system for end-users.

Legal and regulatory considerations. Organizations need to evaluate potential specific legal and regulatory obligations when using any AI services and solutions, which may not be appropriate for use in every industry or scenario. Restrictions may vary based on regional or local regulatory requirements. Additionally, AI services or solutions are not designed for and may not be used in ways prohibited in applicable terms of service and relevant codes of conduct.

## Limitations

### Technical limitations, operational factors and ranges

* **IaC, Not a Managed Service:** CAIRA is a set of open-source IaC templates, not a managed service. The user is responsible for running the code and managing the deployed infrastructure's lifecycle, including monitoring, updates, and decommissioning.
* **Technology Readiness:** The system incorporates proven patterns from real-world systems. However, as an accelerator, it is considered the "first time the whole system will be validated" in each unique system.
* **Human in the Loop:** The system is not fully autonomous. A person is required to make decisions, run the Terraform commands (`plan`, `apply`), and approve the final deployment. The system will not proceed unless a person approves.
* **Deployment Environment:** The IaC templates are designed for simple deployment environments where inputs are controlled. While the resulting infrastructure can be complex, the deployment process itself is managed within a controlled developer environment. Unexpected issues during deployment require human intervention.
* **Potential for Insecure Configurations:** If a user leaves a public-facing `foundry_basic` environment running for extended periods, it could pose a security risk. These environments are intended for temporary experimentation and should be torn down afterward.

## System performance

As CAIRA is primarily Infrastructure as Code, "performance" refers to the reliability, security, and correctness of the deployed Azure infrastructure, as well as the accuracy and helpfulness of the AI chat mode. The IaC is built on best practices from enterprise work to ensure high-quality deployments.

The AI chat mode's performance is measured by its ability to correctly interpret user intent and provide relevant, accurate guidance based on the repository's documentation. Errors in the chat mode's guidance might include suggesting an inappropriate architecture or failing to find a solution for a troubleshooting query.

### Best practices for improving system performance

* **Select the Right Architecture:** For enterprise or production use, start with the `foundry_standard` or `foundry_standard_private` architectures to ensure a higher baseline of security and observability.
* **Review Terraform Plans:** Before applying any changes, carefully review the output of the `terraform plan` command to understand what resources will be created, modified, or destroyed.
* **Provide Clear Prompts:** When interacting with the CAIRA chat mode, provide clear and specific prompts related to your goals (e.g., "Help me choose an architecture for a production environment with private networking" instead of "How do I start?").
* **Keep Environments Tidy:** Decommission experimentation environments created with `foundry_basic` once they are no longer needed to avoid security risks and unnecessary costs.

## Evaluation of CAIRA (Composable AI Reference Architecture)

### Evaluation methods

CAIRA's reference architectures and modules are evaluated based on patterns and best practices developed in real-world enterprise work. The system is validated through test deployments for each defined intended use case (Experimentation, Enterprise). The evaluation focuses on ensuring the deployed infrastructure is secure, reliable, observable, and aligns with the principles of the Azure Well-Architected Framework.

### Evaluation results

The evaluation has led to the creation of distinct reference architectures that are fit for their purpose.

* The `foundry_basic` architecture is proven to be a lightweight and reliable way to stand up an experimentation environment.
* The `foundry_standard` and `foundry_standard_private` architectures are proven to be a reliable and secure starting point for enterprise production environments.
The results of ongoing evaluation and real-world use influence decisions about the system's design, such as default security configurations, networking rules, and module parameters.

#### Fairness considerations

Since CAIRA is an Infrastructure as Code accelerator and not an AI system that makes decisions or predictions about people, fairness harms related to allocation, quality of service, or stereotyping are not directly applicable in the same way they would be for a user-facing AI model. The primary consideration is ensuring that the guidance and documentation are clear and accessible to all users, regardless of their background or level of expertise with IaC or Azure. The CAIRA chat mode is designed to democratize access to complex cloud architecture knowledge.

## Evaluating and integrating CAIRA for your use

When integrating CAIRA into your workflow, it is a best practice to start by deploying the desired reference architecture in a non-production environment. Test your application and workflows on this infrastructure to ensure it meets your requirements before promoting the configuration to production.

Ensure appropriate human oversight for your system. The person responsible for the deployment should understand the intended use of the chosen architecture, know how to interpret the `terraform plan` output, and be prepared to intervene if the deployment fails. For example, if a deployment fails due to a transient Azure API issue, the operator should know how to safely re-run the `terraform apply` command. Over-relying on the automation without understanding the underlying resources can lead to misconfigurations.

## Learn more about responsible AI

[Microsoft AI principles](https://www.microsoft.com/ai/responsible-ai)

[Microsoft responsible AI resources](https://www.microsoft.com/ai/responsible-ai-resources)

[Microsoft Azure Learning courses on responsible AI](https://learn.microsoft.com/ai)

## Learn more about CAIRA (Composable AI Reference Architecture)

* **GitHub Repository:** [https://github.com/microsoft/CAIRA](https://github.com/microsoft/CAIRA)
* **CAIRA Documentation:** [https://microsoft.github.io/CAIRA/](https://microsoft.github.io/CAIRA/)

## Contact us

Give us feedback on this document by filing an issue in the [CAIRA GitHub repository](https://github.com/microsoft/CAIRA/issues).

## About this document

© 2025 Microsoft Corporation. All rights reserved. This document is provided "as-is" and for informational purposes only. Information and views expressed in this document, including URL and other Internet Web site references, may change without notice. You bear the risk of using it. Some examples are for illustration only and are fictitious. No real association is intended or inferred.

This document is not intended to be, and should not be construed as providing, legal advice. The jurisdiction in which you’re operating may have various regulatory or legal requirements that apply to your AI system. Consult a legal specialist if you are uncertain about laws or regulations that might apply to your system, especially if you think those might impact these recommendations. Be aware that not all of these recommendations and resources will be appropriate for every scenario, and conversely, these recommendations and resources may be insufficient for some scenarios.

Published: 10/09/2025

Last updated: 10/09/2025
