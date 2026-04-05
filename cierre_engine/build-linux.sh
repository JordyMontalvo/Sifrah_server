#!/usr/bin/env bash
# Binario que usa producción (pages/api/admin/closeds.js → engine_linux).
# Fuerza caché de módulos fuera del sandbox de Cursor si hiciera falta.
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${GOMODCACHE:-}" == *cursor-sandbox* ]]; then
  unset GOMODCACHE
fi
export GOMODCACHE="${GOMODCACHE:-${HOME}/go/pkg/mod}"
if [[ "$(uname -s)" == "Darwin" ]]; then
  export GOCACHE="${GOCACHE:-${HOME}/Library/Caches/go-build}"
else
  export GOCACHE="${GOCACHE:-${HOME}/.cache/go-build}"
fi

ARCH="${1:-amd64}"
case "$ARCH" in
  amd64|arm64) ;;
  *) echo "Uso: $0 [amd64|arm64]"; exit 1 ;;
esac

CGO_ENABLED=0 GOOS=linux "GOARCH=$ARCH" go build -trimpath -ldflags="-s -w" -o engine_linux .
echo "OK: $(pwd)/engine_linux"
if command -v file >/dev/null 2>&1; then file engine_linux; fi
