# Run action.mjs with local inputs for testing on dev machine
# Assume ACCESS_TOKEN is already set in environment
export PACKAGE_ID="@connected-web/pnpfos-ci-pipeline-test"
# export OPENAPI_SPEC_FILE="stubs/SampleOpenAPISpec.json"
export OPENAPI_SPEC_URL="https://chasm-api.dev.connected-web.services/openapi"
export VERSION="0.0.0-local-sh-test"
export PREVIEW_MODE="true"

rm -rf @connected-web

node action.mjs

node local-test-package.mjs
tsx local-test-package.ts
