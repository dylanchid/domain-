const Conf = require('conf');
const path = require('path');
const fs = require('fs');

class Storage {
  constructor() {
    // Keep defaults locally for reliable reset()
    this.defaults = {
      domains: [],
      settings: {
        checkInterval: 5, // minutes
        notifications: true,
        autoRefresh: true,
        extensions: ['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai']
      },
      history: []
    };

    // Use isolated config in test environment to avoid cross-test interference
    const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    const projectName = isTestEnv
      ? `domain--test-${process.env.JEST_WORKER_ID || '1'}`
      : 'domain-';

    this.config = new Conf({
      projectName,
      defaults: this.defaults
    });

    this.configPath = this.config.path;
  }

  // Domains
  getDomains() {
    return this.config.get('domains', []);
  }

  saveDomains(domains) {
    this.config.set('domains', domains);
    this.addToHistory('domains_updated', { count: domains.length });
  }

  normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  addDomain(domain) {
    const domains = this.getDomains();
    const name = this.normalizeName(domain.name);
    const existing = domains.find(d => this.normalizeName(d.name) === name);
    
    if (!existing) {
      domains.push({
        name,
        extensions: domain.extensions || ['.com'],
        // Per-extension status map
        results: {}, // { '.com': { available, lastChecked, error, via } }
        status: 'pending',
        available: null,
        lastChecked: null,
        addedAt: new Date().toISOString(),
        ...domain,
        name // ensure normalized name persists
      });
      
      this.saveDomains(domains);
      return true;
    }
    
    return false; // Already exists
  }

  removeDomain(domainName) {
    const domains = this.getDomains();
    const filtered = domains.filter(d => this.normalizeName(d.name) !== this.normalizeName(domainName));
    
    if (filtered.length < domains.length) {
      this.saveDomains(filtered);
      return true;
    }
    
    return false; // Not found
  }

  // Backward-compatible aggregate update
  updateDomainStatus(domainName, status) {
    const domains = this.getDomains();
    const name = this.normalizeName(domainName);
    const domain = domains.find(d => this.normalizeName(d.name) === name);
    
    if (domain) {
      const wasAvailable = domain.available;
      domain.status = status.status;
      domain.available = status.available;
      domain.lastChecked = new Date().toISOString();
      domain.error = status.error || null;
      
      if (wasAvailable !== null && wasAvailable !== status.available) {
        this.addToHistory('status_change', {
          domain: name,
          from: wasAvailable ? 'available' : 'taken',
          to: status.available ? 'available' : 'taken'
        });
      }
      
      this.saveDomains(domains);
      return true;
    }
    
    return false;
  }

  // Per-extension update and aggregate sync with enhanced data
  updateDomainExtensionStatus(domainName, extension, status) {
    const domains = this.getDomains();
    const name = this.normalizeName(domainName);
    const domain = domains.find(d => this.normalizeName(d.name) === name);
    if (!domain) return false;

    if (!domain.results) domain.results = {};
    const prev = domain.results[extension] || { available: null };

    // Store enhanced status information
    domain.results[extension] = {
      available: status.available,
      lastChecked: new Date().toISOString(),
      error: status.error || null,
      via: status.via || null,
      timestamp: status.timestamp || new Date().toISOString(),
      duration: status.duration || null,
      details: status.details || null,
      warning: status.warning || null,
      degraded: status.degraded || false,
      retryable: status.retryable || false
    };

    // Aggregate status for legacy consumers
    domain.lastChecked = new Date().toISOString();
    const statuses = (domain.extensions || []).map(ext => domain.results?.[ext]?.available);
    if (statuses.some(v => v === true)) {
      domain.available = true;
      domain.status = 'available';
    } else if (statuses.some(v => v === null || v === undefined)) {
      domain.available = null;
      domain.status = 'pending';
    } else if (statuses.length) {
      domain.available = false;
      domain.status = 'taken';
    }

    // Track status changes for history
    if (prev.available !== null && prev.available !== status.available) {
      this.addToHistory('status_change', {
        domain: name,
        extension,
        from: prev.available ? 'available' : 'taken',
        to: status.available ? 'available' : 'taken',
        via: status.via,
        timestamp: status.timestamp
      });
    }

    // Track errors for monitoring
    if (status.error && !prev.error) {r
      this.addToHistory('error_detected', {
        domain: name,
        extension,
        error: status.error,
        via: status.via,
        timestamp: status.timestamp
      });
    }

    this.saveDomains(domains);
    this.saveDomains(domains);
    return true;
  }

  // Settings
  getSettings() {
    return this.config.get('settings');
  }

  updateSettings(newSettings) {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    this.config.set('settings', updatedSettings);
    this.addToHistory('settings_updated', newSettings);
    return updatedSettings;
  }

  getSetting(key) {
    return this.config.get(`settings.${key}`);
  }

  setSetting(key, value) {
    this.config.set(`settings.${key}`, value);
    this.addToHistory('setting_changed', { key, value });
  }

  // History
  addToHistory(action, data = {}) {
    const history = this.config.get('history', []);
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      data
    };
    
    history.unshift(entry);
    
    if (history.length > 1000) {
      history.splice(1000);
    }
    
    this.config.set('history', history);
  }

  getHistory(limit = 100) {
    const history = this.config.get('history', []);
    return history.slice(0, limit);
  }

  clearHistory() {
    this.config.set('history', []);
  }

  // Import/Export
  exportData() {
    return {
      domains: this.getDomains(),
      settings: this.getSettings(),
      history: this.getHistory(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  importData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data');
    }

    const backup = this.exportData();
    
    try {
      if (data.domains && Array.isArray(data.domains)) {
        // migrate to ensure results exists
        const migrated = data.domains.map(d => ({ results: {}, ...d }));
        this.saveDomains(migrated);
      }
      
      if (data.settings && typeof data.settings === 'object') {
        this.config.set('settings', { ...this.getSettings(), ...data.settings });
      }

      if (Array.isArray(data.history)) {
        this.config.set('history', data.history);
      }
      
      this.addToHistory('data_imported', { 
        domainCount: data.domains?.length || 0,
        importedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      this.config.set('domains', backup.domains);
      this.config.set('settings', backup.settings);
      this.config.set('history', backup.history || []);
      throw error;
    }
  }

  // Stats
  getStats() {
    const domains = this.getDomains();
    
    const stats = {
      totalDomains: domains.length,
      availableDomains: domains.filter(d => d.available === true).length,
      takenDomains: domains.filter(d => d.available === false).length,
      pendingDomains: domains.filter(d => d.available === null).length,
      errorDomains: domains.filter(d => d.error).length,
      lastCheck: domains.reduce((latest, domain) => {
        if (!domain.lastChecked) return latest;
        const checkTime = new Date(domain.lastChecked);
        return !latest || checkTime > latest ? checkTime : latest;
      }, null),
      extensionBreakdown: {}
    };

    // Count configured extensions per domain
    domains.forEach(domain => {
      (domain.extensions || []).forEach(ext => {
        stats.extensionBreakdown[ext] = (stats.extensionBreakdown[ext] || 0) + 1;
      });
    });

    return stats;
  }

  // File operations
  exportToFile(filePath) {
    const data = this.exportData();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  importFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    return this.importData(data);
  }

  // Cleanup
  clearAll() {
    this.config.clear();
  }

  reset() {
    this.config.clear();
    this.config.set('settings', this.defaults.settings);
    this.config.set('domains', this.defaults.domains);
    this.config.set('history', this.defaults.history);
  }

  // Backups
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(this.configPath), `domain--backup-${timestamp}.json`);
    return this.exportToFile(backupPath);
  }

  listBackups() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) return [];
    
    return fs.readdirSync(configDir)
      .filter(file => file.startsWith('domain--backup-') && file.endsWith('.json'))
      .map(file => ({
        filename: file,
        path: path.join(configDir, file),
        size: fs.statSync(path.join(configDir, file)).size,
        created: fs.statSync(path.join(configDir, file)).mtime
      }))
      .sort((a, b) => b.created - a.created);
  }

  getBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    const content = fs.readFileSync(backupPath, 'utf8');
    return JSON.parse(content);
  }

  getBackupList() {
    const backups = this.listBackups();
    return backups.map(backup => ({
      path: backup.path,
      created: backup.created
    }));
  }

  deleteBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    fs.unlinkSync(backupPath);
  }

  restoreBackup(backupPath) {
    return this.importFromFile(backupPath);
  }
}

module.exports = Storage;