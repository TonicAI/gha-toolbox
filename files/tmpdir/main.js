const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

if (process.env.STATE_filepath !== undefined) {
    fs.rmSync(process.env.STATE_filepath, { recursive: true, force: true })
} else {
  const tmpdir = `${path.join(process.env.INPUT_PATH, process.env.INPUT_NAME)}${path.sep}`;
  fs.mkdirSync(tmpdir, {recursive: true});
  fs.mkdtempSync(tmpdir);
  fs.appendFileSync(process.env.GITHUB_STATE, `tmpdir=${tmpdir}${EOL}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tmpdir=${tmpdir}${EOL}`);
}
