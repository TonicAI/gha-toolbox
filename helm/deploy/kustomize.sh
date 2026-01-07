#!/usr/bin/env bash
set -o pipefail
cat > resources.yaml
kubectl kustomize 2>kustomize.err | tee full-manifest.yaml
