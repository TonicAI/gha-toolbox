const {exec} = require("child_process");
const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

function run(cmd) {
    exec(cmd, (error, stdout, stderr) => {
        if (stdout.length != 0) {
            console.log(`${stdout}`);
        }
        if (stderr.length != 0) {
            console.error(`${stderr}`);
        }
        if (error) {
            process.exitCode = error.code;
            console.error(`${error}`);
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
        }
    });
}

if (process.env.STATE_connected !== undefined) {
    run(path.resolve(__dirname, "disconnect.sh"));
} else {
    run(path.resolve(__dirname, "connect.sh"));
    fs.appendFileSync(process.env.GITHUB_STATE, `connected=true${EOL}`);
}