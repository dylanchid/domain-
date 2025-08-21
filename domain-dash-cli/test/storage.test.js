const Storage = require('../src/services/storage');
const Conf = require('conf');

describe('Storage', () => {
  let storage;

  beforeEach(() => {
    storage = new Storage();
    storage.config.clear(); // Clear previous data before each test
  });

  afterEach(() => {
    storage.clearAll(); // Clean up after each test
  });

  test('should initialize with default settings', () => {
    const settings = storage.getSettings();
    expect(settings.checkInterval).toBe(5);
    expect(settings.notifications).toBe(true);
    expect(settings.autoRefresh).toBe(true);
    expect(settings.extensions).toEqual(['.com', '.org', '.net', '.co', '.io', '.dev', '.app', '.ai']);
  });

  test('should add a domain', () => {
    const domain = { name: 'example' };
    const result = storage.addDomain(domain);
    expect(result).toBe(true);
    expect(storage.getDomains()).toContainEqual(expect.objectContaining(domain));
  });

  test('should not add a duplicate domain', () => {
    const domain = { name: 'example' };
    storage.addDomain(domain);
    const result = storage.addDomain(domain);
    expect(result).toBe(false);
  });

  test('should remove a domain', () => {
    const domain = { name: 'example' };
    storage.addDomain(domain);
    const result = storage.removeDomain(domain.name);
    expect(result).toBe(true);
    expect(storage.getDomains()).not.toContainEqual(expect.objectContaining(domain));
  });

  test('should not remove a non-existent domain', () => {
    const result = storage.removeDomain('nonexistent.com');
    expect(result).toBe(false);
  });

  test('should update domain status', () => {
    const domain = { name: 'example' };
    storage.addDomain(domain);
    const status = { status: 'available', available: true };
    const result = storage.updateDomainStatus(domain.name, status);
    expect(result).toBe(true);
    expect(storage.getDomains()[0].status).toBe('available');
    expect(storage.getDomains()[0].available).toBe(true);
  });

  test('should track history of actions', () => {
    const domain = { name: 'example.com' };
    storage.addDomain(domain);
    storage.updateDomainStatus(domain.name, { status: 'available', available: true });
    const history = storage.getHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].action).toBe('domains_updated');
  });

  test('should export and import data', () => {
    const domain = { name: 'example' };
    storage.addDomain(domain);
    const exportedData = storage.exportData();
    storage.clearAll(); // Clear storage
    storage.importData(exportedData);
    expect(storage.getDomains()).toContainEqual(expect.objectContaining(domain));
  });

  test('should create and list backups', () => {
    const backupPath = storage.createBackup();
    const backups = storage.listBackups();
    expect(backups).toContainEqual(expect.objectContaining({ path: backupPath }));
  });

  test('should restore from backup', () => {
    const domain = { name: 'example' };
    storage.addDomain(domain);
    const backupPath = storage.createBackup();
    storage.removeDomain(domain.name);
    storage.restoreBackup(backupPath);
    expect(storage.getDomains()).toContainEqual(expect.objectContaining(domain));
  });
});