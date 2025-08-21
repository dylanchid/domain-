const notifier = require('node-notifier');

class Notifications {
  constructor(storage) {
    this.storage = storage;
    this.enabled = storage ? storage.getSetting('notifications') !== false : true;
    this.sent = new Set();
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  available({ domain, extension, fqdn }) {
    if (!this.enabled) return;
    const key = `${domain}${extension}`;
    if (this.sent.has(key)) return;
    this.sent.add(key);

    notifier.notify({
      title: 'Domain available',
      message: `${fqdn} is available`,
      sound: true,
      wait: false
    });
  }
}

module.exports = Notifications;