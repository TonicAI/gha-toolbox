#!/usr/bin/env bash
set -eo pipefail
cat > resources.yaml
kubectl kustomize | tee full-manifest.yaml
rm resources.yaml
