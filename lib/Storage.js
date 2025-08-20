const Conf = require('conf');
const path = require('path');
const fs = require('fs');

class Storage {
  constructor() {
    this.config = new Conf({
      projectName: 'domain-dash',
      defaults: {
        domains: [],
        settings: {
          checkInterval: 5, // minutes
          notifications: true,
          autoRefresh: true,
          extensions: ['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai']
        },
        history: []
      }
    });

    this.configPath = this.config.path;
  }

  // Domain management
  getDomains() {
    return this.config.get('domains', []);
  }

  saveDomains(domains) {
    this.config.set('domains', domains);
    this.addToHistory('domains_updated', { count: domains.length });
  }

  addDomain(domain) {
    const domains = this.getDomains();
    const existing = domains.find(d => d.name === domain.name);
    
    if (!existing) {
      domains.push({
        name: domain.name,
        extensions: domain.extensions || ['.com'],
        status: 'pending',
        available: null,
        lastChecked: null,
        addedAt: new Date().toISOString(),
        ...domain
      });
      
      this.saveDomains(domains);
      return true;
    }
    
    return false; // Already exists
  }

  removeDomain(domainName) {
    const domains = this.getDomains();
    const filtered = domains.filter(d => d.name !== domainName);
    
    if (filtered.length < domains.length) {
      this.saveDomains(filtered);
      return true;
    }
    
    return false; // Not found
  }

  updateDomainStatus(domainName, status) {
    const domains = this.getDomains();
    const domain = domains.find(d => d.name === domainName);
    
    if (domain) {
      const wasAvailable = domain.available;
      domain.status = status.status;
      domain.available = status.available;
      domain.lastChecked = new Date().toISOString();
      domain.error = status.error || null;
      
      // Track status changes
      if (wasAvailable !== null && wasAvailable !== status.available) {
        this.addToHistory('status_change', {
          domain: domainName,
          from: wasAvailable ? 'available' : 'taken',
          to: status.available ? 'available' : 'taken'
        });
      }
      
      this.saveDomains(domains);
      return true;
    }
    
    return false;
  }

  // Settings management
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

  // History tracking
  addToHistory(action, data = {}) {
    const history = this.config.get('history', []);
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      data
    };
    
    history.unshift(entry); // Add to beginning
    
    // Keep only last 1000 entries
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

  // Data export/import
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
        this.saveDomains(data.domains);
      }
      
      if (data.settings && typeof data.settings === 'object') {
        this.config.set('settings', { ...this.getSettings(), ...data.settings });
      }
      
      this.addToHistory('data_imported', { 
        domainCount: data.domains?.length || 0,
        importedAt: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      // Restore backup on error
      this.config.set('domains', backup.domains);
      this.config.set('settings', backup.settings);
      throw error;
    }
  }

  // Statistics
  getStats() {
    const domains = this.getDomains();
    const now = new Date();
    
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

    // Count by extensions
    domains.forEach(domain => {
      const ext = this.extractExtension(domain.name);
      if (ext) {
        stats.extensionBreakdown[ext] = (stats.extensionBreakdown[ext] || 0) + 1;
      }
    });

    return stats;
  }

  extractExtension(domainName) {
    const extensions = this.getSetting('extensions');
    return extensions.find(ext => domainName.endsWith(ext)) || null;
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

  // Cleanup utilities
  clearAll() {
    this.config.clear();
  }

  reset() {
    const defaultSettings = this.config.defaults;
    this.config.clear();
    this.config.set('settings', defaultSettings.settings);
  }

  // Backup management
  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(this.configPath), `domain-dash-backup-${timestamp}.json`);
    return this.exportToFile(backupPath);
  }

  listBackups() {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) return [];
    
    return fs.readdirSync(configDir)
      .filter(file => file.startsWith('domain-dash-backup-') && file.endsWith('.json'))
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

