#!/usr/bin/env node

const Storage = require('../src/services/storage');
const Checker = require('../src/services/checker');
const chalk = require('chalk');

async function demo() {
  console.log(chalk.blue.bold('🚀 Domain Dash Enhanced Features Demo\n'));

  // Initialize services
  console.log(chalk.cyan('Initializing enhanced services...'));
  const storage = new Storage();
  
  // Clear any existing data for demo
  storage.clearAll();
  
  const checker = new Checker(storage, {
    concurrency: 3,
    enableGracefulDegradation: true,
    providerTimeoutMs: 8000,
    checkTimeoutMs: 20000
  });

  // Add some test domains
  console.log(chalk.cyan('\nAdding test domains...'));
  const testDomains = [
    { name: 'google', extensions: ['.com', '.org'] },
    { name: 'github', extensions: ['.com', '.io'] },
    { name: 'nonexistentdomain12345xyz', extensions: ['.com', '.net'] }
  ];

  testDomains.forEach(domain => {
    storage.addDomain(domain);
    console.log(`  ✓ Added ${domain.name} with extensions: ${domain.extensions.join(', ')}`);
  });

  // Set up event listeners to show real-time updates
  console.log(chalk.cyan('\nSetting up real-time monitoring...'));
  
  checker.on('cycleStarted', (data) => {
    console.log(chalk.yellow(`\n🔄 Starting check cycle for ${data.domains} domains...`));
  });

  checker.on('updated', (domain) => {
    console.log(chalk.green(`  ✓ Updated: ${domain.name}`));
    
    // Show detailed results
    Object.entries(domain.results || {}).forEach(([ext, result]) => {
      let status = '?';
      let color = chalk.gray;
      
      if (result.available === true) {
        status = '✓ Available';
        color = chalk.green;
      } else if (result.available === false) {
        status = '✗ Registered';
        color = chalk.red;
      } else if (result.error) {
        status = `⚠ Error: ${result.error}`;
        color = chalk.yellow;
      }
      
      const timing = result.duration ? ` (${result.duration}ms)` : '';
      const provider = result.via ? ` via ${result.via}` : '';
      
      console.log(`    ${ext}: ${color(status)}${timing}${provider}`);
    });
  });

  checker.on('available', (data) => {
    console.log(chalk.green.bold(`\n🎉 DOMAIN AVAILABLE: ${data.fqdn} via ${data.via}`));
  });

  checker.on('providerUnhealthy', (data) => {
    console.log(chalk.red(`\n⚠️  Provider ${data.provider} marked as unhealthy (${data.health.failures} failures)`));
  });

  checker.on('providerRecovered', (data) => {
    console.log(chalk.green(`\n✅ Provider ${data.provider} recovered`));
  });

  checker.on('cycleComplete', (data) => {
    const duration = data.duration ? ` in ${data.duration}ms` : '';
    console.log(chalk.blue(`\n✅ Check cycle complete${duration}`));
  });

  // Show provider health before starting
  console.log(chalk.cyan('\nProvider Health Status:'));
  const healthBefore = checker.getProviderHealth();
  Object.entries(healthBefore).forEach(([provider, health]) => {
    const status = health.isHealthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy');
    console.log(`  ${provider}: ${status} (${health.failures} failures)`);
  });

  // Start checking
  console.log(chalk.cyan('\n🔍 Starting enhanced domain checks with retry logic and rate limiting...'));
  
  try {
    await checker.checkAll();
    
    // Show final statistics
    console.log(chalk.cyan('\n📊 Final Statistics:'));
    const domains = storage.getDomains();
    
    domains.forEach(domain => {
      console.log(chalk.white.bold(`\n${domain.name}:`));
      
      let available = 0, registered = 0, errors = 0, unknown = 0;
      
      Object.entries(domain.results || {}).forEach(([ext, result]) => {
        if (result.available === true) available++;
        else if (result.available === false) registered++;
        else if (result.error) errors++;
        else unknown++;
      });
      
      console.log(`  Available: ${chalk.green(available)}`);
      console.log(`  Registered: ${chalk.red(registered)}`);
      console.log(`  Errors: ${chalk.yellow(errors)}`);
      console.log(`  Unknown: ${chalk.gray(unknown)}`);
    });

    // Show provider health after checking
    console.log(chalk.cyan('\nProvider Health After Checks:'));
    const healthAfter = checker.getProviderHealth();
    Object.entries(healthAfter).forEach(([provider, health]) => {
      const status = health.isHealthy ? chalk.green('✓ Healthy') : chalk.red('✗ Unhealthy');
      const lastSuccess = health.lastSuccess ? new Date(health.lastSuccess).toLocaleTimeString() : 'Never';
      console.log(`  ${provider}: ${status} (${health.failures} failures, last success: ${lastSuccess})`);
    });

    // Show enhanced error handling info
    console.log(chalk.cyan('\n🛡️  Enhanced Features Demonstrated:'));
    console.log('  ✓ Retry logic with exponential backoff');
    console.log('  ✓ Rate limiting to prevent service blocks');
    console.log('  ✓ Graceful degradation when providers fail');
    console.log('  ✓ Provider health monitoring');
    console.log('  ✓ Enhanced timeout handling');
    console.log('  ✓ Real-time progress updates');
    console.log('  ✓ Detailed error categorization');
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Demo failed: ${error.message}`));
  } finally {
    checker.destroy();
  }

  console.log(chalk.blue.bold('\n🎯 Demo completed! Try the TUI with: npm start\n'));
}

// Run demo
if (require.main === module) {
  demo().catch(console.error);
}

module.exports = demo;
