const { Command } = require('commander');
const { addDomain } = require('./commands/add');
const { removeDomain } = require('./commands/remove');
const { listDomains } = require('./commands/list');
const { checkDomains } = require('./commands/check');
const { watchDomains } = require('./commands/watch');
const { importDomains } = require('./commands/import');
const { exportDomains } = require('./commands/export');
const { manageSettings } = require('./commands/settings');
const { start: serviceStart, stop: serviceStop, status: serviceStatus, logs: serviceLogs } = require('./commands/service');
const startTui = require('../tui');

const program = new Command();

program
  .name('domain-')
  .description('Domain Availability Dashboard CLI')
  .version('1.0.0');

program
  .command('add <domain>')
  .description('Add a domain to the monitoring list')
  .option('-e, --extensions <exts>', 'Comma-separated list of TLDs to track (e.g., .com,.org,.io)')
  .action((domain, options) => {
    if (options.extensions) {
      const exts = options.extensions.split(',').map(e => e.trim());
      return addDomain({ name: domain, extensions: exts });
    }
    return addDomain(domain);
  });

program
  .command('remove <domain>')
  .description('Remove a domain from the monitoring list')
  .action(removeDomain);

program
  .command('list')
  .description('List all monitored domains and their statuses')
  .action(listDomains);

program
  .command('check')
  .description('Check availability for all monitored domains')
  .option('-c, --concurrency <n>', 'Max concurrent checks', v => Number(v), 4)
  .action(checkDomains);

program
  .command('watch')
  .description('Start monitoring domains at specified intervals')
  .option('-i, --interval <minutes>', 'Interval in minutes', v => Number(v), undefined)
  .option('--no-notifications', 'Disable system notifications')
  .option('-c, --concurrency <n>', 'Max concurrent checks', v => Number(v), 4)
  .option('-d, --daemon [manager]', 'Run as a background service via pm2 or launchd ("pm2" | "launchd")')
  .action(watchDomains);

program
  .command('import <file>')
  .description('Import domains from a JSON or CSV file')
  .action(importDomains);

program
  .command('export')
  .description('Export monitored domains to a JSON or CSV file')
  .option('-f, --format <format>', 'json or csv', 'json')
  .option('-o, --out <file>', 'output file path')
  .action(exportDomains);

program
  .command('settings')
  .description('Manage application settings')
  .action(manageSettings);

// Service management (pm2 / launchd)
const service = program
  .command('service')
  .description('Manage the background service (pm2 or launchd)');

service
  .command('start')
  .description('Start the background service')
  .option('-m, --manager <manager>', 'pm2 or launchd', 'pm2')
  .option('--startup', 'Enable startup on boot (pm2 startup / launchd KeepAlive hints)')
  .action(serviceStart);

service
  .command('stop')
  .description('Stop the background service')
  .option('-m, --manager <manager>', 'pm2 or launchd', 'pm2')
  .action(serviceStop);

service
  .command('status')
  .description('Show service status')
  .option('-m, --manager <manager>', 'pm2 or launchd', 'pm2')
  .action(serviceStatus);

service
  .command('logs')
  .description('Tail service logs')
  .option('-m, --manager <manager>', 'pm2 or launchd', 'pm2')
  .option('-f, --follow', 'Follow logs (pm2)')
  .option('-n, --lines <n>', 'Number of lines to show (pm2)', v => Number(v), 100)
  .action(serviceLogs);

// TUI launcher
program
  .command('tui')
  .description('Start the terminal UI and live updates')
  .action(() => startTui());

module.exports = program;