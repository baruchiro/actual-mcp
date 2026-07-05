#!/usr/bin/env bash
# End-to-end check for the ACTUAL_MCP_API_VERSION feature (issue #24): run the
# real container in each mode and assert which @actual-app/api version actually
# ends up installed. Expects a built image plus the resolved versions in env:
#   IMAGE, BAKED (version baked into the image), LATEST, SPECIFIC.
set -euo pipefail

IMAGE="${IMAGE:?IMAGE env var is required}"
BAKED="${BAKED:?BAKED env var is required}"
LATEST="${LATEST:?LATEST env var is required}"
SPECIFIC="${SPECIFIC:?SPECIFIC env var is required}"

CONTAINERS="e2e-default e2e-specific e2e-latest"

cleanup() {
  for c in $CONTAINERS; do
    docker rm -f "$c" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT

fail() {
  echo "❌ $*" >&2
  exit 1
}

# Echo the @actual-app/api version installed inside a running container.
installed_version() {
  docker exec "$1" node -p "require('/app/node_modules/@actual-app/api/package.json').version" | tr -d '\r\n'
}

# Start the real container in stdio mode (-i keeps it alive so we can inspect it),
# wait until the server reports it has started — which only happens after the
# entrypoint's install step — then assert the installed version equals $expected.
assert_running_version() {
  name="$1"
  expected="$2"
  shift 2

  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -di --name "$name" "$@" "$IMAGE" >/dev/null

  deadline=$((SECONDS + 120))
  until docker logs "$name" 2>&1 | grep -q "Actual Budget MCP Server (stdio) started"; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "----- docker logs ($name) -----" >&2
      docker logs "$name" >&2 || true
      fail "[$name] server did not start within 120s"
    fi
    sleep 2
  done

  got=$(installed_version "$name")
  [ "$got" = "$expected" ] || fail "[$name] expected @actual-app/api@$expected, container has @$got"
  echo "✅ [$name] @actual-app/api@$got (expected $expected)"
  docker rm -f "$name" >/dev/null 2>&1 || true
}

echo "::group::Default (unset) keeps the baked-in version ($BAKED)"
assert_running_version e2e-default "$BAKED"
echo "::endgroup::"

echo "::group::Explicit pin installs that exact version ($SPECIFIC)"
assert_running_version e2e-specific "$SPECIFIC" -e "ACTUAL_MCP_API_VERSION=$SPECIFIC"
echo "::endgroup::"

echo "::group::latest installs the newest published version ($LATEST)"
assert_running_version e2e-latest "$LATEST" -e "ACTUAL_MCP_API_VERSION=latest"
echo "::endgroup::"

echo "::group::An uninstallable version makes the entrypoint fail fast"
set +e
out=$(docker run --rm -e ACTUAL_MCP_API_VERSION=99.99.99 "$IMAGE" 2>&1)
code=$?
set -e
echo "$out"
[ "$code" -ne 0 ] || fail "expected a non-zero exit for an uninstallable version"
echo "$out" | grep -q "failed to install @actual-app/api@99.99.99" ||
  fail "expected the entrypoint's 'failed to install' message"
echo "✅ [e2e-invalid] entrypoint exited $code without starting the server"
echo "::endgroup::"

echo "All ACTUAL_MCP_API_VERSION e2e scenarios passed."
