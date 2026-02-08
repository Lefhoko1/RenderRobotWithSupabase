require('dotenv').config();
const http = require('http');
const DerivAPI = require('./derivAPI');

// Configuration
const CONFIG = {
  APP_ID: process.env.DERIV_APP_ID || '1089',
  API_TOKEN: process.env.DERIV_API_TOKEN,
  SYMBOL: process.env.SYMBOL || 'R_100',
  TIMEFRAME: parseInt(process.env.TIMEFRAME) || 300, // 5 minutes in seconds
  STAKE: parseFloat(process.env.STAKE) || 1.0,
  DURATION: parseInt(process.env.DURATION) || 5, // Trade duration in minutes
  PORT: process.env.PORT || 3000
};

class BinaryOptionsBot {
  constructor() {
    this.api = null;
    this.isRunning = false;
    this.stats = {
      totalTrades: 0,
      successfulFetches: 0,
      failedFetches: 0,
      lastCandle: null,
      lastTrade: null,
      startTime: new Date()
    };
  }

  async start() {
    console.log('🚀 Binary Options Test Bot Starting...');
    console.log('⚙️  Configuration:');
    console.log(`   Symbol: ${CONFIG.SYMBOL}`);
    console.log(`   Timeframe: ${CONFIG.TIMEFRAME}s (${CONFIG.TIMEFRAME / 60} minutes)`);
    console.log(`   Stake: $${CONFIG.STAKE}`);
    console.log(`   Duration: ${CONFIG.DURATION} minutes`);
    console.log('');

    // Validate API token
    if (!CONFIG.API_TOKEN) {
      console.error('❌ ERROR: DERIV_API_TOKEN environment variable not set!');
      console.log('Please set your Deriv API token in environment variables.');
      process.exit(1);
    }

    // Connect to Deriv API
    this.api = new DerivAPI(CONFIG.APP_ID, CONFIG.API_TOKEN);
    await this.api.connect();

    // Check balance
    const balance = await this.api.getBalance();
    console.log(`💰 Account Balance: $${balance.balance} ${balance.currency}`);
    console.log('');

    this.isRunning = true;

    // Start the trading cycle
    this.scheduleNextTrade();
  }

  scheduleNextTrade() {
    if (!this.isRunning) return;

    const now = Date.now();
    const candleIntervalMs = CONFIG.TIMEFRAME * 1000;
    
    // Calculate when the current candle will close
    const currentCandleStart = Math.floor(now / candleIntervalMs) * candleIntervalMs;
    const nextCandleStart = currentCandleStart + candleIntervalMs;
    
    // We want to fetch 2 seconds after candle closes
    const fetchTime = nextCandleStart + 2000;
    const delayMs = fetchTime - now;

    const nextCandleDate = new Date(nextCandleStart);
    const fetchDate = new Date(fetchTime);

    console.log(`⏰ Next candle closes at: ${nextCandleDate.toISOString()}`);
    console.log(`⏰ Will fetch and trade at: ${fetchDate.toISOString()}`);
    console.log(`⏰ Waiting ${(delayMs / 1000).toFixed(1)} seconds...`);
    console.log('');

    setTimeout(() => {
      this.executeTradingCycle().then(() => {
        // Schedule next trade
        this.scheduleNextTrade();
      });
    }, delayMs);
  }

  async executeTradingCycle() {
    const cycleStartTime = Date.now();
    console.log('━'.repeat(60));
    console.log(`🔄 TRADING CYCLE START - ${new Date().toISOString()}`);
    console.log('━'.repeat(60));

    try {
      // Step 1: Fetch latest closed candle
      console.log('📥 Fetching latest closed candle...');
      const fetchStart = Date.now();
      
      const candle = await this.api.getLatestCandle(CONFIG.SYMBOL, CONFIG.TIMEFRAME);
      
      const fetchDuration = Date.now() - fetchStart;
      this.stats.successfulFetches++;
      this.stats.lastCandle = candle;

      console.log(`✅ Candle fetched in ${fetchDuration}ms`);
      console.log(`   Time: ${candle.timestamp}`);
      console.log(`   Open: ${candle.open}`);
      console.log(`   High: ${candle.high}`);
      console.log(`   Low: ${candle.low}`);
      console.log(`   Close: ${candle.close}`);
      console.log(`   Direction: ${candle.direction} ${candle.direction === 'RISE' ? '🟢' : '🔴'}`);
      console.log('');

      // Step 2: Determine trade direction (follow previous candle)
      const tradeDirection = candle.direction; // RISE or FALL
      console.log(`📊 Strategy: Trade ${tradeDirection} (following previous candle)`);
      console.log('');

      // Step 3: Place the trade
      console.log(`💼 Placing ${tradeDirection} trade...`);
      const tradeStart = Date.now();

      const trade = await this.api.placeTrade(
        CONFIG.SYMBOL,
        tradeDirection,
        CONFIG.STAKE,
        CONFIG.DURATION
      );

      const tradeDuration = Date.now() - tradeStart;
      this.stats.totalTrades++;
      this.stats.lastTrade = {
        ...trade,
        direction: tradeDirection,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Trade placed in ${tradeDuration}ms`);
      console.log(`   Contract ID: ${trade.contractId}`);
      console.log(`   Buy Price: $${trade.buyPrice}`);
      console.log(`   Potential Payout: $${trade.payout}`);
      console.log(`   ${trade.longcode}`);
      console.log('');

      // Step 4: Calculate total execution time
      const totalDuration = Date.now() - cycleStartTime;
      console.log(`⏱️  TOTAL EXECUTION TIME: ${totalDuration}ms`);
      console.log(`   Fetch: ${fetchDuration}ms`);
      console.log(`   Trade: ${tradeDuration}ms`);
      console.log(`   Overhead: ${totalDuration - fetchDuration - tradeDuration}ms`);
      console.log('');

      // Check balance
      const balance = await this.api.getBalance();
      console.log(`💰 Current Balance: $${balance.balance} ${balance.currency}`);

    } catch (error) {
      console.error('❌ ERROR in trading cycle:', error.message);
      this.stats.failedFetches++;
      
      if (error.code === 'AuthorizationRequired' || error.code === 'InvalidToken') {
        console.error('❌ FATAL: Authorization failed. Check your API token.');
        this.stop();
      }
    }

    console.log('━'.repeat(60));
    console.log('');
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Math.floor((Date.now() - this.stats.startTime) / 1000)
    };
  }

  stop() {
    console.log('⏹️  Stopping bot...');
    this.isRunning = false;
    if (this.api) {
      this.api.close();
    }
  }
}

// HTTP server for Render health checks
function startHealthServer(bot) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'running',
        stats: bot.getStats()
      }));
    } else if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(bot.getStats(), null, 2));
    } else if (req.url === '/trade' && req.method === 'POST') {
      // Trigger trading cycle via HTTP POST
      bot.executeTradingCycle()
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'trade executed', stats: bot.getStats() }));
        })
        .catch(error => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', error: error.message }));
        });
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Binary Options Test Bot</title>
          <style>
            body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #fff; }
            .card { background: #2d2d2d; padding: 20px; margin: 10px 0; border-radius: 8px; }
            .stat { margin: 10px 0; }
            .green { color: #4caf50; }
            .red { color: #f44336; }
            h1 { color: #2196f3; }
          </style>
        </head>
        <body>
          <h1>🤖 Binary Options Test Bot</h1>
          <div class="card">
            <h2>Status: <span class="green">RUNNING</span></h2>
            <div class="stat">Symbol: ${CONFIG.SYMBOL}</div>
            <div class="stat">Timeframe: ${CONFIG.TIMEFRAME / 60} minutes</div>
            <div class="stat">Stake: $${CONFIG.STAKE}</div>
            <div class="stat">Duration: ${CONFIG.DURATION} minutes</div>
          </div>
          <div class="card">
            <h2>Statistics</h2>
            <div id="stats">Loading...</div>
          </div>
          <script>
            function updateStats() {
              fetch('/stats')
                .then(r => r.json())
                .then(stats => {
                  document.getElementById('stats').innerHTML = 
                    '<div class="stat">Total Trades: ' + stats.totalTrades + '</div>' +
                    '<div class="stat">Successful Fetches: ' + stats.successfulFetches + '</div>' +
                    '<div class="stat">Failed Fetches: ' + stats.failedFetches + '</div>' +
                    '<div class="stat">Uptime: ' + stats.uptime + ' seconds</div>' +
                    (stats.lastCandle ? '<div class="stat">Last Candle: ' + stats.lastCandle.direction + ' at ' + stats.lastCandle.timestamp + '</div>' : '') +
                    (stats.lastTrade ? '<div class="stat">Last Trade: ' + stats.lastTrade.direction + ' (ID: ' + stats.lastTrade.contractId + ')</div>' : '');
                });
            }
            updateStats();
            setInterval(updateStats, 5000);
          </script>
        </body>
        </html>
      `);
    }
  });

  server.listen(CONFIG.PORT, () => {
    console.log(`🌐 Health server running on port ${CONFIG.PORT}`);
    console.log(`   http://localhost:${CONFIG.PORT}`);
    console.log(`   http://localhost:${CONFIG.PORT}/health`);
    console.log(`   http://localhost:${CONFIG.PORT}/stats`);
    console.log('');
  });
}

// Main execution
async function main() {
  const bot = new BinaryOptionsBot();

  // Start health server
  startHealthServer(bot);

  // Start bot
  await bot.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
    bot.stop();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
