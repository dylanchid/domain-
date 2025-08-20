const notifier = require('node-notifier');
const path = require('path');

class Notifier {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.sound = options.sound !== false;
    this.iconPath = options.iconPath || this.getDefaultIcon();
    this.appName = options.appName || 'Domain Dashboard';
  }

  getDefaultIcon() {
    // Try to use a default system icon
    const os = require('os');
    const platform = os.platform();
    
    if (platform === 'darwin') {
      return '/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericNetworkIcon.icns';
    } else if (platform === 'win32') {
      return path.join(__dirname, '../assets/icons/win/icon.ico');
    } else {
      return path.join(__dirname, '../assets/icons/linux/icon.png');
    }
  }

  notify(title, message) {
    if (!this.enabled) return;

    notifier.notify({
      title: title,
      message: message,
      icon: this.iconPath,
      sound: this.sound,
      appName: this.appName
    });
  }
}

module.exports = Notifier;

// Notification handli