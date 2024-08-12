const core = require("@actions/core");
const https = require("https");

async function run() {
    const fixVersion = core.getInput("fix-version", { required: true });
    const jiraUsername = core.getInput("jira-username", { required: true });
    const jiraToken = core.getInput("jira-token", { required: true });
    
    const jiraAuthToken = "Basic " + Buffer.from(jiraUsername + ":" + jiraToken).toString("base64");
    
    const getIssuesFromReleaseResponse = await get(
        "tonic-ai.atlassian.net",
        `/rest/api/3/search?jql=fixVersion=${fixVersion}`,
        jiraAuthToken
    );

    const issues = JSON.parse(getIssuesFromReleaseResponse).issues;
    const customFieldValues = issues.map(issue => issue.fields.customfield_10049).filter(value => value);
    const releaseNotes = customFieldValues.map(data => extractTextFromCustomField(data)).join("\n");
}

function extractTextFromCustomField(fieldData) {
    let text = '';

    function traverseContent(contentArray) {
        contentArray.forEach(item => {
            if (item.type === 'text' && item.text) {
                text += item.text + ' ';
            } else if (item.content) {
                traverseContent(item.content);
            }
        });
    }

    if (fieldData && fieldData.content) {
        traverseContent(fieldData.content);
    }

    return text.trim();
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
