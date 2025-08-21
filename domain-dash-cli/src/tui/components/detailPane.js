const blessed = require('blessed');

class DetailPane {
  constructor() {
    this.content = null;
  }

  render(container, domain) {
    if (!domain) {
      container.setContent('{center}Select a domain to see details{/center}');
      return;
    }

    const extensions = domain.extensions || [];
    const results = domain.results || {};
    
    // Build detailed information
    let content = `{bold}${domain.name}{/bold}\n\n`;
    
    // Basic info
    content += `Added: ${domain.addedAt || 'Unknown'}\n`;
    content += `Last Checked: ${domain.lastChecked || 'Never'}\n`;
    content += `Extensions: ${extensions.length}\n\n`;
    
    // Extension details
    content += `{bold}Extension Status:{/bold}\n`;
    extensions.forEach(ext => {
      const result = results[ext];
      if (!result) {
        content += `${ext}: {yellow-fg}Not checked{/yellow-fg}\n`;
        return;
      }

      let status;
      if (result.available === true) {
        status = '{green-fg}Available{/green-fg}';
      } else if (result.available === false) {
        status = '{red-fg}Registered{/red-fg}';
      } else {
        status = '{yellow-fg}Unknown{/yellow-fg}';
      }

      content += `${ext}: ${status}`;
      
      if (result.via) {
        content += ` (${result.via})`;
      }
      
      if (result.duration) {
        content += ` [${result.duration}ms]`;
      }
      
      content += '\n';
      
      // Additional details
      if (result.error) {
        content += `    {red-fg}Error: ${result.error}{/red-fg}\n`;
      }
      
      if (result.warning) {
        content += `    {yellow-fg}Warning: ${result.warning}{/yellow-fg}\n`;
      }
      
      if (result.degraded) {
        content += `    {yellow-fg}Service degraded{/yellow-fg}\n`;
      }
      
      if (result.details) {
        if (result.details.status) {
          content += `    Status: ${result.details.status}\n`;
        }
        if (result.details.registrar) {
          content += `    Registrar: ${result.details.registrar}\n`;
        }
        if (result.details.created) {
          content += `    Created: ${result.details.created}\n`;
        }
        if (result.details.expires) {
          content += `    Expires: ${result.details.expires}\n`;
        }
        if (result.details.recordTypes) {
          content += `    DNS Records: ${result.details.recordTypes}\n`;
        }
      }
      
      if (result.timestamp) {
        const time = new Date(result.timestamp).toLocaleString();
        content += `    Checked: ${time}\n`;
      }
      
      content += '\n';
    });

    // Summary statistics
    const available = extensions.filter(ext => results[ext]?.available === true).length;
    const registered = extensions.filter(ext => results[ext]?.available === false).length;
    const errors = extensions.filter(ext => results[ext]?.error).length;
    const unknown = extensions.length - available - registered;

    content += `{bold}Summary:{/bold}\n`;
    content += `Available: {green-fg}${available}{/green-fg}\n`;
    content += `Registered: {red-fg}${registered}{/red-fg}\n`;
    content += `Unknown: {yellow-fg}${unknown}{/yellow-fg}\n`;
    if (errors > 0) {
      content += `Errors: {red-fg}${errors}{/red-fg}\n`;
    }

    // Provider health for this domain's recent checks
    const recentResults = Object.values(results).filter(r => r.timestamp);
    if (recentResults.length > 0) {
      content += '\n{bold}Recent Provider Performance:{/bold}\n';
      const providers = [...new Set(recentResults.map(r => r.via).filter(Boolean))];
      providers.forEach(provider => {
        const providerResults = recentResults.filter(r => r.via === provider);
        const successes = providerResults.filter(r => !r.error).length;
        const total = providerResults.length;
        const avgDuration = providerResults
          .filter(r => r.duration)
          .reduce((sum, r) => sum + r.duration, 0) / providerResults.filter(r => r.duration).length;
        
        const successRate = Math.round((successes / total) * 100);
        const avgTime = Math.round(avgDuration) || 0;
        
        let healthColor = 'green-fg';
        if (successRate < 70) healthColor = 'red-fg';
        else if (successRate < 90) healthColor = 'yellow-fg';
        
        content += `${provider}: {${healthColor}}${successRate}%{/${healthColor}} (${avgTime}ms avg)\n`;
      });
    }

    container.setContent(content);
  }
}

module.exports = DetailPane;