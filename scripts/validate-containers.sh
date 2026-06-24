#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

build_container() {
	local name="$1"
	local dir="$2"
	local image="$3"

	echo "Building ${name} container..."
	docker build --quiet --tag "${image}" "${dir}" >/dev/null
}

build_container "OpenAI Agents SDK API" "${ROOT_DIR}/reference-architectures/app/api/typescript/openai-agents-sdk" "caira/openai-agents-sdk-api:validation"
build_container "Foundry Agent Service API" "${ROOT_DIR}/reference-architectures/app/api/typescript/foundry-agent-service" "caira/foundry-agent-service-api:validation"
build_container "React frontend" "${ROOT_DIR}/reference-architectures/app/frontend/typescript/react" "caira/react-frontend:validation"
build_container "Microsoft Agent Framework API" "${ROOT_DIR}/reference-architectures/app/api/csharp/microsoft-agent-framework" "caira/microsoft-agent-framework-api:validation"
