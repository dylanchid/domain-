#!/usr/bin/env node

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const { Command } = require('commander');
const chalk = require('chalk');
const DomainChecker = require('./lib/DomainChecker');
const Storage = require('./lib/Storage');
const Notifier = require('./lib/Notifier');

const program = new Command();

program
  .name('domain-dash')
  .description('CLI domain availability dashboard')
  .version('1.0.0')
  .option('-d, --daemon', 'run as background daemon')
  .option('-i, --interval <minutes>', 'check interval in minutes', '5')
  .option('-c, --config', 'show configuration')
  .parse();

const options = program.opts();

class DomainDashboard {
  constructor() {
    this.storage = new Storage();
    this.checker = new DomainChecker();
    this.notifier = new Notifier();
    this.domains = this.storage.getDomains();
    this.isRunning = true;
    this.autoRefreshInterval = null;
    
    // Default extensions
    this.extensions = ['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai'];
  }

  init() {
    this.createScreen();
    this.createWidgets();
    this.bindEvents();
    this.refreshDomains();
    this.startAutoRefresh();
  }

  createScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Domain Availability Dashboard'
    });

    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
      return process.exit(0);
    });
  }

  createWidgets() {
    // Header
    this.header = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}{bold}🌐 Domain Availability Dashboard{/bold}{/center}\n{center}Press \'a\' to add domain, \'r\' to refresh, \'s\' to settings, \'q\' to quit{/center}',
      tags: true,
      border: { type: 'line' },
      style: {
        border: { fg: 'blue' },
        fg: 'white'
      }
    });

    // Domain list
    this.domainTable = blessed.table({
      top: 3,
      left: 0,
      width: '70%',
      height: '70%',
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        header: { fg: 'white', bold: true },
        cell: { selected: { bg: 'blue' } }
      },
      columnSpacing: 2,
      columnWidth: [20, 8, 8, 8, 8, 8, 8, 8, 8]
    });

    // Status panel
    this.statusPanel = blessed.box({
      top: 3,
      left: '70%',
      width: '30%',
      height: '35%',
      border: { type: 'line' },
      label: ' Status ',
      style: {
        border: { fg: 'green' }
      }
    });

    // Activity log
    this.activityLog = blessed.log({
      top: '38%',
      left: '70%',
      width: '30%',
      height: '35%',
      border: { type: 'line' },
      label: ' Activity Log ',
      style: {
        border: { fg: 'yellow' }
      },
      scrollable: true,
      mouse: true
    });

    // Input form (hidden by default)
    this.inputForm = blessed.form({
      top: 'center',
      left: 'center',
      width: 50,
      height: 12,
      border: { type: 'line' },
      label: ' Add Domain ',
      style: {
        border: { fg: 'magenta' }
      },
      hidden: true
    });

    this.domainInput = blessed.textbox({
      top: 1,
      left: 2,
      width: '90%',
      height: 3,
      border: { type: 'line' },
      label: ' Domain Name ',
      inputOnFocus: true
    });

    this.extensionsList = blessed.list({
      top: 5,
      left: 2,
      width: '90%',
      height: 5,
      border: { type: 'line' },
      label: ' Extensions (Space to toggle, Enter to confirm) ',
      style: {
        selected: { bg: 'blue' }
      },
      mouse: true,
      keys: true,
      vi: true
    });

    // Bottom status bar
    this.statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      style: {
        border: { fg: 'white' }
      }
    });

    // Add widgets to form
    this.inputForm.append(this.domainInput);
    this.inputForm.append(this.extensionsList);

    // Add all widgets to screen
    this.screen.append(this.header);
    this.screen.append(this.domainTable);
    this.screen.append(this.statusPanel);
    this.screen.append(this.activityLog);
    this.screen.append(this.inputForm);
    this.screen.append(this.statusBar);
  }

  bindEvents() {
    // Add domain
    this.screen.key(['a'], () => this.showAddDomainForm());
    
    // Refresh
    this.screen.key(['r'], () => this.refreshDomains());
    
    // Settings
    this.screen.key(['s'], () => this.showSettings());
    
    // Delete domain
    this.screen.key(['d'], () => this.deleteDomain());
    
    // Export
    this.screen.key(['e'], () => this.exportData());

    // Form events
    this.domainInput.on('submit', () => {
      this.extensionsList.focus();
      this.populateExtensions();
    });

    this.extensionsList.on('select', () => {
      this.addDomainToList();
    });
  }

  showAddDomainForm() {
    this.inputForm.show();
    this.domainInput.focus();
    this.screen.render();
  }

  populateExtensions() {
    const items = this.extensions.map(ext => ({
      text: ext,
      selected: true
    }));
    
    this.extensionsList.setItems(items.map(item => item.text));
    this.screen.render();
  }

  async addDomainToList() {
    const domainName = this.domainInput.value.trim();
    if (!domainName) return;

    const selectedExtensions = this.extensions; // For now, add all extensions
    
    for (const ext of selectedExtensions) {
      const fullDomain = domainName + ext;
      if (!this.domains.find(d => d.name === fullDomain)) {
        this.domains.push({
          name: fullDomain,
          status: 'checking',
          lastChecked: new Date().toISOString(),
          available: null
        });
      }
    }

    this.storage.saveDomains(this.domains);
    this.inputForm.hide();
    this.domainInput.setValue('');
    this.refreshDomains();
    this.screen.render();
  }

  async refreshDomains() {
    this.log('🔄 Refreshing domain status...');
    this.updateStatusPanel('Checking domains...', 'yellow');

    let availableCount = 0;
    let takenCount = 0;
    let newlyAvailable = [];

    for (const domain of this.domains) {
      const wasAvailable = domain.available;
      
      try {
        const isAvailable = await this.checker.checkDomain(domain.name);
        domain.available = isAvailable;
        domain.status = isAvailable ? 'available' : 'taken';
        domain.lastChecked = new Date().toISOString();

        if (isAvailable) {
          availableCount++;
          if (wasAvailable === false) {
            newlyAvailable.push(domain.name);
          }
        } else {
          takenCount++;
        }
      } catch (error) {
        domain.status = 'error';
        domain.error = error.message;
      }
    }

    // Send notifications for newly available domains
    if (newlyAvailable.length > 0) {
      this.notifier.notify(`${newlyAvailable.length} domain(s) now available!`, newlyAvailable.join(', '));
      newlyAvailable.forEach(domain => {
        this.log(`🎉 ${domain} is now available!`);
      });
    }

    this.storage.saveDomains(this.domains);
    this.updateTable();
    this.updateStatusPanel(
      `✅ ${availableCount} available, ❌ ${takenCount} taken\nLast check: ${new Date().toLocaleTimeString()}`,
      availableCount > 0 ? 'green' : 'red'
    );
    
    this.log(`✅ Check complete: ${availableCount} available, ${takenCount} taken`);
  }

  updateTable() {
    const headers = ['Domain', ...this.extensions];
    const rows = [];

    // Group domains by base name
    const grouped = {};
    this.domains.forEach(domain => {
      const ext = this.extensions.find(e => domain.name.endsWith(e));
      const baseName = ext ? domain.name.replace(ext, '') : domain.name;
      
      if (!grouped[baseName]) {
        grouped[baseName] = {};
      }
      grouped[baseName][ext] = domain.available;
    });

    Object.keys(grouped).forEach(baseName => {
      const row = [baseName];
      this.extensions.forEach(ext => {
        const status = grouped[baseName][ext];
        if (status === true) {
          row.push(chalk.green('✓'));
        } else if (status === false) {
          row.push(chalk.red('✗'));
        } else {
          row.push(chalk.yellow('?'));
        }
      });
      rows.push(row);
    });

    this.domainTable.setData([headers, ...rows]);
    this.screen.render();
  }

  updateStatusPanel(content, color = 'white') {
    this.statusPanel.setContent(content);
    this.statusPanel.style.fg = color;
    this.screen.render();
  }

  log(message) {
    this.activityLog.add(`${new Date().toLocaleTimeString()} - ${message}`);
    this.screen.render();
  }

  startAutoRefresh() {
    const interval = parseInt(options.interval) * 60 * 1000; // Convert to milliseconds
    this.autoRefreshInterval = setInterval(() => {
      this.refreshDomains();
    }, interval);

    this.updateStatusBar(`Auto-refresh: ${options.interval} min | Monitoring ${this.domains.length} domains`);
  }

  updateStatusBar(content) {
    this.statusBar.setContent(`{center}${content}{/center}`);
    this.statusBar.style.fg = 'cyan';
    this.screen.render();
  }

  showSettings() {
    // TODO: Implement settings panel
    this.log('⚙️ Settings panel coming soon...');
  }

  deleteDomain() {
    // TODO: Implement domain deletion
    this.log('🗑️ Delete functionality coming soon...');
  }

  async exportData() {
    try {
      const csvWriter = require('./lib/CsvExporter');
      await csvWriter.exportDomains(this.domains);
      this.log('📊 Data exported to domains_export.csv');
    } catch (error) {
      this.log(`❌ Export failed: ${error.message}`);
    }
  }

  cleanup() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
  }
}

// Main execution
if (options.config) {
  console.log(chalk.blue('Domain Dashboard Configuration:'));
  console.log(chalk.green(`Config file: ${new Storage().configPath}`));
  process.exit(0);
}

if (options.daemon) {
  require('./daemon')(options);
} else {
  console.log(chalk.blue('🌐 Starting Domain Dashboard...'));
  const dashboard = new DomainDashboard();
  dashboard.init();
}