const core = require("@actions/core");
const github = require("@actions/github");
const https = require("https");

async function run() {
    const token = core.getInput("repo-token", { required: true });
    const milestoneName = core.getInput("milestone", { required: true });

    const client = new github.getOctokit(token);

    const milestones = await client.rest.issues.listMilestones({
        repo: github.context.payload.repository.name,
        owner: github.context.payload.repository.owner.login,
        per_page: 100,
        page: 1,
        sort: "updated_at",
        direction: "desc",
        state: "all",
    });

    const milestone = milestones.data.find((m) => m.title === milestoneName);

    if (!milestone) {
        throw new Error(`Milestone ${milestoneName} not found`);
    }

    const issues = await client.paginate("GET /repos/{owner}/{repo}/issues", {
        repo: github.context.payload.repository.name,
        owner: github.context.payload.repository.owner.login,
        milestone: milestone.number,
        state: "all",
    });

    const filteredIssues = issues.filter((i) => i.pull_request.merged_at);

    const milestonePrefix = core.getInput("milestone-prefix", { required: false }) || '';
    const releaseName = `${milestonePrefix}-${milestoneName}`;
    const releasePayload = {
        data: {
            releaseName: releaseName,
            githubLink: milestone.html_url,
            releaseDate: new Date(milestone.closed_at)
                .toISOString()
                .split("T")[0],
        },
    };

    core.debug(`releasePayload: ${JSON.stringify(releasePayload)}`);

    //Create Release
    const createReleaseResponse = await post(
        "automation.atlassian.com",
        "/pro/hooks/c90b384a746d019e78f661c8b6db4e9eba048ac1",
        releasePayload
    );
    core.debug(`createReleaseResponse: ${createReleaseResponse.toString()}`);

    //Wait for release to be created
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const issuePayload = {
        data: {
            releaseName: releaseName,
        },
        issues: [],
    };
    if (filteredIssues.length) {
        for (const issue of filteredIssues) {
            const matches = issue.title.match(/(TN-\d*)/g);
            if (matches && matches.length) {
                console.log(matches);
                issuePayload.issues.push(...matches);
            }
        }
    }

    core.debug(`issuePayload: ${JSON.stringify(issuePayload)}`);

    if (issuePayload.issues.length) {
        //Assign issues to release
        try {
            const setReleaseInfoReponse = await post(
                "automation.atlassian.com",
                "/pro/hooks/2948f9d76aa5279447350ce73663883cbe3490ae",
                issuePayload
            );
            core.debug(
                `setReleaseInfoReponse: ${setReleaseInfoReponse.toString()}`
            );
        } catch (e) {
            console.log(e);
            throw new Error(`Error posting issues to Jira release ${e}`);
        }
    } else {
        console.log("No issues to move into Jira release");
    }
}

function post(host, path, payload) {
    return new Promise(function (resolve, reject) {
        const postData = JSON.stringify(payload);
        const postOptions = {
            host,
            path,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const req = https.request(postOptions, function (res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error("statusCode=" + res.statusCode));
            }
            var body = [];
            res.on("data", function (chunk) {
                body.push(chunk);
            });
            resolve(body);
        });
        req.on("error", function (err) {
            reject(err);
        });
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
