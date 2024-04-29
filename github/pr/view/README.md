# tonicai/gha-toolbox/github/pr/view

Retrieves information about a pull request. The pull request can be referenced
by its number, the branch, or by its github URL. By default this action
provides outputs for:

- Pull Request Number
- Branch Name
- Github URL
- Labels
- State, OPEN or CLOSED
- Draft status, true or false
- body of the pull request
- JSON response returned by the github CLI tool

This action can also be passed a comma separated list of fields to additionally
retrieve from the github API. These fields will be found in the json response
output.

There is [a convenience workflow](.github/workflows/github-pr-view.yaml) that
can be used to run this as a workflow job.

Example usage:

```yaml
jobs:
  pr:
    name: Get Pull Request Info
    runs-on: ubuntu-22.04
    steps:
      - id: pr
        uses: tonicai/gha-toolbox/github/pr/view@main
        with:
          pr-ref: ${{ github.event.number }}
          include: milestone
     - id: get-milestone
       env:
         PR_JSON: ${{ steps.pr.outputs.json }}
       shell: bash
       run: |
         MILESTONE=$(echo "$PR_JSON" | jq -r '.milestone')
         echo "milestone=${MILESTONE}" >> $GITHUB_OUTPUT
     - uses: ./some/action.yaml
       with:
         milestone: ${{ steps.get-milestone.outputs.milestone }}
         labels: ${{ steps.pr.outputs.labels }}
         branch-name: ${{ steps.pr.outputs.branch-name }}
```
