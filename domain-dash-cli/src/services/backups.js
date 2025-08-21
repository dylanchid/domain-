const fs = require('fs');
const path = require('path');
const Storage = require('./storage');

class Backups {
  constructor() {
    this.storage = new Storage();
    this.backupDir = path.dirname(this.storage.configPath);
  }

  createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `domain--backup-${timestamp}.json`);
    const data = this.storage.exportData();
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    return backupPath;
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) return [];
    
    return fs.readdirSync(this.backupDir)
      .filter(file => file.startsWith('domain--backup-') && file.endsWith('.json'))
      .map(file => ({
        filename: file,
        path: path.join(this.backupDir, file),
        size: fs.statSync(path.join(this.backupDir, file)).size,
        created: fs.statSync(path.join(this.backupDir, file)).mtime
      }))
      .sort((a, b) => b.created - a.created);
  }

  restoreBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    const content = fs.readFileSync(backupPath, 'utf8');
    const data = JSON.parse(content);
    return this.storage.importData(data);
  }

  deleteBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    fs.unlinkSync(backupPath);
  }
}

module.exports = Backups;