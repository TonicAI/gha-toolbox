# tonicai/gha-toolbox/terraform/plan

Initializes terraform and runs a plan. The plan file is attached to the
workflow as an artifact. The resulting plan file itself is named `plan`

Example usage:

```yaml
jobs:
  plan:
    runs-on: ubuntu-22.04
    name: Plan
    steps:
      - id: checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 1
      - name: Plan
        uses: tonicai/gha_toolbox/terraform/plan@main
        with:
          # required directory where terraform files are located
          working-directory: infra
          # required artifact name
          plan-name: example
          # optional, backend configuration file
          # can be relative to working directory or an absolute path
          backend-config: ${{ github.workspace }}/backend-config # absolute path
          # optional, variable file
          # can be relative to working directory or an absolute path
          var-file: .tfvars # relative to working directory
          # optional, pass additional init args
          init-args: -lock=false
          # optional, pass additional plan args
          plan-args: -var 'foo=bar'
        env:
          # can pass terraform variables via envvars as well
          TF_VAR_baz: 'qux'
```
