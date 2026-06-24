#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_SOURCE="${CAIRA_SKILL_SOURCE:-${ROOT_DIR}/skills}"

if [[ -n "${CAIRA_TEST_WORKDIR:-}" ]]; then
  WORK_DIR="${CAIRA_TEST_WORKDIR}"
  mkdir -p "${WORK_DIR}"
  if [[ -n "$(find "${WORK_DIR}" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "CAIRA_TEST_WORKDIR must point to an empty directory: ${WORK_DIR}" >&2
    exit 1
  fi
  KEEP_WORK_DIR="true"
else
  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/caira-skill-test.XXXXXX")"
  KEEP_WORK_DIR="${CAIRA_KEEP_TEST_WORKDIR:-false}"
fi

cleanup() {
  if [[ "${KEEP_WORK_DIR}" != "true" ]]; then
    rm -rf "${WORK_DIR}"
  else
    echo "Keeping test workspace: ${WORK_DIR}"
  fi
}
trap cleanup EXIT

ensure_copilot() {
  if command -v copilot >/dev/null 2>&1; then
    return
  fi

  echo "GitHub Copilot CLI is required but was not found on PATH." >&2
  echo "Install it before running this test, then retry." >&2
  exit 1
}

configure_foundry_provider() {
  local foundry_config_requested="false"
  local provider_model="${COPILOT_PROVIDER_MODEL_ID:-${CAIRA_COPILOT_MODEL:-}}"

  if [[ -n "${COPILOT_PROVIDER_BASE_URL:-}" || -n "${COPILOT_PROVIDER_BEARER_TOKEN:-}" || -n "${COPILOT_PROVIDER_MODEL_ID:-}" ]]; then
    foundry_config_requested="true"
  fi

  if [[ "${foundry_config_requested}" != "true" ]]; then
    return
  fi

  if [[ -z "${COPILOT_PROVIDER_BASE_URL:-}" ]]; then
    echo "COPILOT_PROVIDER_BASE_URL is required when Foundry provider configuration is enabled." >&2
    exit 1
  fi

  if [[ -z "${COPILOT_PROVIDER_BEARER_TOKEN:-}" ]]; then
    echo "COPILOT_PROVIDER_BEARER_TOKEN is required when Foundry provider configuration is enabled." >&2
    exit 1
  fi

  if [[ -z "${CAIRA_COPILOT_MODEL:-}" && -z "${COPILOT_PROVIDER_MODEL_ID:-}" ]]; then
    echo "CAIRA_COPILOT_MODEL or COPILOT_PROVIDER_MODEL_ID is required when Foundry provider configuration is enabled." >&2
    exit 1
  fi

  if [[ "${COPILOT_PROVIDER_BASE_URL}" != */openai/v1/ && "${COPILOT_PROVIDER_BASE_URL}" != */openai/v1 ]]; then
    echo "COPILOT_PROVIDER_BASE_URL must be an Azure AI Foundry OpenAI-compatible endpoint ending in /openai/v1 or /openai/v1/." >&2
    exit 1
  fi

  export COPILOT_ENABLE_ALT_PROVIDERS="${COPILOT_ENABLE_ALT_PROVIDERS:-true}"
  export COPILOT_PROVIDER_TYPE="${COPILOT_PROVIDER_TYPE:-openai}"
  export COPILOT_PROVIDER_WIRE_API="${COPILOT_PROVIDER_WIRE_API:-responses}"
  export COPILOT_PROVIDER_MODEL_ID="${COPILOT_PROVIDER_MODEL_ID:-${provider_model}}"
  export COPILOT_PROVIDER_WIRE_MODEL="${COPILOT_PROVIDER_WIRE_MODEL:-${provider_model}}"
  CAIRA_COPILOT_MODEL="${CAIRA_COPILOT_MODEL:-${provider_model}}"
}

ensure_copilot
configure_foundry_provider

export CI="${CI:-true}"
export NO_COLOR="${NO_COLOR:-1}"

COPILOT_ARGS=(
  -C "${WORK_DIR}"
  --yolo
  --no-ask-user
  --no-auto-update
)

if [[ -n "${CAIRA_COPILOT_MODEL:-}" ]]; then
  COPILOT_ARGS+=(--model "${CAIRA_COPILOT_MODEL}")
fi

run_copilot_prompt() {
  local prompt="$1"
  local output="$2"
  local exit_code

  set +e
  copilot "${COPILOT_ARGS[@]}" --prompt "${prompt}" 2>&1 | tee "${output}"
  exit_code="${PIPESTATUS[0]}"
  set -e

  return "${exit_code}"
}

echo "Test workspace: ${WORK_DIR}"
echo "Installing CAIRA skill from ${SKILL_SOURCE}"
(
  cd "${WORK_DIR}"
  npx --yes skills add "${SKILL_SOURCE}" --skill caira --agent 'github-copilot' --yes --copy
)

read -r -d '' GENERATE_PROMPT <<'PROMPT' || true
Create an agentic monitoring system to detect security-related issues in a configured GitHub repository using Azure AI Foundry, an API, and a React frontend with a dashboard.

This is an unattended test in a brand-new empty directory. Treat the following as the clarifications and approvals you need so you can complete the task in one shot:
- Do not ask follow-up questions and do not wait for confirmation.
- Leave everything ready to deploy on Azure and run, but do not actually deploy or run anything.
- Use TypeScript for the API and React frontend.
PROMPT

GENERATOR_OUTPUT="${WORK_DIR}/.caira-test-generator.out"
echo "Running Copilot generator"
run_copilot_prompt "${GENERATE_PROMPT}" "${GENERATOR_OUTPUT}"

read -r -d '' VERIFY_PROMPT <<'PROMPT' || true
Verify the CAIRA skill test result in this workspace. Do not modify files.

The generator was expected to use the CAIRA skill to create a local scaffold for: "Create an agentic monitoring system to detect security-related issues in a configured GitHub repository using Foundry, an API, and a React frontend with a dashboard."

Inspect the workspace and the generator output in `.caira-test-generator.out`. The test passes only if all of these are true:
1. The generator created concrete project files, not only prose.
1. The generated project includes API/backend code, React frontend/dashboard code, and README or setup documentation.
1. The generated project uses placeholders or env examples instead of real secrets and does not attempt cloud deployment.
1. The generated project has an IaC layer built with Terraform that uses the Foundry Azure Verified Module for Foundry resource provisioning.
1. The generated project has an API layer that builds an agent using the deployed Foundry resources and connects it to the React frontend.

Explain your reasoning. The final line of your response must be one of the following, with no leading or trailing spaces:
CAIRA_TEST_RESULT=PASS
or
CAIRA_TEST_RESULT=FAIL
PROMPT

VERIFIER_OUTPUT="${WORK_DIR}/.caira-test-verifier.out"
echo "Running Copilot verifier"
set +e
run_copilot_prompt "${VERIFY_PROMPT}" "${VERIFIER_OUTPUT}"
VERIFIER_EXIT_CODE="$?"
set -e

VERIFIER_RESULT="$(
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' "${VERIFIER_OUTPUT}" |
    { grep -E '^CAIRA_TEST_RESULT=(PASS|FAIL)$' || true; } |
    tail -n 1 || true
)"
echo "Verifier result: ${VERIFIER_RESULT}"

if [[ "${VERIFIER_EXIT_CODE}" -eq 0 && "${VERIFIER_RESULT}" =~ ^[[:space:]]*CAIRA_TEST_RESULT=PASS[[:space:]]*$ ]]; then
  echo "CAIRA skill test passed"
else
  echo "CAIRA skill test failed" >&2
  if [[ "${VERIFIER_EXIT_CODE}" -ne 0 ]]; then
    echo "Copilot verifier exited with code ${VERIFIER_EXIT_CODE}" >&2
  fi
  echo "Generator output: ${GENERATOR_OUTPUT}" >&2
  echo "Verifier output: ${VERIFIER_OUTPUT}" >&2
  if [[ "${KEEP_WORK_DIR}" != "true" ]]; then
    echo "Re-run with CAIRA_KEEP_TEST_WORKDIR=true to inspect the workspace." >&2
  fi
  exit 1
fi
