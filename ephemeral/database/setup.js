const {exec} = require("child_process");
const path = require("path");

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

run(`/bin/sh -c 'cd ${path.resolve(__dirname)} && npm ci --no-audit --prefer-offline'`);
