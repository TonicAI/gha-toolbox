# tonicai/gha-toolbox/helm/revision-digest

A pair of actions used to apply and check a digest value applied to a specific
Helm installation revision. The intention to be able to determine if an
installation needs an upgrade without attempting the more expensive upgrade.

This works by applying an annotation to the underlying Helm revision secret,
other Helm revision storage options are not supported.

## Usage

```yaml
- id: revision-digest
  uses: tonicai/gha-toolbox/sha256sum@main
  with:
    content: |
      ${{ inputs.chart-version }}
    files: |
      ${{ inputs.values-files }}
- id: check-revision-digest
  uses: tonicai/gha-toolbox/helm/revision-digest/check@main
  with:
    digest: ${{ steps.revision-digest.outputs.sha256sum }}
    namespace: ${{ inputs.namespace }}
    helm-installation: tonic
- if: ${{ steps.check-revision-digest.outputs.is-deployed-digest != 'true' }}
  id: deploy
  uses: tonicai/gha-toolbox/helm/deploy@main
  with:
    helm-timeout: '5m'
    chart: oci://quay.io/tonicai/structural
    version: ${{ inputs.chart-version }}
    name: structural
    namespace: ${{ inputs.namespace }}
    values-files: |
      ${{ inputs.values-files }}
- id: apply-revision-digest
  if: |
    ${{
      always() &&
      steps.deploy.outputs.revision != '' &&
      steps.deploy.outputs.revision != 'null' &&
      steps.check-revision-digest.outputs.is-deployed-digest != 'true'
    }}
  uses: tonicai/gha-toolbox/helm/revision-digest/apply@main
  with:
    digest: ${{ steps.revision-digest.outputs.sha256sum }}
    namespace: ${{ inputs.namespace }}
    helm-installation: tonic
    helm-revision: ${{ steps.deploy.outputs.revision }}
```
