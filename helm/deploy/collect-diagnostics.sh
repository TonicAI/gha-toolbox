#!/usr/bin/env bash

set -ux
helm get metadata -n "${NAMESPACE}" "${RELEASE_NAME}" -o json &> "${DIAGDIR}/helm-meta.json"
helm status -n "${NAMESPACE}" "${RELEASE_NAME}" &> "${DIAGDIR}/helm-status.txt"
helm history -n "${NAMESPACE}" "${RELEASE_NAME}" &> "${DIAGDIR}/helm-history.txt"
kubectl get pods -n "${NAMESPACE}" -o wide &> "${DIAGDIR}/pods.txt"
kubectl get all -n "${NAMESPACE}" &> "${DIAGDIR}/resources.txt"
kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' &> "${DIAGDIR}/events.txt"

NONREADY_LINES=$(kubectl get pods -o="custom-columns=NAME:.metadata.name,READY:.status.containerStatuses[*].ready" -n "$NAMESPACE" | grep "false" | awk '{gsub(/[ \t\n]+/, "", $1); print $1}' | xargs)
IFS=' ' read -r -a NONREADY_PODS <<< "${NONREADY_LINES}"
for POD in "${NONREADY_PODS[@]}"; do
  kubectl logs -n "${NAMESPACE}" "${POD}" --all-containers &> "${DIAGDIR}/${POD}-logs.txt"
done
