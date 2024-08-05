const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });

    prsToClose = [];

    const client = new github.getOctokit(token);
    const pullRequests = await client.paginate(
        "GET /repos/{owner}/{repo}/pulls",
        {
            repo: github.context.payload.repository.name,
            owner: github.context.payload.repository.owner.login,
            state: "open",
        }
    );
    if (!pullRequests) {
        throw new Error("Unable to get pr list.");
    }

    var openPrs = pullRequests.map((pr) => pr.number);

    for (const prNum of openPrs) {
        const commits = await client.paginate(
            `GET /repos/{owner}/{repo}/pulls/${prNum}/commits`,
            {
                ...github.context.repo,
            }
        );
        const lastCommit = commits[commits.length - 1];
        const commitDate = new Date(lastCommit.commit.committer.date);
        if ((new Date() - commitDate) / 86400000 >= 7) {
            prsToClose.push(prNum);
        }
    }

    console.log(`Stale PRs: ${prsToClose}`);
    core.setOutput("stale_pr_numbers", prsToClose.join(" "));
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
