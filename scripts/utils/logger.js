const fs = require('fs');
const path = require('path');

class Logger {
  constructor(scriptName) {
    this.scriptName = scriptName;
    this.logDir = path.join(__dirname, '../../logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logFile = path.join(this.logDir, `${scriptName}-${this.getDateString()}.log`);
    this.stats = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    console.log(logMessage);
    
    // Write to file
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  info(message) {
    this.log(message, 'info');
  }

  success(message) {
    this.log(`✅ ${message}`, 'success');
  }

  error(message, error = null) {
    const errorMsg = error ? `${message}: ${error.message}` : message;
    this.log(`❌ ${errorMsg}`, 'error');
    this.stats.errors++;
  }

  warn(message) {
    this.log(`⚠️  ${message}`, 'warn');
  }

  incrementStat(stat) {
    if (this.stats.hasOwnProperty(stat)) {
      this.stats[stat]++;
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 EXECUTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Processed: ${this.stats.processed}`);
    console.log(`Created:   ${this.stats.created}`);
    console.log(`Updated:   ${this.stats.updated}`);
    console.log(`Skipped:   ${this.stats.skipped}`);
    console.log(`Errors:    ${this.stats.errors}`);
    console.log('='.repeat(50) + '\n');
    
    this.log('Execution summary: ' + JSON.stringify(this.stats));
  }
}

module.exports = { Logger };
