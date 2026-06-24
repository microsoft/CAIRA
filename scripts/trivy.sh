#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRIVY_VERSION="0.70.0"

install_trivy() {
  local os arch archive url install_dir

  os="$(uname -s)"
  case "${os}" in
    Linux | Darwin) ;;
    *)
      echo "Unsupported OS for automatic Trivy install: ${os}" >&2
      exit 1
      ;;
  esac

  arch="$(uname -m)"
  case "${arch}" in
    x86_64 | amd64) arch="64bit" ;;
    aarch64 | arm64) arch="ARM64" ;;
    *)
      echo "Unsupported architecture for automatic Trivy install: ${arch}" >&2
      exit 1
      ;;
  esac

  install_dir="${HOME}/.local/bin"
  mkdir -p "${install_dir}"

  archive="$(mktemp)"
  url="https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_${os}-${arch}.tar.gz"
  curl --location --fail --silent --show-error --output "${archive}" "${url}"
  tar -xzf "${archive}" -C "${install_dir}" trivy
  rm -f "${archive}"
  chmod +x "${install_dir}/trivy"
  export PATH="${install_dir}:${PATH}"
}

if ! command -v trivy >/dev/null 2>&1; then
  install_trivy
fi

trivy fs \
  --scanners vuln,secret,misconfig \
  --severity HIGH,CRITICAL \
  --exit-code 1 \
  --ignore-unfixed \
  "${ROOT_DIR}"
