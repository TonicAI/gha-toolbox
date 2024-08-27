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

function convertToHtml(fieldData) {
    let html = '';
    function traverseContent(contentArray) {
        contentArray.forEach(item => {
            switch (item.type) {
                case 'text':
                    if (item.marks) {
                        item.marks.forEach(mark => {
                            switch (mark.type) {
                                case 'code':
                                    html += '<code>' + item.text + '</code>';
                                    break;
                                case 'strong':
                                    html += '<strong>' + item.text + '</strong>';
                                    break;
                                case 'em':
                                    html += '<em>' + item.text + '</em>';
                                    break;
                                case 'underline':
                                    html += '<u>' + item.text + '</u>';
                                    break;
                                case 'strike':
                                    html += '<s>' + item.text + '</s>';
                                    break;
                                case 'link':
                                    html += '<a href="' + mark.attrs.href + '">' + item.text + '</a>';
                                    break;
                                default:
                                    html += item.text;
                                    break;
                            }
                        });
                    } else {
                        html += item.text;
                    }
                    break;
                case 'paragraph':
                    html += '<p>' + traverseContent(item.content) + '</p>';
                    break;
                case 'bulletList':
                    html += '<ul>' + traverseContent(item.content) + '</ul>';
                    break;
                case 'orderedList':
                    html += '<ol>' + traverseContent(item.content) + '</ol>';
                    break;
                case 'listItem':
                    html += '<li>' + traverseContent(item.content) + '</li>';
                    break;
                case 'heading':
                    const level = item.attrs.level;
                    html += '<h' + level + '>' + traverseContent(item.content) + '</h' + level + '>';
                    break;
                case 'blockquote':
                    html += '<blockquote>' + traverseContent(item.content) + '</blockquote>';
                    break;
                case 'codeBlock':
                    html += '<pre><code>' + traverseContent(item.content) + '</code></pre>';
                    break;
                case 'hardBreak':
                    html += '<br/>';
                    break;
                case 'rule':
                    html += '<hr/>';
                    break;
                case 'image':
                    html += '<img src="' + item.attrs.src + '" alt="' + (item.attrs.alt || '') + '"/>';
                    break;
                default:
                    if (item.content) {
                        html += traverseContent(item.content);
                    }
                    break;
            }
        });
        
        return html;
    }

    if (fieldData && fieldData.content) {
        return traverseContent(fieldData.content);
    }

    return "";
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
