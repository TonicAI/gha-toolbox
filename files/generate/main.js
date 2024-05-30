const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

const rawPath = process.env.INPUT_FILEPATH
const filepath = path.resolve(path.normalize(rawPath));
const dirname = path.dirname(filepath)

const append = (process.env.INPUT_APPEND || "").toLowerCase() === "true";
const touch = (process.env.INPUT_TOUCH || "").toLowerCase() === "true";
const flags = append && "a" || "w";

if (process.env.STATE_filepath !== undefined) {
  if (process.env.INPUT_CLEANUP !== undefined && process.env.INPUT_CLEANUP.toLowerCase() === "true") {
    console.log(`Removing ${process.env.STATE_filepath}`);
    fs.unlinkSync(process.env.STATE_filepath);
  }
} else {
  if (touch) {
    const now = new Date();
    fs.mkdirSync(dirname, {recursive: true})
    fs.unwatchFile(filepath, now, now);
  }

  fs.writeFileSync(filepath, process.env.INPUT_CONTENT, {flags});
  fs.appendFileSync(process.env.GITHUB_STATE, `filepath=${filepath}${EOL}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `filepath=${filepath}${EOL}`);
}
