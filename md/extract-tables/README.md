# tonicai/gha-toolbox/md/extract-tables

Extracts tables from markdown and produces a JSON representation of them.

Examples:

```yaml
# get all tables in a pull request body
- id: tables
  uses: tonicai/gha-toolbox/md/extract-tables@main
  with:
    markdown: ${{ github.event.body }}
---
# write to file instead
- id: tables
  uses: tonicai/gha-toolbox/md/extract-tables@main
  with:
    markdown: ${{ github.event.body }}
    output: path/to/file
---
# produce string[][][] instead of Object[]
- id: tables
  uses: tonicai/gha-toolbox/md/extract-tables@main
  with:
    markdown: ${{ github.event.body }}
    format: arrays
---
# use outputs
- uses: tonicai/gha-toolbox/yq@main
  with:
    # when output is -
    input: ${{ steps.tables.outputs.tables }}
    # when output isn't -
    input: file://${{ steps.tables.outputs.filepath }}
    # ...
```
