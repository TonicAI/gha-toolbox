const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });

    const pullRequest = github.context.payload.pull_request;
    if (!pullRequest) {
        console.log("Could not get pull_request from context, exiting");
        return;
    }

    const targetBranch = pullRequest.base.ref;
    if (targetBranch !== "master" || targetBranch !== "main") {
        console.log("PR is not targeting the master or main branch");
        return;
    }

    const { milestone, number: prNumber } = pullRequest;

    if (milestone) {
        console.log("Milestone already exists, exiting");
        return;
    }

    const client = new github.getOctokit(token);

    const milestones = await client.rest.issues.listMilestones({
        repo: github.context.payload.repository.name,
        owner: github.context.payload.repository.owner.login,
        state: "open",
    });

    if (milestones.data.length) {
        const milestoneToAdd =
            milestones.data.sort()[milestones.data.length - 1];
        const milestoneNumber = milestoneToAdd.number;
        await client.rest.issues.update({
            repo: github.context.payload.repository.name,
            owner: github.context.payload.repository.owner.login,
            issue_number: prNumber,
            milestone: milestoneNumber,
        });
        core.setOutput("milestone", milestoneToAdd.title);
    } else {
        console.log("No valid milestones found");
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
