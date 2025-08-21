const blessed = require('blessed');

class StatusTable {
  constructor(domains) {
    this.domains = domains;
    this.table = null; // Don't create table immediately
  }

  createTable(options = {}) {
    const table = blessed.listtable({
      keys: true,
      vi: true,
      border: { type: 'line' },
      style: {
        header: {
          fg: 'white',
          bg: 'blue',
        },
        cell: {
          fg: 'white',
          bg: 'black',
        },
        selected: {
          bg: 'blue',
          fg: 'white',
        },
      },
      // Set position and dimensions during creation
      top: options.top || 0,
      left: options.left || 0,
      width: options.width || '100%',
      height: options.height || '100%',
    });

    table.setData(this.buildData());
    return table;
  }

  buildData() {
    // Determine all extensions in use to make columns
    const allExts = Array.from(new Set(this.domains.flatMap(d => d.extensions || []))).sort();
    const header = ['Domain', ...allExts, 'Last Checked'];

    const rows = this.domains.map(domain => {
      const cells = allExts.map(ext => {
        const v = domain.results?.[ext]?.available;
        return v === true ? '✓' : v === false ? '×' : '…';
      });
      return [domain.name, ...cells, domain.lastChecked || 'N/A'];
    });
    return [header, ...rows];
  }

  updateTable() {
    if (this.table) {
      this.table.setData(this.buildData());
    }
  }

  render(screen, { top = 0, bottom = 0 } = {}) {
    try {
      // Ensure screen is available and has dimensions
      if (!screen || typeof screen.width === 'undefined' || typeof screen.height === 'undefined') {
        throw new Error('Screen not properly initialized');
      }

      // Create table with proper dimensions if not already created
      if (!this.table) {
        this.table = this.createTable({
          top: top,
          left: 0,
          width: screen.width,
          height: Math.max(10, screen.height - (top + bottom))
        });
      }
      
      screen.append(this.table);
      this.table.focus();
      
      // Only select if there are rows
      if (this.domains && this.domains.length > 0) {
        this.table.select(0);
      }
    } catch (err) {
      console.error('StatusTable render error:', err.message);
      throw err;
    }
  }

  refresh(domains) {
    this.domains = domains;
    this.updateTable();
  }
}

module.exports = StatusTable;