const WebSocket = require('ws');

class DerivAPI {
  constructor(appId, apiToken) {
    this.appId = appId;
    this.apiToken = apiToken;
    this.ws = null;
    this.requestId = 1;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

      this.ws.on('open', () => {
        console.log('✅ Connected to Deriv API');
        
        // Authorize with API token
        this.authorize().then(() => {
          console.log('✅ Authorized successfully');
          resolve();
        }).catch(reject);
      });

      this.ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        
        // Handle callback for this request
        if (response.req_id && this.callbacks.has(response.req_id)) {
          const callback = this.callbacks.get(response.req_id);
          this.callbacks.delete(response.req_id);
          
          if (response.error) {
            callback.reject(response.error);
          } else {
            callback.resolve(response);
          }
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('⚠️  WebSocket closed');
      });
    });
  }

  authorize() {
    return this.send({
      authorize: this.apiToken
    });
  }

  send(request) {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      request.req_id = reqId;

      this.callbacks.set(reqId, { resolve, reject });
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Get the latest closed candle
   * @param {string} symbol - e.g., "R_100"
   * @param {number} granularity - in seconds (300 = 5 min)
   * @returns {Promise<Object>} Candle data
   */
  async getLatestCandle(symbol, granularity = 300) {
    const now = Math.floor(Date.now() / 1000);
    const candleCloseTime = Math.floor(now / granularity) * granularity - granularity;

    const response = await this.send({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 1,
      end: candleCloseTime,
      granularity: granularity,
      style: 'candles'
    });

    if (!response.candles || response.candles.length === 0) {
      throw new Error('No candle data received');
    }

    const candle = response.candles[0];
    
    return {
      epoch: candle.epoch,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      direction: parseFloat(candle.close) > parseFloat(candle.open) ? 'RISE' : 'FALL',
      timestamp: new Date(candle.epoch * 1000).toISOString()
    };
  }

  /**
   * Place a binary options trade
   * @param {string} symbol - e.g., "R_100"
   * @param {string} direction - "CALL" or "PUT"
   * @param {number} stake - Amount to stake
   * @param {number} duration - Duration in minutes
   * @returns {Promise<Object>} Trade result
   */
  async placeTrade(symbol, direction, stake, duration) {
    const contractType = direction === 'RISE' ? 'CALL' : 'PUT';
    
    const proposal = await this.send({
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: contractType,
      currency: 'USD',
      duration: duration,
      duration_unit: 'm',
      symbol: symbol
    });

    if (!proposal.proposal) {
      throw new Error('Failed to get proposal: ' + JSON.stringify(proposal));
    }

    console.log(`📊 Proposal: ${contractType} on ${symbol} for $${stake}, Duration: ${duration}min`);
    console.log(`   Expected payout: $${proposal.proposal.payout}`);

    // Buy the contract
    const buy = await this.send({
      buy: proposal.proposal.id,
      price: stake
    });

    if (!buy.buy) {
      throw new Error('Failed to buy contract: ' + JSON.stringify(buy));
    }

    return {
      contractId: buy.buy.contract_id,
      purchaseTime: buy.buy.purchase_time,
      buyPrice: buy.buy.buy_price,
      payout: buy.buy.payout,
      longcode: buy.buy.longcode
    };
  }

  /**
   * Get account balance
   */
  async getBalance() {
    const response = await this.send({
      balance: 1
    });

    return {
      balance: parseFloat(response.balance.balance),
      currency: response.balance.currency
    };
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = DerivAPI;
