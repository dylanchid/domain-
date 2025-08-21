const blessed = require('blessed');

class ProgressIndicator {
  constructor() {
    this.progressBox = null;
    this.progressBar = null;
    this.isVisible = false;
  }

  show(parent, options = {}) {
    if (this.isVisible) return;

    const { title = 'Processing...', total = 100 } = options;

    // Create container
    this.progressBox = blessed.box({
      parent: parent,
      top: 'center',
      left: 'center',
      width: 60,
      height: 8,
      border: { type: 'line' },
      style: {
        border: { fg: 'cyan' },
        bg: 'black'
      },
      tags: true
    });

    // Title
    this.titleText = blessed.text({
      parent: this.progressBox,
      top: 1,
      left: 'center',
      content: title,
      style: { fg: 'white', bold: true }
    });

    // Progress bar
    this.progressBar = blessed.progressbar({
      parent: this.progressBox,
      top: 3,
      left: 2,
      right: 2,
      height: 1,
      style: {
        bar: { bg: 'cyan' },
        border: { fg: 'white' }
      },
      ch: '█',
      filled: 0
    });

    // Status text
    this.statusText = blessed.text({
      parent: this.progressBox,
      top: 5,
      left: 'center',
      content: '0%',
      style: { fg: 'white' }
    });

    this.isVisible = true;
    parent.render();
  }

  update(current, total, status = '') {
    if (!this.isVisible || !this.progressBar) return;

    const percentage = Math.round((current / total) * 100);
    this.progressBar.setProgress(percentage);
    
    const statusMessage = status ? 
      `${percentage}% - ${status}` : 
      `${percentage}% (${current}/${total})`;
    
    this.statusText.setContent(statusMessage);
    
    if (this.progressBox && this.progressBox.parent) {
      this.progressBox.parent.render();
    }
  }

  setStatus(message) {
    if (!this.isVisible || !this.statusText) return;
    this.statusText.setContent(message);
    if (this.progressBox && this.progressBox.parent) {
      this.progressBox.parent.render();
    }
  }

  hide() {
    if (!this.isVisible) return;

    if (this.progressBox) {
      this.progressBox.destroy();
      this.progressBox = null;
      this.progressBar = null;
      this.titleText = null;
      this.statusText = null;
    }

    this.isVisible = false;
  }

  isShowing() {
    return this.isVisible;
  }
}

module.exports = ProgressIndicator;
