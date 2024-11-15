const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

if (process.env.STATE_tmpdir !== undefined) {
    fs.rmSync(process.env.STATE_tmpdir, { recursive: true, force: true })
} else {
  const tmpdirBase = `${path.join(process.env.INPUT_PATH, process.env.INPUT_NAME)}${path.sep}`;
  fs.mkdirSync(tmpdirBase, {recursive: true});
  let tmpdir = fs.mkdtempSync(tmpdirBase);
  fs.appendFileSync(process.env.GITHUB_STATE, `tmpdir=${tmpdir}${EOL}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `tmpdir=${tmpdir}${EOL}`);
}
