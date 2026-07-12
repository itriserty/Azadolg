const EventEmitter = require('events');

class AchievementService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Safe asynchronous emit method that triggers all listeners,
   * catches errors, aggregates newly awarded badges, and returns them.
   * 
   * @param {string} eventName - Name of the event
   * @param {Object} data - Event payload
   * @returns {Promise<Array>} Newly awarded achievements
   */
  async emit(eventName, data = {}) {
    const resultsRef = [];
    const listeners = this.listeners(eventName);
    
    const promises = listeners.map(async (listener) => {
      try {
        await listener({ ...data, resultsRef });
      } catch (err) {
        console.error(`[AchievementService] Error in listener for "${eventName}":`, err);
      }
    });

    await Promise.all(promises);
    return resultsRef;
  }

  // trigger as an alias for backward compatibility
  async trigger(eventName, data) {
    return await this.emit(eventName, data);
  }

  async onKarmaChanged(userId) {
    return await this.emit('karma_changed', { userId });
  }
}

module.exports = new AchievementService();
