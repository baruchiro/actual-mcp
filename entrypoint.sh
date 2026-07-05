#!/bin/sh
set -eu

# Optionally install a specific @actual-app/api version at container start so a
# deployment can match its self-hosted sync-server without rebuilding the image.
#
#   ACTUAL_MCP_API_VERSION unset/empty -> use the version baked into the image
#   ACTUAL_MCP_API_VERSION=26.5.2       -> install that exact version
#   ACTUAL_MCP_API_VERSION=latest       -> install the newest published version
#
# See https://github.com/baruchiro/actual-mcp/issues/24
version="${ACTUAL_MCP_API_VERSION:-}"

if [ -n "$version" ]; then
  installed=""
  if [ "$version" != "latest" ]; then
    # Read the on-disk version by file path (not as a package specifier) so an
    # "exports" map in the package cannot block the lookup.
    installed="$(node -p "require('./node_modules/@actual-app/api/package.json').version" 2>/dev/null || true)"
  fi

  if [ "$version" = "$installed" ]; then
    echo "entrypoint: @actual-app/api@${version} already installed; skipping install" >&2
  else
    echo "entrypoint: installing @actual-app/api@${version}" >&2
    if ! npm install --no-save --no-audit --no-fund "@actual-app/api@${version}"; then
      echo "entrypoint: failed to install @actual-app/api@${version}" >&2
      exit 1
    fi
  fi
fi

exec node build/index.js "$@"
