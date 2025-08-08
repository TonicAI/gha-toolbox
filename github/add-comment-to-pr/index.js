const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });
    const prNumbers = core.getInput("pr-numbers", { required: true });
    const commentText = core.getInput("comment-text", { required: true });
    const client = new github.getOctokit(token);

    var prNums = prNumbers.split(" ");

    for (const prNumber of prNums) {
        await client.rest.issues.createComment({
            repo: github.context.payload.repository.name,
            owner: github.context.payload.repository.owner.login,
            issue_number: prNumber,
            body: commentText,
        });
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
