#!/usr/bin/env bash
CI_DEBUG=${CI_DEBUG:-}
DEBUG=${DEBUG:-}

if [ -n "${CI_DEBUG}" ]; then
  DEBUG="true"
fi

if [ "${DEBUG,,}" != "true" ]; then
  DEBUG=""
fi

set -eu

ACTION="create"
HELM_ARGS=""
COMMENT_PATTERN="^ *#"
NAMESPACE="${NAMESPACE,,}"
DRY_RUN="${DRY_RUN:-}"

function add_helm_args() {
  HELM_ARGS="${HELM_ARGS} ${@}"
}

if [ -n "${DEBUG}" ]; then
  add_helm_args --debug
fi

if [[ "${DRY_RUN,,}" == "true" ]]; then
  add_helm_args --dry-run
fi

if [ -f "kustomization.yaml" ]; then
  add_helm_args --post-renderer "${ACTION_PATH}/kustomize.sh"
fi

if [ -n "${HELM_TIMEOUT}" ]; then
  add_helm_args --wait --timeout "${HELM_TIMEOUT}"
fi

if [ -n "${CHART_VERSION}" ]; then
  add_helm_args --version "${CHART_VERSION}"
fi

if [ -n "${VALUES_FILES}" ]; then
  while IFS= read -r line || [[ -n $line ]]; do
    if [ -z "${line}" ] || [[ $line =~ $COMMENT_PATTERN ]]; then
      continue
    fi
    add_helm_args -f "${line}"
  done < <(printf '%s' "${VALUES_FILES}")
fi

add_helm_args -n "${NAMESPACE}" --create-namespace

# this could be the first time the chart is being installed in the namespace
# so we'll silence errors coming from this. If it is a authentication or
# permissions issues we'll strike it again when we attempt to apply the chart
set +e
HELM_STATUS=$(helm get metadata -n "${NAMESPACE}" "${NAME}" -o json 2>/dev/null)
set -e
DEPLOYED_AT_START=$(echo "${HELM_STATUS}" | jq -r '.revision')
DEPLOYED_STATUS=$(echo "${HELM_STATUS}" | jq -r '.info.status')

if [[ "${REMOVE_FAILED,,}"  == "true" ]]; then
  case "${DEPLOYED_STATUS}" in
    pending-upgrade )
      helm rollback -n "${NAMESPACE}" "${NAME}" --wait
      ;;
    pending-install )
      helm uninstall -n "${NAMESPACE}" "${NAME}"
      ;;
  esac
fi

if [ -n "${DEPLOYED_STATUS}" ]; then
  ACTION="upgrade"
fi

echo "action=${ACTION}" | tee -a "${GITHUB_OUTPUT}"

set +e
set -x
helm upgrade --install "${NAME}" "${CHART}" ${HELM_ARGS}
EC=$?
set -e

if [ "${DEBUG,,}" != "true" ]; then
  set +x
fi

if [ -f "full-manifest.yaml" ]; then
  echo "full-manifest=$(readlink -e full-manifest.yaml)" | tee -a "${GITHUB_OUTPUT}"
fi

if [ "${DRY_RUN,,}" == "true" ]; then
  exit 0
fi

LATEST=$(helm get metadata -n "${NAMESPACE}" "${NAME}" -ojson)
LATEST_REVISION=$(echo "${LATEST}" | jq -r '.revision')

if [ "${LATEST_REVISION}" == "${DEPLOYED_AT_START}" ]; then
  echo "::error::Could not create new helm release"
  exit 3
fi

function latest-output() {
  local OUTPUT="${1}"
  local SELECTOR="${2}"
  local -r EOF="$(uuidgen)"
  echo "${OUTPUT}<<${EOF}"
  echo "${LATEST}" | jq -rMc "${SELECTOR}"
  echo "${EOF}"
}

{
  echo "::group::outputs"
  latest-output 'app-version' '.appVersion'
  latest-output 'chart-name' '.chart'
  latest-output 'chart-version' '.version'
  latest-output 'deployed-at' '.deployedAt'
  latest-output 'install-name' '.name'
  latest-output 'namespace' '.namespace'
  latest-output 'revision' '.revision'
  latest-output 'status' '.status'
  latest-output 'json' '.'
  echo "::endgroup::"
} | tee -a "${GITHUB_OUTPUT}"

exit $EC
