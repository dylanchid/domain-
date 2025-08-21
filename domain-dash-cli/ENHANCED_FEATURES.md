# Enhanced Features Documentation

This document describes the improved error handling, reliability features, and enhanced TUI experience implemented in Domain Dash CLI.

## 🛡️ Error Handling & Reliability Improvements

### 1. Retry Logic with Exponential Backoff

The system now includes sophisticated retry logic that automatically retries failed requests with exponential backoff:

- **Configurable retries**: Different retry counts for different providers
- **Smart error detection**: Only retries retryable errors (network issues, timeouts, 5xx errors)
- **Exponential backoff**: Gradually increases wait times between retries
- **Provider-specific tuning**: Each provider (RDAP, WHOIS, DNS) has optimized retry settings

```javascript
// Example: RDAP gets 2 retries with 500ms-5s backoff
// WHOIS gets 3 retries with 2s-10s backoff
// DNS gets 2 retries with 250ms-2s backoff
```

### 2. Enhanced Timeout Handling

Improved timeout management prevents hanging requests:

- **Per-provider timeouts**: Individual timeouts for RDAP (15s), WHOIS (15s), DNS (5s)
- **Overall check timeouts**: Maximum 45s per domain extension check
- **Graceful timeout handling**: Proper cleanup and error reporting on timeouts
- **AbortController integration**: Clean cancellation of network requests

### 3. Rate Limiting

Built-in rate limiting prevents being blocked by external services:

- **Provider-specific limits**: 
  - RDAP: 4 requests/second max, 20 requests/minute reservoir
  - WHOIS: 1 request/second max, 10 requests/minute reservoir  
  - DNS: 10 requests/second max, 50 requests/minute reservoir
- **Reservoir system**: Bucket-based rate limiting with automatic refill
- **Queue management**: Automatically queues excess requests
- **Backpressure handling**: Graceful handling when rate limits are hit

### 4. Graceful Degradation

The system continues functioning even when providers are unavailable:

- **Provider health monitoring**: Tracks success/failure rates for each provider
- **Automatic failover**: Unhealthy providers are temporarily disabled
- **Recovery detection**: Providers are automatically re-enabled when they recover
- **Fallback chains**: Uses remaining healthy providers when others fail

### 5. Enhanced Error Categorization

Better error classification and handling:

- **Retryable vs non-retryable errors**: Smart detection of which errors should trigger retries
- **Network error detection**: Identifies connection issues, timeouts, DNS failures
- **Service-specific errors**: Handles rate limiting, server errors, and malformed responses
- **Detailed error reporting**: Provides context and timing information for all errors

## 🎨 Enhanced TUI Experience

### 1. Real-time Domain Status Updates

The TUI now provides live updates without manual refresh:

- **Event-driven updates**: Real-time display updates as checks complete
- **Progress indicators**: Visual progress bars for bulk operations
- **Status animations**: Live status changes with color coding
- **Timestamp tracking**: Shows when each domain was last checked

### 2. Interactive Domain Management

Enhanced keyboard navigation and domain management:

- **Add domains**: Press 'a' to add new domains interactively
- **Remove domains**: Press 'd' to remove selected domains with confirmation
- **Edit domains**: Press 'e' to modify domain extensions
- **Bulk operations**: Select multiple domains for batch operations

### 3. Advanced Keyboard Navigation

Improved navigation and shortcuts:

```
q/Ctrl+C  - Quit application
r         - Refresh all domains now
F5        - Force refresh with provider health reset
Enter     - Toggle detailed view for selected domain
/         - Search/filter domains
Tab       - Cycle through status filters (all/available/unavailable/errors)
a         - Add new domain
d/Delete  - Remove selected domain
e         - Edit selected domain
Escape    - Close detail pane or clear search
↑/↓       - Navigate domain list
Space     - Select/deselect domain
```

### 4. Status Filtering and Search

Advanced filtering capabilities:

- **Status filters**: View all, available, unavailable, checking, or error domains
- **Search functionality**: Filter domains by name with live search
- **Combined filtering**: Use search and status filters together
- **Visual indicators**: Clear indication of active filters

### 5. Detailed Domain View

Enhanced detail pane with comprehensive information:

- **Extension-by-extension breakdown**: See status for each TLD
- **Provider performance**: Success rates and response times per provider
- **Error details**: Full error messages and retry information
- **Timing information**: Response times and check timestamps
- **Historical data**: Previous check results and status changes

### 6. Progress Indicators

Visual feedback for long-running operations:

- **Bulk check progress**: Real-time progress bars during domain checks
- **Domain counting**: Shows completed vs total domains
- **Status messages**: Current operation being performed
- **Time estimates**: Expected completion times for bulk operations

### 7. Provider Health Display

Real-time monitoring of external service health:

- **Health indicators**: Green/yellow/red status for each provider
- **Failure tracking**: Shows consecutive failure counts
- **Recovery status**: Indicates when providers recover from issues
- **Performance metrics**: Average response times per provider

## 🚀 Usage Examples

### Running the Enhanced Demo

```bash
npm run demo
```

This demonstrates all enhanced features with real domain checks.

### Starting the Enhanced TUI

```bash
npm start
```

### CLI Commands with Enhanced Error Handling

All existing CLI commands now benefit from the enhanced error handling:

```bash
# Add domain with automatic retry logic
./bin/domain- add mysite

# Check with enhanced provider failover
./bin/domain- check mysite

# List with detailed status information
./bin/domain- list
```

## 🔧 Configuration Options

### Checker Configuration

```javascript
const checker = new Checker(storage, {
  concurrency: 4,                    // Parallel domain checks
  enableGracefulDegradation: true,   // Enable provider failover
  providerTimeoutMs: 15000,          // Per-provider timeout
  checkTimeoutMs: 45000,             // Overall check timeout
  maxConsecutiveFailures: 5,         // Failures before marking unhealthy
  healthCheckInterval: 300000        // Provider health check interval
});
```

### Rate Limiter Settings

The rate limiter can be configured per provider:

```javascript
// RDAP: Conservative to avoid blocks
maxConcurrent: 2,
minTime: 250,         // 4 requests/second max
reservoir: 20,        // Burst capacity
reservoirRefreshInterval: 60000

// WHOIS: Very conservative due to aggressive rate limiting
maxConcurrent: 1,
minTime: 1000,        // 1 request/second max
reservoir: 10,
reservoirRefreshInterval: 60000

// DNS: More aggressive as DNS is typically reliable
maxConcurrent: 5,
minTime: 100,         // 10 requests/second max
reservoir: 50,
reservoirRefreshInterval: 60000
```

## 📊 Monitoring and Metrics

### Provider Health Metrics

- **Success rate**: Percentage of successful requests
- **Average response time**: Mean response time in milliseconds
- **Failure count**: Consecutive failures (resets on success)
- **Last success timestamp**: When the provider last worked
- **Health status**: Boolean indicating if provider is considered healthy

### Domain Check Metrics

- **Total duration**: Time to check all extensions for a domain
- **Per-extension timing**: Individual check times
- **Error categorization**: Types and counts of errors encountered
- **Retry statistics**: Number of retries attempted per check

### System Performance

- **Concurrent operations**: Number of simultaneous checks
- **Queue depth**: Pending operations per provider
- **Rate limiting status**: Current reservoir levels and queue sizes
- **Memory usage**: Storage size and history length

## 🎯 Best Practices

### For Reliability

1. **Monitor provider health**: Watch for degraded services
2. **Use appropriate intervals**: Don't check too frequently
3. **Handle failures gracefully**: Expect and plan for service outages
4. **Log important events**: Keep history for debugging

### For Performance

1. **Tune concurrency**: Balance speed vs resource usage
2. **Monitor rate limits**: Stay within service limits
3. **Use appropriate timeouts**: Long enough for slow networks, short enough to detect failures
4. **Clean up resources**: Properly stop services when done

### For User Experience

1. **Provide feedback**: Show progress and status information
2. **Handle errors gracefully**: Don't crash on individual failures
3. **Save state**: Persist data across restarts
4. **Responsive design**: Keep UI responsive during long operations

## 🐛 Troubleshooting

### Common Issues

**Provider consistently failing**
- Check internet connection
- Verify provider service status
- Review rate limiting settings
- Check for IP blocks

**Slow performance**
- Reduce concurrency
- Increase timeouts
- Check provider response times
- Monitor system resources

**Memory usage growing**
- Clear history periodically
- Reduce stored detail level
- Check for memory leaks in providers

**TUI rendering issues**
- Check terminal compatibility
- Update dependencies
- Verify screen dimensions
- Check color support

### Debug Information

Enable detailed logging by setting environment variables:

```bash
DEBUG=domain-dash:* npm start
NODE_ENV=development npm start
```

This provides detailed information about:
- Provider requests and responses
- Rate limiting decisions
- Retry attempts and backoff
- Error categorization
- Performance metrics
