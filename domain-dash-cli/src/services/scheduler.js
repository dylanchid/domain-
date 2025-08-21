const EventEmitter = require('events');

class Scheduler extends EventEmitter {
  constructor(checker, storage) {
    super();
    this.checker = checker;
    this.storage = storage;
    this.timer = null;

    // Forward checker events
    checker.on('available', payload => this.emit('available', payload));
    checker.on('updated', domain => this.emit('updated', domain));
    checker.on('cycleComplete', ts => this.emit('cycleComplete', ts));
  }

  start(intervalMinutes) {
    this.stop();
    const intervalMs = Math.max(1, Number(intervalMinutes || this.storage.getSetting('checkInterval') || 5)) * 60_000;

    const run = async () => {
      const domains = this.storage.getDomains();
      if (!domains.length) return;
      await this.checker.checkAll(domains);
    };

    // initial run then interval
    run().catch(() => {});
    this.timer = setInterval(() => {
      run().catch(() => {});
    }, intervalMs);

    this.emit('started', { intervalMs });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.emit('stopped');
    }
  }
}

module.exports = Scheduler;