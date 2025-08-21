const blessed = require('blessed');
const StatusTable = require('./components/statusTable');
const DetailPane = require('./components/detailPane');
const ProgressIndicator = require('./components/progressIndicator');
const header = require('./components/header');
const footer = require('./components/footer');
const Storage = require('../services/storage');
const Checker = require('../services/checker');
const Scheduler = require('../services/scheduler');

function startTui() {
  try {
    const storage = new Storage();
    const checker = new Checker(storage, { 
      concurrency: 4,
      enableGracefulDegradation: true 
    });
    const scheduler = new Scheduler(checker, storage);

    const screen = blessed.screen({ 
      smartCSR: true, 
      title: 'Domain Dash',
      dockBorders: true
    });

    // Ensure screen is properly initialized
    if (!screen || !screen.width || !screen.height) {
      console.error('Failed to initialize screen properly');
      process.exit(1);
    }

    // UI State
    let currentFilter = 'all'; // all, available, unavailable, checking, errors
    let searchQuery = '';
    let showDetailPane = false;
    let selectedDomain = null;
    let isChecking = false;
    let lastCheckTime = null;
    let providerHealth = {};

    // Create main layout containers
    const headerBox = blessed.box({ 
      top: 0, 
      left: 0, 
      width: '100%', 
      height: 3, 
      tags: true, 
      content: '',
      border: { type: 'line' },
      style: { 
        border: { fg: 'cyan' },
        bg: 'black'
      }
    });

    const statusBox = blessed.box({
      top: 3,
      left: 0,
      width: showDetailPane ? '60%' : '100%',
      bottom: 5,
      tags: true,
      border: { type: 'line' },
      style: { 
        border: { fg: 'white' },
        bg: 'black'
      }
    });

    const detailBox = blessed.box({
      top: 3,
      right: 0,
      width: '40%',
      bottom: 5,
      tags: true,
      border: { type: 'line' },
      style: { 
        border: { fg: 'yellow' },
        bg: 'black'
      },
      hidden: !showDetailPane
    });

    const filterBox = blessed.box({
      bottom: 3,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: { type: 'line' },
      style: { 
        border: { fg: 'green' },
        bg: 'black'
      }
    });

    const footerBox = blessed.box({ 
      bottom: 0, 
      left: 0, 
      width: '100%', 
      height: 3, 
      tags: true, 
      content: '',
      border: { type: 'line' },
      style: { 
        border: { fg: 'cyan' },
        bg: 'black'
      }
    });

    const statusTable = new StatusTable(getFilteredDomains());
    const detailPane = new DetailPane();
    const progressIndicator = new ProgressIndicator();

    function getFilteredDomains() {
      let domains = storage.getDomains();

      // Apply search filter
      if (searchQuery) {
        domains = domains.filter(d => 
          d.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Apply status filter
      switch (currentFilter) {
        case 'available':
          domains = domains.filter(d => 
            Object.values(d.results || {}).some(r => r.available === true)
          );
          break;
        case 'unavailable':
          domains = domains.filter(d => 
            Object.values(d.results || {}).some(r => r.available === false)
          );
          break;
        case 'checking':
          domains = domains.filter(d => 
            Object.values(d.results || {}).some(r => r.available === null && !r.error)
          );
          break;
        case 'errors':
          domains = domains.filter(d => 
            Object.values(d.results || {}).some(r => r.error)
          );
          break;
        default: // 'all'
          break;
      }

      return domains;
    }

    function renderHeader() {
      const domains = storage.getDomains();
      const available = domains.reduce((count, d) => 
        count + Object.values(d.results || {}).filter(r => r.available === true).length, 0
      );
      const total = domains.reduce((count, d) => 
        count + Object.keys(d.results || {}).length, 0
      );
      const checking = isChecking ? ' {yellow-fg}[CHECKING]{/yellow-fg}' : '';
      const lastCheck = lastCheckTime ? ` | Last: ${lastCheckTime.toLocaleTimeString()}` : '';
      
      headerBox.setContent(
        `{center}{bold}Domain Availability Dashboard{/bold}{/center}\n` +
        `{center}Monitoring ${domains.length} domains | ${available}/${total} available${checking}${lastCheck}{/center}`
      );
    }

    function renderFilter() {
      const filters = ['all', 'available', 'unavailable', 'checking', 'errors'];
      const filterButtons = filters.map(f => {
        const isActive = f === currentFilter;
        return isActive ? `{inverse}${f}{/inverse}` : f;
      }).join(' | ');

      const search = searchQuery ? ` | Search: "${searchQuery}"` : '';
      const health = Object.entries(providerHealth).map(([provider, healthy]) => 
        healthy ? `{green-fg}${provider}{/green-fg}` : `{red-fg}${provider}{/red-fg}`
      ).join(' ');

      filterBox.setContent(
        `Filters: ${filterButtons}${search}\n` +
        `Providers: ${health || 'Unknown'}`
      );
    }

    function renderFooter() {
      const interval = storage.getSetting('checkInterval') || 5;
      const shortcuts = [
        'q:quit', 'r:refresh', 'a:add', 'd:delete', 'e:edit',
        'Enter:details', '/:search', 'Tab:filter', 'F5:force-check'
      ];
      
      footerBox.setContent(
        `${shortcuts.join(' | ')} | Interval: ${interval}m\n` +
        `Use arrow keys to navigate, Space to select/deselect`
      );
    }

    function layout() {
      screen.children.forEach(c => c.detach());
      screen.append(headerBox);
      screen.append(statusBox);
      if (showDetailPane) {
        screen.append(detailBox);
        statusBox.width = '60%';
      } else {
        statusBox.width = '100%';
      }
      screen.append(filterBox);
      screen.append(footerBox);
      
      statusTable.render(statusBox);
      if (showDetailPane && selectedDomain) {
        detailPane.render(detailBox, selectedDomain);
      }
      
      renderHeader();
      renderFilter();
      renderFooter();
      screen.render();
    }

    function toggleDetailPane() {
      showDetailPane = !showDetailPane;
      detailBox.hidden = !showDetailPane;
      layout();
    }

    function updateSelection() {
      const domains = getFilteredDomains();
      const selectedIndex = statusTable.getSelectedIndex();
      selectedDomain = domains[selectedIndex] || null;
      
      if (showDetailPane) {
        if (selectedDomain) {
          detailPane.render(detailBox, selectedDomain);
        } else {
          detailBox.setContent('No domain selected');
        }
        screen.render();
      }
    }

    function refreshData() {
      statusTable.refresh(getFilteredDomains());
      updateSelection();
      layout();
    }

    function showSearchPrompt() {
      const prompt = blessed.prompt({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 'shrink',
        width: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'cyan' } }
      });

      prompt.input('Search domains:', searchQuery, (err, value) => {
        if (!err && value !== undefined) {
          searchQuery = value.trim();
          refreshData();
        }
        prompt.destroy();
        screen.render();
      });
    }

    function cycleFilter() {
      const filters = ['all', 'available', 'unavailable', 'checking', 'errors'];
      const currentIndex = filters.indexOf(currentFilter);
      currentFilter = filters[(currentIndex + 1) % filters.length];
      refreshData();
    }

    async function addDomain() {
      const prompt = blessed.prompt({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 'shrink',
        width: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'green' } }
      });

      prompt.input('Add domain name:', '', async (err, value) => {
        if (!err && value && value.trim()) {
          const domainName = value.trim();
          const extensions = storage.getSetting('extensions') || ['.com', '.org', '.net'];
          
          try {
            storage.addDomain({
              name: domainName,
              extensions: extensions
            });
            
            // Immediately check the new domain
            const domains = storage.getDomains();
            const newDomain = domains.find(d => d.name === domainName);
            if (newDomain) {
              isChecking = true;
              renderHeader();
              screen.render();
              await checker.checkDomain(newDomain);
              isChecking = false;
            }
            
            refreshData();
          } catch (error) {
            console.error('Failed to add domain:', error.message);
          }
        }
        prompt.destroy();
        screen.render();
      });
    }

    async function removeDomain() {
      if (!selectedDomain) return;
      
      const confirm = blessed.question({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 'shrink',
        width: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'red' } }
      });

      confirm.ask(`Remove domain "${selectedDomain.name}"?`, (err, value) => {
        if (!err && value) {
          try {
            storage.removeDomain(selectedDomain.name);
            selectedDomain = null;
            refreshData();
          } catch (error) {
            console.error('Failed to remove domain:', error.message);
          }
        }
        confirm.destroy();
        screen.render();
      });
    }

    // Initial data and layout
    statusTable.refresh(getFilteredDomains());
    layout();

    // Event handlers for real-time updates
    checker.on('cycleStarted', (data) => {
      isChecking = true;
      const domains = data.domains || storage.getDomains().length;
      progressIndicator.show(screen, {
        title: `Checking ${domains} domains...`,
        total: domains
      });
      renderHeader();
      screen.render();
    });

    checker.on('cycleComplete', (data) => {
      isChecking = false;
      lastCheckTime = data.timestamp || new Date();
      progressIndicator.hide();
      refreshData();
    });

    checker.on('updated', (domain) => {
      // Real-time domain update
      refreshData();
    });

    checker.on('domainCheckErrors', (data) => {
      // Update progress when domain completes (even with errors)
      if (progressIndicator.isShowing()) {
        const currentDomains = storage.getDomains().length;
        const completedDomains = storage.getDomains().filter(d => d.lastChecked).length;
        progressIndicator.update(completedDomains, currentDomains, `Checked ${data.domain}`);
      }
    });

    checker.on('available', (data) => {
      // Show notification for newly available domains
      const notification = blessed.message({
        parent: screen,
        top: 'center',
        left: 'center',
        height: 'shrink',
        width: 'shrink',
        border: { type: 'line' },
        style: { 
          border: { fg: 'green' },
          bg: 'green',
          fg: 'white'
        }
      });
      
      notification.display(`Domain Available!\n${data.fqdn}`, 3, () => {
        notification.destroy();
        screen.render();
      });
    });

    checker.on('providerUnhealthy', (data) => {
      providerHealth[data.provider] = false;
      renderFilter();
      screen.render();
    });

    checker.on('providerRecovered', (data) => {
      providerHealth[data.provider] = true;
      renderFilter();
      screen.render();
    });

    // Key bindings
    screen.key(['q', 'C-c'], () => {
      scheduler.stop();
      checker.destroy();
      return process.exit(0);
    });

    screen.key(['r'], async () => {
      const domains = storage.getDomains();
      if (domains.length > 0) {
        isChecking = true;
        renderHeader();
        screen.render();
        await checker.checkAll(domains);
        isChecking = false;
      }
    });

    screen.key(['F5'], async () => {
      // Force check with fresh provider health
      Object.keys(providerHealth).forEach(provider => {
        providerHealth[provider] = true;
      });
      checker.providerHealth = Object.fromEntries(
        Object.keys(checker.providerHealth).map(p => [p, { 
          failures: 0, 
          lastSuccess: Date.now(), 
          isHealthy: true 
        }])
      );
      
      const domains = storage.getDomains();
      if (domains.length > 0) {
        await checker.checkAll(domains);
      }
    });

    screen.key(['enter'], () => {
      toggleDetailPane();
    });

    screen.key(['/'], () => {
      showSearchPrompt();
    });

    screen.key(['tab'], () => {
      cycleFilter();
    });

    screen.key(['a'], () => {
      addDomain();
    });

    screen.key(['d', 'delete'], () => {
      removeDomain();
    });

    screen.key(['escape'], () => {
      if (showDetailPane) {
        toggleDetailPane();
      } else if (searchQuery) {
        searchQuery = '';
        refreshData();
      }
    });

    // Navigation keys
    screen.key(['up', 'down'], () => {
      updateSelection();
    });

    // Progress indicator for bulk operations
    scheduler.on('updated', () => {
      refreshData();
    });

    scheduler.on('cycleComplete', () => {
      refreshData();
    });

    // Initialize provider health
    Object.keys(checker.providerHealth).forEach(provider => {
      providerHealth[provider] = checker.providerHealth[provider].isHealthy;
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