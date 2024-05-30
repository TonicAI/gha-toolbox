# tonicai/gha-toolbox/tpl

Renders a minijinja template, either to file or to `$GITHUB_OUTPUT`.

## Examples

```yaml
# install setup minijinja
- uses: tonicai/gha-toolbox/minijinja/setup@main
---
# render template and values from inputs
- id: render
  uses: tonicai/gha-toolbox/tpl@main
  with:
    template: Hello {{ name | upper }}
    values: |
      name: ${{ github.actor }}
    values-format: yaml
---
# render template and values from files
- id: render
  uses: tonicai/gha-toolbox/tpl@main
  with:
    # file:// is stripped
    template: file://path/to/template
    values: file://path/to/values.yaml
    # still required unfortunately
    values-format: yaml
---
# enable various options
- id: render
  uses: tonicai/gha-toolbox/tpl@main
  with:
    template: ...
    values: ...
    values-format: ...
    strict: false # default is true
    pass-env: true # default is false
    output: path/to/rendered # default is -
    fuel: 30 # provides fuel...?
    includes: false # disables includes, default is to allow all includes
    # only allows these paths, default is to allow all includes
    includes: |
      safe/include/path/1
      safe/include/path/2
---
# using outputs
- uses: slackapi/slack-github-action@v1.26.0
  with:
    # when output: -
    payload: ${{ steps.rendered.outputs.rendered }}
    # when output isn't -, path is absolute
    payload: ${{ steps.rendered.outputs.filepath }}
```
