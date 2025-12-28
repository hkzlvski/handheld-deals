const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class RateLimiter {
  constructor(delayMs = 1000, maxRetries = 3) {
    this.delayMs = delayMs;
    this.maxRetries = maxRetries;
    this.lastRequestTime = 0;
  }

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.delayMs) {
      const waitTime = this.delayMs - timeSinceLastRequest;
      await sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }

  async executeWithRetry(fn, context = 'Request') {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.throttle();
        return await fn();
      } catch (error) {
        if (attempt === this.maxRetries) {
          console.error(`❌ ${context} failed after ${this.maxRetries} attempts`);
          throw error;
        }
        
        const backoffDelay = this.delayMs * Math.pow(2, attempt - 1);
        console.log(`⚠️  ${context} failed (attempt ${attempt}/${this.maxRetries}), retrying in ${backoffDelay}ms...`);
        await sleep(backoffDelay);
      }
    }
  }
}

module.exports = { RateLimiter, sleep };
