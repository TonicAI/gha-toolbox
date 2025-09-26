const core = require("@actions/core");
const github = require("@actions/github");

async function run() {
    const token = core.getInput("repo-token", { required: true });
    core.debug("Github Payload: " + JSON.stringify(github));
    const releaseNumber = Number(
        github.context.ref.substr(11, github.context.ref.length - 1)
    );
    if (isNaN(releaseNumber)) return;
    const release = releaseNumber.toString().padStart(3, "0");
    const client = new github.getOctokit(token);

    const milestones = await client.rest.issues.listMilestones({
        repo: github.context.payload.repository.name,
        owner: github.context.payload.repository.owner.login,
    });

    const milestone = "v" + release;
    const filteredMilestones = milestones.data.filter(
        (m) => m.title === milestone && m.state !== "closed"
    );
    if (filteredMilestones.length) {
        var milestoneObject = filteredMilestones[0];
        milestoneObject.state = "closed";
        await client.rest.issues.updateMilestone(milestoneObject);

        core.setOutput("milestone", milestone);
    } else {
        core.setFailed(`Milestone ${milestone} not found`);
    }
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
