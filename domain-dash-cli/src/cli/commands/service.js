const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_NAME = 'domain-';

function getPaths() {
  const repoRoot = path.resolve(__dirname, '../../../');
  const binPath = path.resolve(repoRoot, 'bin/domain-');
  const ecosystemPath = path.resolve(repoRoot, 'pm2.ecosystem.config.js');
  const plistExample = path.resolve(repoRoot, 'launchd/domain-.plist');
  const userLaunchAgents = path.join(os.homedir(), 'Library/LaunchAgents');
  const label = 'com.domain-.cli';
  const plistDest = path.join(userLaunchAgents, `${label}.plist`);
  return { repoRoot, binPath, ecosystemPath, plistExample, label, plistDest };
}

function ensurePm2() {
  try {
    execSync('pm2 -v', { stdio: 'ignore' });
    return true;
  } catch {
    console.error('pm2 is not installed. Install with: npm i -g pm2');
    return false;
  }
}

function pm2Start({ startup } = {}) {
  const { ecosystemPath, binPath } = getPaths();
  if (!ensurePm2()) return;
  try {
    if (fs.existsSync(ecosystemPath)) {
      execSync(`pm2 start ${ecosystemPath}`, { stdio: 'inherit' });
    } else {
      execSync(`pm2 start ${binPath} -- watch`, { stdio: 'inherit' });
    }
    execSync('pm2 save', { stdio: 'inherit' });
    if (startup) {
      try {
        execSync('pm2 startup', { stdio: 'inherit' });
      } catch {}
    }
    console.log('Service started via pm2.');
  } catch (err) {
    console.error('Failed to start via pm2:', err?.message || err);
  }
}

function pm2Stop() {
  if (!ensurePm2()) return;
  try {
    execSync(`pm2 delete ${APP_NAME}`, { stdio: 'inherit' });
  } catch {
    // Try by script
    try {
      const { binPath } = getPaths();
      execSync(`pm2 delete ${binPath}`, { stdio: 'inherit' });
    } catch (err) {
      console.error('Failed to stop via pm2:', err?.message || err);
    }
  }
}

function pm2Status() {
  if (!ensurePm2()) return;
  try {
    execSync('pm2 ls', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to get pm2 status:', err?.message || err);
  }
}

function pm2Logs({ follow, lines } = {}) {
  if (!ensurePm2()) return;
  const args = ['logs', APP_NAME];
  if (lines) args.push('--lines', String(lines));
  const proc = spawn('pm2', args, { stdio: 'inherit' });
  if (!follow) {
    proc.on('spawn', () => setTimeout(() => proc.kill('SIGINT'), 500));
  }
}

function launchdHints({ startup } = {}) {
  const { plistExample, plistDest } = getPaths();
  console.log('macOS launchd setup:');
  console.log(`- Copy plist: cp ${plistExample} ${plistDest}`);
  console.log(`- Edit paths in ${plistDest} if needed.`);
  console.log(`- Load: launchctl load ${plistDest}`);
  console.log(`- Unload: launchctl unload ${plistDest}`);
  if (startup) {
    console.log('- To keep alive on boot, ensure KeepAlive=true in the plist.');
  }
}

function launchdStop() {
  const { plistDest } = getPaths();
  console.log(`Unload: launchctl unload ${plistDest}`);
}

function launchdStatus() {
  const { label } = getPaths();
  try {
    execSync(`launchctl list | grep ${label} | cat`, { stdio: 'inherit', shell: '/bin/zsh' });
  } catch {}
}

function start(opts = {}) {
  const manager = (opts.manager || 'pm2').toLowerCase();
  if (manager === 'pm2') return pm2Start({ startup: opts.startup });
  if (manager === 'launchd') return launchdHints({ startup: opts.startup });
  console.error('Unsupported manager. Use pm2 or launchd.');
}

function stop(opts = {}) {
  const manager = (opts.manager || 'pm2').toLowerCase();
  if (manager === 'pm2') return pm2Stop();
  if (manager === 'launchd') return launchdStop();
  console.error('Unsupported manager. Use pm2 or launchd.');
}

function status(opts = {}) {
  const manager = (opts.manager || 'pm2').toLowerCase();
  if (manager === 'pm2') return pm2Status();
  if (manager === 'launchd') return launchdStatus();
  console.error('Unsupported manager. Use pm2 or launchd.');
}

function logs(opts = {}) {
  const manager = (opts.manager || 'pm2').toLowerCase();
  if (manager === 'pm2') return pm2Logs({ follow: opts.follow, lines: opts.lines });
  if (manager === 'launchd') {
    console.log('For launchd, check logs with: log stream --predicate "process == \'node\'" or use a custom log path in plist.');
    return;
  }
  console.error('Unsupported manager. Use pm2 or launchd.');
}

module.exports = { start, stop, status, logs };
