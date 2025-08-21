const Storage = require('../../services/storage');
const Checker = require('../../services/checker');

async function checkDomains(argv = {}) {
  const storage = new Storage();
  const domains = storage.getDomains();

  if (domains.length === 0) {
    console.log('No domains to check.');
    return;
  }

  const checker = new Checker(storage, { 
    concurrency: argv.concurrency || 4,
    enableGracefulDegradation: true
  });
  
  console.log(`Checking ${domains.length} domains...`);
  await checker.checkAll(domains);

  // Print a concise summary
  const updated = storage.getDomains();
  updated.forEach(d => {
    const exts = d.extensions || [];
    const statuses = exts.map(ext => `${ext}:${d.results?.[ext]?.available === true ? 'available' : d.results?.[ext]?.available === false ? 'taken' : 'pending'}`).join(' ');
    console.log(`${d.name} -> ${statuses}`);
  });
  
  checker.destroy();
}

function checkCommand(program) {
  program
    .command('check [domain]')
    .description('Check domain availability (all domains if none specified)')
    .option('-c, --concurrency <number>', 'Number of concurrent checks', '4')
    .action(async (domain, options) => {
      if (domain) {
        // Check specific domain
        const storage = new Storage();
        const domains = storage.getDomains();
        const targetDomain = domains.find(d => d.name.toLowerCase() === domain.toLowerCase());
        
        if (!targetDomain) {
          console.error(`Domain "${domain}" not found in monitoring list.`);
          return;
        }
        
        const checker = new Checker(storage, { 
          concurrency: 1,
          enableGracefulDegradation: true
        });
        
        console.log(`Checking ${domain}...`);
        await checker.checkDomain(targetDomain);
        
        const updated = storage.getDomains().find(d => d.name === targetDomain.name);
        const exts = updated.extensions || [];
        const statuses = exts.map(ext => `${ext}:${updated.results?.[ext]?.available === true ? 'available' : updated.results?.[ext]?.available === false ? 'taken' : 'pending'}`).join(' ');
        console.log(`${updated.name} -> ${statuses}`);
        
        checker.destroy();
      } else {
        // Check all domains
        await checkDomains({ concurrency: parseInt(options.concurrency) });
      }
    });
}

module.exports = { checkCommand, checkDomains };