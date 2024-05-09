const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

const rawPath = process.env.INPUT_FILEPATH
const filepath = path.resolve(path.normalize(rawPath));

const append = (process.env.INPUT_APPEND || "").toLowerCase() === "true";
const flags = append && "a" || "w";

const mode = (process.env.INPUT_MODE || "");

if (process.env.STATE_filepath !== undefined) {
  if (process.env.INPUT_CLEANUP !== undefined && process.env.INPUT_CLEANUP.toLowerCase() === "true") {
    console.log(`Removing ${process.env.STATE_filepath}`);
    fs.unlinkSync(process.env.STATE_filepath);
  }
} else {
  fs.writeFileSync(filepath, process.env.INPUT_CONTENT, {flags});

  if (mode !== "") {
    fs.chmodSync(filepath, mode);
  }

  fs.appendFileSync(process.env.GITHUB_STATE, `filepath=${filepath}${EOL}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `filepath=${filepath}${EOL}`);
}
