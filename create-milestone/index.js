const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });

    let release;
    if (github.context.ref) {
        release = Number(
            github.context.ref.substr(11, github.context.ref.length - 1)
        );
    } else if (github.context.event.release.tag_name) {
        release = Number(
            github.context.event.release.tag_name.replace("v", "")
        );
    }

    if (isNaN(release)) return;

    const client = new github.getOctokit(token);

    const milestones = await client.rest.issues.listMilestones({
        repo: github.context.payload.repository.name,
        owner: github.context.payload.repository.owner.login,
    });

    const currentMilestoneTitle = "v" + release;
    const currentMilestone = milestones.data.some(
        (m) => m.title === currentMilestoneTitle
    )
        ? milestones.data.filter((m) => m.title === currentMilestoneTitle)[0]
        : null;

    const nextMilestoneTitle = "v" + (release + 1);
    let nextMilestone = milestones.data.some(
        (m) => m.title === nextMilestoneTitle
    )
        ? milestones.data.filter((m) => m.title === nextMilestoneTitle)[0]
        : null;
    if (!nextMilestone) {
        const nextMilestoneResponse = await client.rest.issues.createMilestone({
            ...github.context.repo,
            title: nextMilestoneTitle,
            state: "open",
        });
        nextMilestone = nextMilestoneResponse.data;
        core.setOutput("milestone", nextMilestoneTitle);
    } else {
        console.log(`Milestone ${nextMilestoneTitle} already exists`);
    }

    if (currentMilestone && nextMilestone) {
        const openIssues = await client.paginate(
            "GET /repos/{owner}/{repo}/issues",
            {
                ...github.context.repo,
                milestone: currentMilestone.number,
                state: "open",
            }
        );

        for (const openIssue of openIssues) {
            await client.rest.issues.update({
                ...github.context.repo,
                issue_number: openIssue.number,
                milestone: nextMilestone.number,
            });
        }
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
