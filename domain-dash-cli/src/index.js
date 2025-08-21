const { program } = require('commander');
const startTUI = require('./tui/index');
const { addCommand } = require('./cli/commands/add');
const { removeCommand } = require('./cli/commands/remove');
const { listCommand } = require('./cli/commands/list');
const { checkCommand } = require('./cli/commands/check');
const { watchCommand } = require('./cli/commands/watch');
const { importCommand } = require('./cli/commands/import');
const { exportCommand } = require('./cli/commands/export');
const { settingsCommand } = require('./cli/commands/settings');

// Initialize CLI commands
program
  .version('1.0.0')
  .description('Domain Availability Dashboard CLI');

// Add commands
addCommand(program);
removeCommand(program);
listCommand(program);
checkCommand(program);
watchCommand(program);
importCommand(program);
exportCommand(program);
settingsCommand(program);

// Check if we should start TUI (no arguments provided)
if (!process.argv.slice(2).length) {
  startTUI();
} else {
  // Parse command-line arguments
  program.parse(process.argv);
}