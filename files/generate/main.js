const fs = require("fs");
const path = require("path");
const {EOL} = require("os");

if (process.env.STATE_filepath !== undefined) {
  if (process.env.INPUT_CLEANUP !== undefined && process.env.INPUT_CLEANUP.toLowerCase() === "true") {
    console.log(`Removing ${process.env.STATE_filepath}`);
    fs.unlinkSync(process.env.STATE_filepath);
  }
} else {
  const append = (process.env.INPUT_APPEND || "").toLowerCase() === "true";
  const flags = append && "a" || "w";
  const writePath = path.resolve(process.env.INPUT_FILEPATH);
  fs.writeFileSync(writePath, process.env.INPUT_CONTENT, {flags});
  fs.appendFileSync(process.env.GITHUB_STATE, `filepath=${writePath}${EOL}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `filepath=${writePath}${EOL}`);
}
