const core = require("@actions/core");
const https = require("https");

async function run() {
    const fixVersion = core.getInput("fix-version", { required: true });
    const jiraUsername = core.getInput("jira-username", { required: true });
    const jiraToken = core.getInput("jira-token", { required: true });

    const jiraAuthToken = "Basic " + Buffer.from(jiraUsername + ":" + jiraToken).toString("base64");
    const encodedJql = encodeURIComponent(`fixVersion=${fixVersion} AND "tonic release note[paragraph]" IS NOT EMPTY`);
    const getIssuesFromReleaseResponse = await get(
        "tonic-ai.atlassian.net",
        `/rest/api/3/search?jql=${encodedJql}`,
        jiraAuthToken
    );

    const issues = JSON.parse(getIssuesFromReleaseResponse).issues;
    let releaseNotesAsHtml = "";
    if(issues && issues.length > 0) {
        const customFieldValues = issues.map(issue => issue.fields.customfield_10049).filter(value => value);
        releaseNotesAsHtml = customFieldValues
            .map(fieldData => convertToHtml(fieldData))
            .join('\n');
    } else {
        releaseNotesAsHtml = "<p>PLACEHOLDER TEXT FOR RELEASE WITH NO NOTES.</p>"
    }
    console.log(releaseNotesAsHtml);
}

function convertToHtml(content) {
    let html = '';
    function traverseContent(contentArray) {
        contentArray.forEach(item => {
            switch (item.type) {
                case 'paragraph':
                    html += '<p>';
                    if (item.content) traverseContent(item.content);
                    html += '</p>';
                    break;
                case 'text':
                    html += item.text;
                    break;
                case 'bulletList':
                    html += '<ul>';
                    if (item.content) traverseContent(item.content);
                    html += '</ul>';
                    break;
                case 'listItem':
                    html += '<li>';
                    if (item.content) traverseContent(item.content);
                    html += '</li>';
                    break;
            }
        });
    }

    if (content && content.content) {
        traverseContent(content.content);
    }

    return html;
}

function get(host, path, authToken) {
    return new Promise(function (resolve, reject) {
        const getOptions = {
            hostname: host,
            path: path,
            method: "GET",
            headers: {
                "Authorization": authToken,
                "Content-Type": "application/json"
            },
        };

        const req = https.request(getOptions, function (res) {
            let body = [];
            res.on("data", function (chunk) {
                body.push(chunk);
            });
            
            res.on("end", function () {
                // Join the chunks and convert to a string
                body = Buffer.concat(body).toString();
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    console.log(`Response Body: ${body}`)
                    return reject(new Error("statusCode=" + res.statusCode));
                }
                resolve(body);
            });
        });
        req.on("error", function (err) {
            reject(err);
        });
        req.end();
    });
}
run().catch((error) => {
    core.setFailed(error.message);
    if (error instanceof Error && error.stack) {
        core.debug(error.stack);
    }
});
