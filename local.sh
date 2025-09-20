# Run action.mjs with local inputs for testing on dev machine
# Assume API_ACCESS_TOKEN is already set in environment
export PACKAGE_ID="@connected-web/pnpfos-ci-pipeline-test"
# export OPENAPI_SPEC_FILE="stubs/SampleOpenAPISpec.json"
export OPENAPI_SPEC_URL="https://chasm-api.dev.connected-web.services/openapi"
export VERSION="0.0.0-local-sh-test"
export PREVIEW_MODE="true"

export OAUTH_CLIENT_ID=""
export OAUTH_CLIENT_SECRET=""
export OAUTH_TOKEN_ENDPOINT="https://connected-web-dev.auth.eu-west-2.amazoncognito.com/oauth2/token"

rm -rf @connected-web

export API_ACCESS_TOKEN="$(node generate-token.mjs)"
if [ $? -ne 0 ]; then
  echo "[local] Token generation failed - exiting"
  exit 1
fi

node action.mjs
if [ $? -ne 0 ]; then
  echo "[local] Action failed - exiting"
  exit 1
fi

node local-test-package.mjs
if [ $? -ne 0 ]; then
  echo "[local] Local test package failed - exiting"
  exit 1
fi

tsx local-test-package.ts
if [ $? -ne 0 ]; then
  echo "[local] Local test package (TSX) failed - exiting"
  exit 1
fi

echo "[local] All done"

