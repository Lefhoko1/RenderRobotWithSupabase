# Binary Options Test Bot for Deriv

A simple test bot to measure Render.com performance for binary options trading on Deriv.

## How It Works

1. **Waits** for a 5-minute candle to close
2. **Fetches** the latest closed candle 2 seconds after close
3. **Analyzes** the candle direction (RISE or FALL)
4. **Trades** in the same direction as the previous candle
5. **Logs** execution timing to measure performance

## Setup

### 1. Get Your Deriv API Token

1. Go to https://app.deriv.com/account/api-token
2. Create a new token with these scopes:
   - ✅ Read
   - ✅ Trade
   - ✅ Payments (optional)
3. Copy the token (you'll need it for deployment)

**IMPORTANT:** Use a **DEMO ACCOUNT** for testing!

### 2. Test Locally (Optional)

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your API token
nano .env

# Run the bot
npm start
```

Visit `http://localhost:3000` to see the bot dashboard.

### 3. Deploy to Render

#### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

#### Step 2: Create Render Web Service

1. Go to https://render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `binary-test-bot`
   - **Runtime:** **Docker**
   - **Instance Type:** **Free**

#### Step 3: Add Environment Variables

In Render dashboard, go to **Environment** and add:

```
DERIV_API_TOKEN=your_actual_token_here
DERIV_APP_ID=1089
SYMBOL=R_100
TIMEFRAME=300
STAKE=1.0
DURATION=5
```

#### Step 4: Deploy

Click **"Create Web Service"** and wait for deployment.

## Monitoring

### View Dashboard

Visit your Render URL: `https://your-bot-name.onrender.com`

### Check Stats

Visit: `https://your-bot-name.onrender.com/stats`

### View Logs

In Render dashboard, click **"Logs"** tab to see:
- Candle fetch times
- Trade execution times
- Total execution times
- Errors (if any)

## What to Look For

### Performance Metrics

The bot logs these timing metrics for each cycle:

- **Fetch Duration:** Time to get candle from Deriv API
- **Trade Duration:** Time to place the trade
- **Total Execution Time:** Overall cycle time

### Success Criteria

For binary options, you want:
- ✅ Total execution < 3 seconds (acceptable)
- ✅ No failed fetches
- ✅ Trades placed successfully
- ⚠️  Total execution > 5 seconds (might be problematic)

### Expected Results on Render Free Tier

**First execution (cold start):**
- Fetch: 1-2 seconds
- Trade: 1-2 seconds
- **Total: 5-15 seconds** ⚠️

**Subsequent executions (warm):**
- Fetch: 500ms-1s
- Trade: 500ms-1s
- **Total: 1-3 seconds** ✅

## Configuration

Edit environment variables in Render to change:

- `SYMBOL` - Trading symbol (default: R_100)
- `TIMEFRAME` - Candle timeframe in seconds (default: 300 = 5 min)
- `STAKE` - Amount per trade in USD (default: 1.0)
- `DURATION` - Trade duration in minutes (default: 5)

## Safety Notes

⚠️ **IMPORTANT:**
1. **Use DEMO account only** for testing
2. Start with **small stakes** ($1)
3. **Monitor the bot** for the first few trades
4. This is a **TEST STRATEGY** - following previous candle is NOT a profitable strategy
5. Check your Deriv account regularly

## Strategy (For Testing Only)

This bot uses the simplest possible strategy:

- If previous candle was GREEN → Trade RISE
- If previous candle was RED → Trade FALL

**This is NOT meant to be profitable!** It's purely for testing execution timing.

## Troubleshooting

### Bot Not Trading

Check logs for:
- Authorization errors (invalid API token)
- Insufficient balance
- Connection errors

### Slow Execution

Render free tier may:
- Have cold starts (5-15 seconds delay)
- Spin down after 15 minutes of inactivity
- Network latency to Deriv servers

### Failed Trades

Check:
- Account balance is sufficient
- API token has "Trade" permissions
- You're on demo account (for testing)

## Next Steps After Testing

Based on performance results:

**If execution is fast enough (<3 seconds):**
- ✅ Render can work for your strategy
- Consider upgrading to paid tier ($7/month) for always-on

**If execution is too slow (>5 seconds):**
- ❌ Need different platform (Railway, Fly.io, Oracle Cloud)
- Cold starts are killing your timing

## License

MIT
