#!/usr/bin/env bash
# Compila engine_linux para Heroku (Linux amd64). Se ejecuta en heroku-postbuild.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE_DIR="$ROOT/cierre_engine"
OUT="$ENGINE_DIR/engine_linux"

cd "$ENGINE_DIR"

ensure_go() {
  if command -v go >/dev/null 2>&1; then
    return 0
  fi
  GO_VERSION="${GO_VERSION:-1.22.5}"
  GO_TAR="go${GO_VERSION}.linux-amd64.tar.gz"
  echo "Instalando Go ${GO_VERSION}..."
  curl -fsSL "https://go.dev/dl/${GO_TAR}" | tar -C "${HOME}" -xz
  export PATH="${HOME}/go/bin:${PATH}"
}

ensure_go

export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64

go build -trimpath -ldflags="-s -w" -o "$OUT" .

# Verificar ELF (7f 45 4c 46)
MAGIC=$(head -c 4 "$OUT" | od -An -tx1 | tr -d ' \n')
if [[ "$MAGIC" != "7f454c46" ]]; then
  echo "ERROR: engine_linux no es ELF Linux (magic: $MAGIC)"
  exit 1
fi

chmod +x "$OUT"
echo "OK: $OUT ($(wc -c < "$OUT") bytes, Linux ELF amd64)"
