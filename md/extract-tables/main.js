const gha = require('@actions/core');
const mdTables = require('markdown-tables-to-json');
const path = require('node:path');
const fs = require('node:fs');

function main() {
  const inputs = {
    output: gha.getInput('output') || '-',
    markdown: gha.getInput('markdown', { required: true }),
    orientation: gha.getInput('orientation') || 'rows',
    format: gha.getInput('format') || 'objects',
  };

  const tables = extractTables(inputs);
  switch (inputs.output) {
    case '-':
      gha.setOutput('tables', tables);
      break
    default:
      const filepath = path.resolve(path.normalize(inputs.output));
      fs.writeFileSync(filepath, tables);
      gha.setOutput('filepath', filepath);
      break
  }
}

function extractTables(inputs) {
  let tables = [];
  switch (inputs.format) {
    case 'objects':
      tables = mdTables.Extractor.extractAllObjects(inputs.markdown, inputs.orientation, false);
      break
    case 'arrays':
      tables = mdTables.Extractor.extractAllTables(inputs.markdown, inputs.orientation, false);
      break
    default:
      gha.setFailed(`Unknown format ${inputs.format}`)
      process.exit(1);
  }

  return JSON.stringify(tables)
}

main();
