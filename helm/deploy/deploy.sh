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

set +e
STATUS=$(helm status -n "${NAMESPACE}" "${NAME}" -o json 2>/dev/null | jq -r '.info.status')
set -e

if [[ "${REMOVE_FAILED,,}"  == "true" ]]; then
  case "${STATUS}" in
    pending-upgrade )
      helm rollback -n "${NAMESPACE}" "${NAME}" --wait
      ;;
    pending-install )
      helm uninstall -n "${NAMESPACE}" "${NAME}"
      ;;
  esac
fi

if [ -n "${STATUS}" ]; then
  ACTION="upgrade"
fi

echo "action=${ACTION}" >> $GITHUB_OUTPUT

set +e
set -x
helm upgrade --install "${NAME}" "${CHART}" ${HELM_ARGS}
EC=$?
set +x
set -e

if [ -f "full-manifest.yaml" ]; then
  echo "full-manifest=$(readlink -e full-manifest.yaml)" >> $GITHUB_OUTPUT
fi

exit $EC
