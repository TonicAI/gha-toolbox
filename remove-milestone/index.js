const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });

    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
        console.log("Could not get pull_request from context, exiting");
        return;
    }

    const { milestone, number: prNumber } = pullRequest;

    if (milestone) {
        const client = new github.getOctokit(token);
        console.log("Removing milestone");
        await client.rest.issues.update({
            repo: github.context.payload.repository.name,
            owner: github.context.payload.repository.owner.login,
            issue_number: prNumber,
            milestone: null,
        });
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
