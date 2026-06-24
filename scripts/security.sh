#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GITLEAKS_VERSION="8.30.0"

install_gitleaks() {
  local os arch archive url install_dir

  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"
  case "${arch}" in
    x86_64 | amd64) arch="x64" ;;
    aarch64 | arm64) arch="arm64" ;;
    *)
      echo "Unsupported architecture for automatic Gitleaks install: ${arch}" >&2
      exit 1
      ;;
  esac

  install_dir="${HOME}/.local/bin"
  mkdir -p "${install_dir}"

  archive="$(mktemp)"
  url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${os}_${arch}.tar.gz"
  curl --location --fail --silent --show-error --output "${archive}" "${url}"
  tar -xzf "${archive}" -C "${install_dir}" gitleaks
  rm -f "${archive}"
  chmod +x "${install_dir}/gitleaks"
  export PATH="${install_dir}:${PATH}"
}

if ! command -v gitleaks >/dev/null 2>&1; then
  install_gitleaks
fi

gitleaks detect \
  --config "${ROOT_DIR}/.github/linters/.gitleaks.toml" \
  --redact=90 \
  --source "${ROOT_DIR}" \
  --no-banner
