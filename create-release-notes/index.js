const core = require("@actions/core");
const https = require("https");

const Products = Object.freeze({
    structural: 'Structural',
    textual: 'Textual',
    ephemeral: 'Ephemeral'
});

async function run() {
    const fixVersion = core.getInput("fix-version", { required: true });
    const fixVersionPrefix = core.getInput("fix-version-prefix", { required: false }) || '';
    const jiraUsername = core.getInput("jira-username", { required: true });
    const jiraToken = core.getInput("jira-token", { required: true });
    const webflowToken = core.getInput("webflow-token", { required: true });
    const productName = core.getInput("product-name", { required: true });
    
    if (!Object.keys(Products).includes(productName.toLocaleLowerCase())) {
        throw new Error(`Invalid value for 'productName': ${productName}. Valid options are ${Object.keys(Products).join(', ')}.`);
    }

    const jiraAuthToken = "Basic " + Buffer.from(jiraUsername + ":" + jiraToken).toString("base64");
    const jiraFixVersion = fixVersionPrefix ? `${fixVersionPrefix}-${fixVersion}` : `${fixVersion}`;
    const encodedJql = encodeURIComponent(`fixVersion=${jiraFixVersion} AND "tonic release note[paragraph]" IS NOT EMPTY`);
    const getIssuesFromReleaseResponse = await get(
        "tonic-ai.atlassian.net",
        `/rest/api/3/search?jql=${encodedJql}`,
        jiraAuthToken
    );

    const issues = JSON.parse(getIssuesFromReleaseResponse).issues;
    let releaseNotesAsHtml;
    if(issues && issues.length > 0) {
        const customFieldValues = issues.map(issue => issue.fields.customfield_10049).filter(value => value);
        releaseNotesAsHtml = customFieldValues
            .map(fieldData => convertToHtml(fieldData))
            .join('\n');
    } else {
        releaseNotesAsHtml = "<p>Bug fixes and other internal updates.</p>"
    }
    
    await createReleaseNote(webflowToken, Products[productName], fixVersion, releaseNotesAsHtml);
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

async function createReleaseNote(webflowToken, product, releaseName, releaseNotesContent) {
    const webflowAuthToken = `Bearer ${webflowToken}`.toString("base64");
    const webflowHost = "api.webflow.com";
    const currentDate = new Date();
    const body = {
        cmsLocaleId: "653ad721e882f528b341eaa5",
        isArchived: false,
        isDraft: false,
        fieldData: {
            "release-date": currentDate,
            "removed-flag": false,
            "product": product,
            "content": releaseNotesContent,
            "name": releaseName
        }
    }
    const createResponse = await post(webflowHost, "/v2/sites/62e28cf08913e81176ba2c39/collections/66c653f35fee4b88416da2b2/items", webflowAuthToken, body);
    const publishBody = {
        itemIds: [
            createResponse.id
        ]
    }
    await post(webflowHost, "/v2/collections/66c653f35fee4b88416da2b2/items/publish", webflowAuthToken, publishBody);
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

function post(host, path, authToken, payload) {
    return new Promise(function (resolve, reject) {
        const postData = JSON.stringify(payload);
        const postOptions = {
            host,
            path,
            method: "POST",
            headers: {
                "Authorization": authToken,
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const req = https.request(postOptions, function (res) {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error("statusCode=" + res.statusCode));
            }
            let body = [];
            res.on("data", function (chunk) {
                body.push(chunk);
            });

            res.on("end", function () {
                try {
                    const responseBody = Buffer.concat(body).toString();
                    resolve(JSON.parse(responseBody));
                } catch (error) {
                    reject(new Error("Invalid JSON response: " + error.message));
                }
            });
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
