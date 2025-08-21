const blessed = require('blessed');

class StatusTable {
  constructor(domains) {
    this.domains = domains;
    this.table = null;
    this.selectedIndex = 0;
  }

  createTable(container) {
    const table = blessed.listtable({
      parent: container,
      keys: true,
      vi: true,
      interactive: true,
      border: { type: 'line' },
      style: {
        header: {
          fg: 'white',
          bg: 'blue',
          bold: true
        },
        cell: {
          fg: 'white',
          bg: 'black',
        },
        selected: {
          bg: 'blue',
          fg: 'white',
          bold: true
        },
        focus: {
          border: { fg: 'cyan' }
        }
      },
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      tags: true
    });

    table.setData(this.buildData());
    return table;
  }

  buildData() {
    // Determine all extensions in use to make columns
    const allExts = Array.from(new Set(this.domains.flatMap(d => d.extensions || []))).sort();
    const header = ['Domain', ...allExts, 'Last Checked', 'Status'];

    const rows = this.domains.map(domain => {
      const cells = allExts.map(ext => {
        const result = domain.results?.[ext];
        if (!result) return '{yellow-fg}…{/yellow-fg}';
        
        if (result.available === true) {
          return '{green-fg}✓{/green-fg}';
        } else if (result.available === false) {
          return '{red-fg}×{/red-fg}';
        } else if (result.error) {
          return '{red-fg}E{/red-fg}';
        } else {
          return '{yellow-fg}?{/yellow-fg}';
        }
      });

      // Last checked column
      const lastChecked = domain.lastChecked ? 
        new Date(domain.lastChecked).toLocaleTimeString() : 
        'Never';

      // Status column - overall domain status
      let status = '';
      const results = Object.values(domain.results || {});
      const available = results.filter(r => r.available === true).length;
      const registered = results.filter(r => r.available === false).length;
      const errors = results.filter(r => r.error).length;
      const total = results.length;

      if (total === 0) {
        status = '{yellow-fg}New{/yellow-fg}';
      } else if (available > 0) {
        status = `{green-fg}${available} Avail{/green-fg}`;
      } else if (errors > 0) {
        status = `{red-fg}${errors} Err{/red-fg}`;
      } else if (registered === total) {
        status = '{red-fg}All Reg{/red-fg}';
      } else {
        status = '{yellow-fg}Checking{/yellow-fg}';
      }

      return [domain.name, ...cells, lastChecked, status];
    });

    return [header, ...rows];
  }

  updateTable() {
    if (this.table) {
      this.table.setData(this.buildData());
      
      // Maintain selection if possible
      if (this.selectedIndex >= this.domains.length) {
        this.selectedIndex = Math.max(0, this.domains.length - 1);
      }
      
      if (this.domains.length > 0) {
        this.table.select(this.selectedIndex);
      }
    }
  }

  render(container) {
    try {
      // Create table if not already created
      if (!this.table) {
        this.table = this.createTable(container);
        
        // Add event handlers
        this.table.on('select', (item, index) => {
          this.selectedIndex = Math.max(0, index - 1); // -1 because header is index 0
        });

        this.table.focus();
      }
      
      // Update table data
      this.updateTable();
      
    } catch (err) {
      console.error('StatusTable render error:', err.message);
      throw err;
    }
  }

  refresh(domains) {
    this.domains = domains;
    this.updateTable();
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  getSelectedDomain() {
    return this.domains[this.selectedIndex] || null;
  }

  selectNext() {
    if (this.table && this.domains.length > 0) {
      this.selectedIndex = Math.min(this.selectedIndex + 1, this.domains.length - 1);
      this.table.select(this.selectedIndex + 1); // +1 because of header
    }
  }

  selectPrevious() {
    if (this.table && this.domains.length > 0) {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      this.table.select(this.selectedIndex + 1); // +1 because of header
    }
  }

  focus() {
    if (this.table) {
      this.table.focus();
    }
  }
}

module.exports = StatusTable;