# 📧 Digit Bot Pro - 6-Day Trial Onboarding Email Sequence

This document contains a complete, high-converting 6-day onboarding email sequence tailored directly to **Digit Bot Pro**, covering Deriv OAuth setup, Randomized Over/Under automation logic, risk controls, tick-based cooldowns, and conversion to Live Real Accounts.

---

## 🗓️ Day 1: Welcome & Deriv OAuth Account Setup
**Objective:** Guide the user to log in via Deriv OAuth, verify their Virtual Demo Account connection, and view real-time tick streaming on the Live Ticker.

### Subject Line Options:
* **Option A (Recommended):** Welcome to Digit Bot Pro! Connect your Deriv Demo account 🚀
* **Option B:** Your 6-day access is live – 3 minutes to setup
* **Option C:** Welcome aboard! Let’s stream your first Deriv market ticks

**Preheader:** *Log in via Deriv OAuth and verify your Virtual Demo Account connection in 3 steps.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Welcome to Digit Bot Pro! We’re thrilled to have you on board.

Digit Bot Pro is an advanced automated digit trading platform for Deriv markets, powered by real-time tick analysis, multi-market distribution, and our proprietary Randomized Over/Under automation engine.

During your 6-day trial, you have full access to test the automated trading engine on your **Deriv Virtual (Demo) Account**.

---

### 🏁 Step 1: Connect Your Deriv Account in 3 Minutes

Setting up takes less than 3 minutes using safe, instant Deriv OAuth authorization:

1️⃣ **Log in to Digit Bot Pro:** Go to {{login_url}} and click **"Login with Deriv"**.
2️⃣ **Authorize via Deriv:** Grant secure read & trade API permissions for your account.
3️⃣ **Verify Virtual Connection:** Once redirected, check your top header banner. You will see a green **"Connected"** status badge with your Virtual Account ID (e.g., `VRTC123456`).

👉 [Launch Dashboard & Connect Deriv OAuth]({{login_url}})

---

💡 **Pro Tip for Day 1:** 
Look at the **Live Ticker** at the top of your dashboard. Select **Volatility 100 Index** and watch incoming ticks stream live. The glowing rightmost digit shows the exact last digit analyzed by the engine!

If you run into any setup issues, hit reply to this email. We're here to help!

To automated precision,

**The Digit Bot Pro Team**
{{company_name}}

[Unsubscribe] | [Support Center]
```

---

## 🗓️ Day 2: The Randomized Over/Under Engine & Symbol Distribution
**Objective:** Educate the user on how the engine selects DIGITOVER / DIGITUNDER contracts and distributes trades across Volatility Indices to reduce risk.

### Subject Line Options:
* **Option A (Recommended):** How our Randomized Over/Under engine balances market risk 📊
* **Option B:** DIGITOVER vs DIGITUNDER: The math behind our trade execution
* **Option C:** Multi-market distribution: Why switching indices protects your account

**Preheader:** *Learn how Digit Bot Pro selects contract barriers and distributes risk across markets.*

---

### Email Body:

```text
Hi {{first_name|default:"trader"}},

Now that your Deriv Demo account is connected, let's look under the hood at how our **Randomized Over/Under Automation Engine** works.

Rather than sticking to rigid, static patterns that get caught in drawdowns, Digit Bot Pro dynamically evaluates entry conditions and balances execution risk.

---

### 🔍 How The Engine Selects Trades:

1️⃣ **Contract Selection:**
   * **DIGITOVER (Barrier 5):** Wins whenever the last digit lands on 6, 7, 8, or 9.
   * **DIGITUNDER (Barrier 4):** Wins whenever the last digit lands on 0, 1, 2, or 3.

2️⃣ **Multi-Symbol Risk Distribution:**
   * The bot randomly selects volatility indices across continuous tick feeds (Volatility 10, 25, 50, 75, 100, and 1s indices).
   * This multi-market distribution prevents over-exposing your balance to single-market spikes.

👉 [View Live Execution on Your Dashboard]({{login_url}})

---

🎯 **Action Item for Today:**
Open your dashboard and watch the **Trading Panel**. Notice how the bot evaluates tick streams across indices in real time!

Tomorrow, we’ll turn on the **Auto Trader Switch** and set up hard risk management controls!

Best regards,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 3: Auto Trader Setup, Stake Safety & Martingale Controls
**Objective:** Show users how to turn on the Auto Trader, set Target Profit & Stop Loss limits, configure Martingale multipliers (1.8x), and cap Max Martingale steps.

### Subject Line Options:
* **Option A (Recommended):** Auto Trader setup: Controlling risk with 1.8x Martingale & Target Profit 🛡️
* **Option B:** How to automate Deriv trades without risking your balance
* **Option C:** Target Profit, Stop Loss & Max Steps: Setting your safety controls

**Preheader:** *Configure your safety limits, set Martingale multipliers, and test automated execution.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Automated trading requires rock-solid risk control. Digit Bot Pro comes built-in with strict safety guardrails so you can automate with total confidence.

Today, we're setting up your **Trading Panel** parameters.

---

### ⚙️ 4 Critical Controls in Your Trading Panel:

1️⃣ **Target Profit ($):** Set your session profit goal (e.g., 3%–5% of account balance). Once reached, the Auto Trader stops automatically.
2️⃣ **Stop Loss ($):** Define your hard equity floor. If drawdown hits this limit, trading halts immediately to protect your capital.
3️⃣ **Base Stake ($):** Set your initial trade stake (minimum $0.35).
4️⃣ **Martingale Multiplier (1.8x):** On a loss, the bot scales the stake by 1.8x for the recovery attempt, then resets back to base stake upon a win. You can also set a **Max Martingale Steps** cap to limit consecutive recovery trades.

👉 [Configure Trading Panel & Safety Limits]({{login_url}})

---

💡 **Recommended Day 3 Demo Test:**
1. Set **Target Profit** to `$10.00` and **Stop Loss** to `$20.00`.
2. Set **Base Stake** to `$0.35`.
3. Toggle the **Auto Trader Switch** to **ON**.
4. Watch how trades execute automatically in your live **Trade Log**!

Stay safe and trade smart,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 4: Tick-Based Cooldowns & Concurrency Guards
**Objective:** Explain how market tick cooldowns (1-3 ticks post-win, 5-10 ticks post-loss streak) and concurrency guards keep session states synchronized.

### Subject Line Options:
* **Option A (Recommended):** Smart Cooldowns: How tick pacing protects your balance ⏱️
* **Option B:** Why tick-based delays prevent drawdowns during volatility spikes
* **Option C:** Wind Down Mode & Concurrency Protection explained

**Preheader:** *Discover how tick cooldowns and Wind Down Mode keep your session safe.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

In automated trading, speed matters—but pacing matters even more. Placing trades too quickly during erratic market conditions can lead to unnecessary drawdowns.

That’s why Digit Bot Pro uses **Tick-Based Cooldowns** rather than rigid timers.

---

### ⏱️ How Tick Pacing Protects Your Account:

* **Post-Win Cooldown (1–3 Ticks):** After every win, the bot waits a randomized 1 to 3 ticks before entering the next trade to allow price action to settle.
* **Post-Loss Streak Cooldown (5–10 Ticks):** If consecutive loss steps occur, the bot triggers an extended 5 to 10 tick pause, giving the market time to stabilize before placing the recovery trade.
* **Concurrency Guard:** Prevents overlapping trade requests so your account balance and state remain 100% synchronized.
* **Wind Down Mode 🌀:** Ready to stop? Click **Wind Down Mode**! The bot will finish its active trade sequence cleanly before safely turning off.

👉 [Open Dashboard & Test Wind Down Mode]({{login_url}})

---

🎯 **Today's Experiment:**
Run the bot in Demo Mode and click **"Wind Down Mode"** mid-session. Notice how the bot completes the active cycle smoothly before stopping!

Best regards,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 5: Performance Panel Analytics & Trade Log Export (Trial Ends Tomorrow)
**Objective:** Show users how to evaluate performance via Session P/L, Daily P/L, Win Rate %, Trade Log CSV export, and build urgency for trial expiration.

### Subject Line Options:
* **Option A (Recommended):** [1 Day Left] Evaluating your session stats & exporting Trade Logs 📈
* **Option B:** How to analyze your win rate and session P/L in Digit Bot Pro
* **Option C:** Tomorrow your trial ends: Audit your demo performance now

**Preheader:** *Track your Daily & Session P/L, review detailed trade logs, and prepare for live trading.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Your 6-day trial is almost complete! Today, let's evaluate your demo performance using the **Performance Panel**.

Real-time feedback is key to fine-tuning your base stake and session management before going live.

---

### 📊 Key Performance Panel Metrics to Check:

* **Session P/L ($):** Net profit or loss for your active trading session in real time.
* **Daily P/L ($):** Cumulative net profit or loss across all sessions for today.
* **Win Rate (%):** Percentage of winning trades vs total trades executed.
* **Live Trade Log:** Displays every contract purchase with Symbol, Contract Type (`DIGITOVER` / `DIGITUNDER`), Stake, Payout, and Result.
* **Download CSV 📥:** Export your complete trade log to Excel or Google Sheets for deep offline analysis.

👉 [Check Performance Panel & Download Trade Log]({{login_url}})

---

⏰ **Trial Expiry Notice:**
Your trial countdown timer expires in 24 hours. Free trial accounts are locked to **Deriv Virtual Demo Accounts (`VRTC...`)**. Upgrading unlocks trading on your **Live Real Account (`CR...`)**!

Keep testing and refining,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 6: Final Trial Expiry & Transition to Live Real Account (Promo Code `PRO20`)
**Objective:** Final day conversion push. Explain trial expiration state and offer a 20% launch discount code (`PRO20`) to convert users to paid subscribers trading on Real Accounts (`CR`).

### Subject Line Options:
* **Option A (Recommended):** Your trial expires today: Claim 20% off & trade live (`CR...`) ⏳
* **Option B:** Final Call: Upgrade now to unlock Live Real Trading on Deriv
* **Option C:** Last chance! Use code PRO20 before midnight 🎁

**Preheader:** *Your 6-day trial expires today. Use promo code PRO20 for 20% off your subscription.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Today is the **final day** of your Digit Bot Pro 6-day trial.

Over the past 6 days, you’ve experienced the full power of real-time tick analytics, multi-symbol risk distribution, and automated risk-managed execution on Deriv.

Starting tomorrow, your trial session will lock. But your automated trading journey is just getting started!

---

### 🎁 Exclusive Final-Day Offer: 20% OFF Your Subscription

To help you move from Demo testing to Live Real Account trading seamlessly, we're giving you an exclusive **20% discount** on your plan subscription!

🎟️ **Use Promo Code:** `PRO20` (Expires at Midnight)

👉 [Claim 20% Off & Upgrade to Live Real Account]({{upgrade_url}})

---

### ⚡ What Happens Next When You Upgrade:
1️⃣ Your account instantly upgrades to **Paid Pro** status.
2️⃣ Open your **Account Selector** at the top of your dashboard.
3️⃣ Switch from Virtual (`VRTC...`) to your **Live Real Account (`CR...`)**.
4️⃣ Turn on the **Auto Trader** and let the engine run live with real balance trading!

### 🛡️ 100% Cancel-Anytime Guarantee
You can manage or cancel your subscription at any time with one click from your billing portal.

Thank you for spending the week with us. We look forward to seeing your live trading success!

See you on the inside!

**The Digit Bot Pro Team**
{{company_name}}

[Upgrade Now with Code PRO20]({{upgrade_url}})
```
