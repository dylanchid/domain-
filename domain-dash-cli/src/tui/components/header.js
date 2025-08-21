const chalk = require('chalk');

const header = () => {
  console.log(chalk.blue.bold('=============================='));
  console.log(chalk.blue.bold('   Domain Availability Dashboard   '));
  console.log(chalk.blue.bold('=============================='));
  console.log(chalk.green('Monitor your domains and check their availability in real-time.'));
  console.log(chalk.yellow('Use the commands to manage your domain list.'));
  console.log(chalk.blue.bold('=============================='));
};

module.exports = header;