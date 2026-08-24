const config = require('../config/ai');

class AIRateLimiter {
  constructor() {
    this.minuteRequests = 0;
    this.dayRequests = 0;
    this.lastMinuteReset = Date.now();
    this.lastDayReset = Date.now();
  }

  _checkResets() {
    const now = Date.now();
    if (now - this.lastMinuteReset >= 60000) {
      this.minuteRequests = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastDayReset >= 86400000) {
      this.dayRequests = 0;
      this.lastDayReset = now;
    }
  }

  canUseFreeTier() {
    this._checkResets();
    return (
      this.minuteRequests < config.freeRateLimits.maxPerMinute &&
      this.dayRequests < config.freeRateLimits.maxPerDay
    );
  }

  recordFreeRequest() {
    this._checkResets();
    this.minuteRequests += 1;
    this.dayRequests += 1;
  }
}

module.exports = new AIRateLimiter();
