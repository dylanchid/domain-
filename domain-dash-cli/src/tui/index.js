const blessed = require('blessed');
const StatusTable = require('./components/statusTable');
const header = require('./components/header');
const footer = require('./components/footer');
const Storage = require('../services/storage');
const Checker = require('../services/checker');
const Scheduler = require('../services/scheduler');

function startTui() {
  try {
    const storage = new Storage();
    const checker = new Checker(storage, { concurrency: 4 });
    const scheduler = new Scheduler(checker, storage);

    const screen = blessed.screen({ smartCSR: true, title: 'Domain Dash' });

    // Ensure screen is properly initialized
    if (!screen || !screen.width || !screen.height) {
      console.error('Failed to initialize screen properly');
      process.exit(1);
    }

    // Header/footer
    const headerBox = blessed.box({ top: 0, left: 0, width: '100%', height: 5, tags: true, content: '' });
    const footerBox = blessed.box({ bottom: 0, left: 0, width: '100%', height: 4, tags: true, content: '' });

    const statusTable = new StatusTable(storage.getDomains());

  function renderHeader() {
    // Use existing header() printer but capture content via simple strings
    headerBox.setContent('Domain Availability Dashboard\nMonitor your domains and check availability.');
  }

  function renderFooter() {
    footerBox.setContent(`Press q to quit | r to refresh now | Interval: ${storage.getSetting('checkInterval') || 5}m`);
  }

  function layout() {
    screen.children.forEach(c => c.detach());
    screen.append(headerBox);
    statusTable.render(screen, { top: 5, bottom: 4 });
    screen.append(footerBox);
    renderHeader();
    renderFooter();
    screen.render();
  }

  // Initial data
  statusTable.refresh(storage.getDomains());
  layout();

  // Key bindings
  screen.key(['q', 'C-c'], () => {
    scheduler.stop();
    return process.exit(0);
  });
  screen.key(['r'], async () => {
    const domains = storage.getDomains();
    await checker.checkAll(domains);
  });

  // Live updates
  scheduler.on('updated', () => {
    statusTable.refresh(storage.getDomains());
    screen.render();
  });
  scheduler.on('cycleComplete', () => {
    statusTable.refresh(storage.getDomains());
    renderFooter();
    screen.render();
  });

  const interval = storage.getSetting('checkInterval') || 5;
  scheduler.start(interval);
  } catch (err) {
    console.error('TUI Error:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

module.exports = startTui;