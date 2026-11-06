#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Antero Fagerstedt
# SPDX-License-Identifier: GPL-3.0-or-later
set -uo pipefail

cd -- "$(dirname -- "$0")" || exit 1

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  printf '%s\n' "NVM not found at $NVM_DIR/nvm.sh. Install NVM: https://github.com/nvm-sh/nvm#installing-and-updating" >&2
  exit 1
fi

# NVM does not support errexit (set -e); check failures explicitly.
unset npm_config_prefix NPM_CONFIG_PREFIX
. "$NVM_DIR/nvm.sh" --no-use || exit 1
if ! nvm use --silent 2>/dev/null; then
  nvm install || exit 1
fi

if [ ! -f node_modules/@biomejs/biome/package.json ]; then
  npm ci --ignore-scripts --no-audit --no-fund || exit 1
fi

exec npm run check -- "$@"
