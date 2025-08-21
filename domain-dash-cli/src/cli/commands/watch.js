const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Storage = require('../../services/storage');
const Checker = require('../../services/checker');
const Scheduler = require('../../services/scheduler');
const Notifications = require('../../services/notifications');

module.exports = async function watch(argv = {}) {
  // Daemonize path: prefer pm2 if requested or available; otherwise suggest launchd on macOS
  if (argv.daemon) {
    const manager = typeof argv.daemon === 'string' ? argv.daemon : 'pm2';
    const repoRoot = path.resolve(__dirname, '../../../');
    const binPath = path.resolve(repoRoot, 'bin/domain-');
    const ecosystemPath = path.resolve(repoRoot, 'pm2.ecosystem.config.js');

    if (manager === 'pm2') {
      try {
        // Validate pm2 exists
        execSync('pm2 -v', { stdio: 'ignore' });
      } catch {
        console.error('pm2 is not installed. Install with: npm i -g pm2');
        // Fall back to launchd instructions on macOS
        if (process.platform === 'darwin') {
          printLaunchdInstructions(repoRoot, binPath);
        }
        return;
      }
      // Use ecosystem file if present; else start directly
      try {
        if (fs.existsSync(ecosystemPath)) {
          execSync(`pm2 start ${ecosystemPath}`, { stdio: 'inherit' });
        } else {
          execSync(`pm2 start ${binPath} -- watch`, { stdio: 'inherit' });
        }
        // Save and optionally setup startup
        try {
          execSync('pm2 save', { stdio: 'inherit' });
        } catch {}
        console.log('\nDaemon started with pm2. To enable on boot, optionally run: pm2 startup');
      } catch (err) {
        console.error('Failed to start with pm2:', err?.message || err);
      }
      return;
    }

    if (manager === 'launchd' || process.platform === 'darwin') {
      printLaunchdInstructions(repoRoot, binPath);
      return;
    }

    console.error('Unsupported daemon manager. Use "pm2" or "launchd".');
    return;
  }

  const storage = new Storage();
  const domains = storage.getDomains();
  if (domains.length === 0) {
    console.log('No domains to watch. Please add domains first.');
    return;
  }

  const checker = new Checker(storage, { concurrency: argv.concurrency || 4 });
  const scheduler = new Scheduler(checker, storage);
  const notifications = new Notifications(storage);

  if (typeof argv.notifications === 'boolean') {
    notifications.setEnabled(argv.notifications);
  }

  scheduler.on('available', info => notifications.available(info));

  const interval = argv.interval || storage.getSetting('checkInterval') || 5;
  console.log(`Watching ${domains.length} domains every ${interval} minutes...`);
  scheduler.start(interval);

  // Keep process alive until SIGINT
  process.on('SIGINT', () => {
    scheduler.stop();
    process.exit(0);
  });
};

function printLaunchdInstructions(repoRoot, binPath) {
  const label = 'com.domain-.cli';
  const userLaunchAgents = path.join(os.homedir(), 'Library/LaunchAgents');
  const plistDest = path.join(userLaunchAgents, `${label}.plist`);

  const nodePath = process.execPath; // current node path
  const plistExamplePath = path.join(repoRoot, 'launchd', 'domain-.plist');

  console.log('macOS launchd setup instructions:\n');
  if (fs.existsSync(plistExamplePath)) {
    console.log(`1) Copy plist: cp ${plistExamplePath} ${plistDest}`);
  } else {
    console.log('1) Create a plist at: ' + plistDest);
    console.log('   Use this template (update paths accordingly):');
    console.log(`   Label: ${label}`);
    console.log(`   ProgramArguments: ["${nodePath}", "${binPath}", "watch"]`);
  }
  console.log(`2) Ensure paths are correct:\n   - node: ${nodePath}\n   - script: ${binPath}`);
  console.log(`3) Load it: launchctl load ${plistDest}`);
  console.log('4) To unload: launchctl unload ' + plistDest);
}