#!/usr/bin/env bash
cat > resources.yaml
kubectl kustomize | tee full-manifest.yaml
rm resources.yaml
