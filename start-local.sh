#!/usr/bin/env bash
set -uo pipefail

cd -- "$(dirname -- "$0")" || exit 1

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  printf '%s\n' "NVM not found at $NVM_DIR/nvm.sh. Install NVM: https://github.com/nvm-sh/nvm#installing-and-updating" >&2
  exit 1
fi

# NVM does not support errexit (set -e); check failures explicitly.
# IDE-provided npm prefixes must follow the Node version selected by NVM.
unset npm_config_prefix NPM_CONFIG_PREFIX
. "$NVM_DIR/nvm.sh" --no-use || exit 1
if ! nvm use --silent 2>/dev/null; then
  nvm install || exit 1
fi

exec node tools/serve.mjs
