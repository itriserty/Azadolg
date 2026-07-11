const EventEmitter = require('events');
const { checkAndAward } = require('../utils/achievementHelper');

class AchievementService extends EventEmitter {
  constructor() {
    super();
    
    this.on('debt_created', async ({ creditorId, debtorId, resultsRef }) => {
      try {
        const newlyAwarded = [];
        const r1 = await checkAndAward(debtorId, 'active_debts_count');
        if (r1) newlyAwarded.push(...r1);
        
        if (creditorId.toString() === debtorId.toString()) {
          const r2 = await checkAndAward(creditorId, 'self_borrow');
          if (r2) newlyAwarded.push(...r2);
        }
        
        resultsRef.push(...newlyAwarded);
      } catch (err) {
        console.error('[AchievementService] Error on debt_created:', err);
      }
    });

    this.on('debt_paid', async ({ debtorId, creditorId, isOverdue, resultsRef }) => {
      try {
        const newlyAwarded = [];
        const r1 = await checkAndAward(debtorId, 'debts_paid_count');
        if (r1) newlyAwarded.push(...r1);
        
        const r2 = await checkAndAward(debtorId, 'empty_promises');
        if (r2) newlyAwarded.push(...r2);
        
        resultsRef.push(...newlyAwarded);
      } catch (err) {
        console.error('[AchievementService] Error on debt_paid:', err);
      }
    });

    this.on('debt_forgiven', async ({ creditorId, resultsRef }) => {
      try {
        const r = await checkAndAward(creditorId, 'forgiven_count');
        if (r) resultsRef.push(...r);
      } catch (err) {
        console.error('[AchievementService] Error on debt_forgiven:', err);
      }
    });

    this.on('jackpot_won', async ({ winnerId, resultsRef }) => {
      try {
        const r = await checkAndAward(winnerId, 'jackpot_winner');
        if (r && resultsRef) resultsRef.push(...r);
      } catch (err) {
        console.error('[AchievementService] Error on jackpot_won:', err);
      }
    });

    this.on('karma_changed', async ({ userId, resultsRef }) => {
      try {
        const r = await checkAndAward(userId, 'negative_karma');
        if (r && resultsRef) resultsRef.push(...r);
      } catch (err) {
        console.error('[AchievementService] Error on karma_changed:', err);
      }
    });

    this.on('witness_decision', async ({ witnessId, resultsRef }) => {
      try {
        const r = await checkAndAward(witnessId, 'witnesses_count');
        if (r && resultsRef) resultsRef.push(...r);
      } catch (err) {
        console.error('[AchievementService] Error on witness_decision:', err);
      }
    });

    this.on('declined_loan', async ({ debtorId, resultsRef }) => {
      try {
        const r = await checkAndAward(debtorId, 'declined_loan_streak');
        if (r && resultsRef) resultsRef.push(...r);
      } catch (err) {
        console.error('[AchievementService] Error on declined_loan:', err);
      }
    });
  }

  async trigger(eventName, data) {
    const resultsRef = [];
    const promises = [];
    this.listeners(eventName).forEach(listener => {
      const p = listener({ ...data, resultsRef });
      promises.push(p);
    });
    await Promise.all(promises);
    return resultsRef;
  }

  async onKarmaChanged(userId) {
    return await this.trigger('karma_changed', { userId });
  }
}

module.exports = new AchievementService();
