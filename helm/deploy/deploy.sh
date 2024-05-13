#!/usr/bin/env bash
CI_DEBUG=${CI_DEBUG:-}
if [ ! -z "${CI_DEBUG}" ]; then
    set -x
fi

set -eu

ACTION="create"
HELM_ARGS=""
COMMENT_PATTERN="^ *#"

function add_helm_args() {
  HELM_ARGS="${HELM_ARGS} ${@}"
}

if [ -f "kustomization.yaml" ]; then
  add_helm_args --post-renderer "${ACTION_PATH}/kustomize.sh"
fi

if [ ! -z "${HELM_TIMEOUT}" ]; then
  add_helm_args --wait --timeout "${HELM_TIMEOUT}"
fi

if [ ! -z "${CHART_VERSION}" ]; then
  add_helm_args --version "${CHART_VERSION}"
fi

if [ ! -z "${VALUES_FILES}" ]; then
  while IFS= read -r line || [[ -n $line ]]; do
    if [ -z "${line}" ] || [[ $line =~ $COMMENT_PATTERN ]]; then
      continue
    fi
    add_helm_args -f "${line}"
  done < <(printf '%s' "${VALUES_FILES}")
fi

add_helm_args -n "${NAMESPACE}" --create-namespace

set +e
STATUS=$(helm status -n "${NAMESPACE}" "${NAME}" -o json 2>/dev/null | jq -r '.info.status')
set -e

if [ ! -z "${REMOVE_FAILED}" ]; then
  case "${STATUS}" in
    pending-upgrade )
      helm rollback -n "${NAMESPACE}" "${NAME}" --wait
      ;;
    pending-install )
      helm uninstall -n "${NAMESPACE}" "${NAME}"
      ;;
  esac
fi

if [ ! -z "${STATUS}" ]; then
  ACTION="upgrade"
fi

echo "action=${ACTION}" >> $GITHUB_OUTPUT

set +e
helm upgrade --install "${NAME}" "${CHART}" ${HELM_ARGS}
EC=$?
set -e

if [ ! -z "${CI_DEBUG}" ]; then
    ls -al .
fi

if [ -f "full-manifest.yaml" ]; then
  echo "full-manifest=$(readlink -e full-manifest.yaml)" >> $GITHUB_OUTPUT
fi

exit $EC
