const EventEmitter = require('events');

class Scheduler extends EventEmitter {
  constructor(checker, storage) {
    super();
    this.checker = checker;
    this.storage = storage;
    this.timer = null;
    this.isRunning = false;
    this.currentCycle = null;

    // Forward checker events with additional context
    checker.on('available', payload => {
      this.emit('available', payload);
      this.emit('domainUpdate', { type: 'available', ...payload });
    });
    
    checker.on('updated', domain => {
      this.emit('updated', domain);
      this.emit('domainUpdate', { type: 'updated', domain });
    });
    
    checker.on('cycleStarted', data => {
      this.currentCycle = data;
      this.emit('cycleStarted', data);
    });
    
    checker.on('cycleComplete', data => {
      this.currentCycle = null;
      this.emit('cycleComplete', data);
    });
    
    checker.on('cycleFailed', data => {
      this.currentCycle = null;
      this.emit('cycleFailed', data);
    });

    checker.on('domainCheckErrors', data => {
      this.emit('domainCheckErrors', data);
    });

    checker.on('domainCheckFailed', data => {
      this.emit('domainCheckFailed', data);
    });

    checker.on('providerUnhealthy', data => {
      this.emit('providerUnhealthy', data);
    });

    checker.on('providerRecovered', data => {
      this.emit('providerRecovered', data);
    });
  }

  start(intervalMinutes) {
    this.stop();
    const intervalMs = Math.max(1, Number(intervalMinutes || this.storage.getSetting('checkInterval') || 5)) * 60_000;

    const run = async () => {
      const domains = this.storage.getDomains();
      if (!domains.length) {
        this.emit('cycleSkipped', { reason: 'no_domains', timestamp: new Date() });
        return;
      }
      
      this.isRunning = true;
      try {
        await this.checker.checkAll(domains);
      } catch (error) {
        this.emit('cycleError', { error: error.message, timestamp: new Date() });
      } finally {
        this.isRunning = false;
      }
    };

    // Initial run then interval
    run().catch(() => {});
    this.timer = setInterval(() => {
      if (!this.isRunning) { // Prevent overlapping runs
        run().catch(() => {});
      } else {
        this.emit('cycleSkipped', { reason: 'already_running', timestamp: new Date() });
      }
    }, intervalMs);

    this.emit('started', { intervalMs, intervalMinutes });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.isRunning = false;
      this.currentCycle = null;
      this.emit('stopped');
    }
  }

  // Manual check trigger
  async triggerCheck(domains = null) {
    if (this.isRunning) {
      throw new Error('Check already in progress');
    }

    const domainsToCheck = domains || this.storage.getDomains();
    if (domainsToCheck.length === 0) {
      throw new Error('No domains to check');
    }

    this.isRunning = true;
    try {
      await this.checker.checkAll(domainsToCheck);
    } finally {
      this.isRunning = false;
    }
  }

  // Check a single domain immediately
  async checkDomain(domainName) {
    const domains = this.storage.getDomains();
    const domain = domains.find(d => d.name.toLowerCase() === domainName.toLowerCase());
    
    if (!domain) {
      throw new Error(`Domain not found: ${domainName}`);
    }

    await this.checker.checkDomain(domain);
    return domain;
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasTimer: !!this.timer,
      currentCycle: this.currentCycle,
      domains: this.storage.getDomains().length,
      interval: this.storage.getSetting('checkInterval') || 5
    };
  }

  // Change interval on the fly
  setInterval(intervalMinutes) {
    const wasRunning = !!this.timer;
    if (wasRunning) {
      this.stop();
      this.start(intervalMinutes);
    }
    
    // Also update the stored setting
    this.storage.setSetting('checkInterval', intervalMinutes);
    this.emit('intervalChanged', { intervalMinutes, wasRunning });
  }
}

module.exports = Scheduler;