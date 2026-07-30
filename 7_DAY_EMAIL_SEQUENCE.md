# 📧 Digit Bot Pro - 7-Day Trial Onboarding Email Sequence

This document contains a complete 7-day trial email sequence built around the app's high-probability barrier & adaptive recovery engine. **Day 1 is engineered for immediate same-day activation**, **Day 3 features the Hit and Run Strategy**, and **Days 2 through 7 educate users on specific app functionalities, risk controls, and tips**, systematically gearing them towards upgrading to a paid subscription for Live Real Account trading (`CR...`).

---

## 🗓️ Day 1: Instant Activation – Start Trading on Demo Today 🚀
**Objective:** Get the user to log in via Deriv OAuth, verify their Virtual Account (`VRTC`), and turn on the Auto Trader to execute their first demo trade *on Day 1*.

### Subject Line Options:
* **Option A (Recommended):** Welcome to Digit Bot Pro! Run your first automated trade today 🚀
* **Option B:** Your access is live – Start automated demo trading in 3 minutes
* **Option C:** Welcome aboard! Let’s execute your first Deriv trade today

**Preheader:** *Connect your Deriv Demo account and launch your first automated trade in under 3 minutes.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Welcome to Digit Bot Pro! We’re thrilled to have you on board.

Digit Bot Pro is an advanced automated digit trading platform for Deriv markets, powered by real-time tick analytics, high-probability digit barriers, and adaptive recovery execution.

We built Digit Bot Pro so you don't have to spend hours learning complex setups. In fact, **you can run your first automated trade in less than 3 minutes today!**

---

### ⚡ Step-by-Step: Run Your First Trade Today

Follow these 3 quick steps to activate your bot right now with ZERO risk on Demo:

1️⃣ **Log in with Deriv:** Go to {{login_url}} and click **"Login with Deriv"**.
2️⃣ **Verify Virtual Connection:** Look at your top header. You’ll see a green **"Connected"** badge with your Virtual Account ID (e.g., `VRTC123456`).
3️⃣ **Turn Auto Trader ON:** In your Trading Panel, leave the default settings (Base Stake: $0.35, Target Profit: $10), toggle the **Auto Trader Switch** to **ON**, and watch your first trade fire live!

👉 [Launch Dashboard & Run Your First Trade Now]({{login_url}})

---

💡 **Pro Tip for Day 1:** 
Your 7-day trial grants full access to test the automated engine on your **Deriv Virtual Demo Account (`VRTC...`)**. Testing on Demo lets you get familiar with trade execution speed and stake management completely risk-free!

If you hit any setup snags, reply directly to this email. We’re here to help!

To automated precision,

**The Digit Bot Pro Team**
{{company_name}}

[Unsubscribe] | [Support Center]
```

---

## 🗓️ Day 2: High-Probability Barriers & Parity Execution
**Objective:** Explain how the engine evaluates tick feeds to select high-win-probability barrier contracts (Over 1 / Under 8), numerical parity (Even/Odd), and direction momentum (Rise/Fall).

### Subject Line Options:
* **Option A (Recommended):** How our engine selects high-probability digit trades 📊
* **Option B:** Over 1, Under 8 & Parity: How Digit Bot Pro enters trades
* **Option C:** Multi-category entry: Combining digit barriers with tick momentum

**Preheader:** *Understand how Digit Bot Pro leverages 50% - 80% win-coverage barriers and parity trends.*

---

### Email Body:

```text
Hi {{first_name|default:"trader"}},

Yesterday, you ran your first automated trade. Today, let's look under the hood at how the engine selects trades: **High-Probability Barrier & Parity Execution**.

Rather than taking blind random risks, Digit Bot Pro targets trade categories designed to maximize statistical win coverage.

---

### 🔍 How The Engine Selects Trade Categories:

1️⃣ **High-Probability Barrier Contracts:**
   * **Over 1 (O1):** Barrier set at 1—wins whenever the last tick digit lands on 2, 3, 4, 5, 6, 7, 8, or 9 (giving ~80% win coverage per tick!).
   * **Under 8 (U8):** Barrier set at 8—wins whenever the last tick digit lands on 0, 1, 2, 3, 4, 5, 6, or 7 (giving ~80% win coverage per tick!).

2️⃣ **Parity & Momentum Execution:**
   * **Even (EV) & Odd (OD):** Tracks numerical parity trends over recent tick windows (giving ~50% win coverage per tick!).
   * **Rise & Fall:** Analyzes short-term tick direction momentum (giving ~50% win coverage per tick!).

👉 [Watch Live Category Selection on Your Dashboard]({{login_url}})

---

💡 **Pro Tip for Day 2:**
Look at the **Live Ticker** at the top of your dashboard. Notice how the glowing rightmost digit updates in real time. The engine uses these exact last-digit stream feeds to confirm entry criteria!

🔒 *Paid Account Feature Note:* While trial users test this on Virtual Demo accounts, Paid Pro members run this engine 24/7 on Live Real Accounts (`CR...`).

Best regards,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 3: Profiting Using the Hit and Run Strategy 🎯
**Objective:** Teach users how to lock in consistent daily profits using the disciplined Hit & Run Strategy rules, including the 2-session daily limit and the Advanced 70/30 Target Profit Split.

### Subject Line Options:
* **Option A (Recommended):** Profiting using the Hit & Run Strategy 🎯
* **Option B:** The 2-Session Rule: How to hit your daily profit and walk away
* **Option C:** Advanced Hit & Run: The 70/30 target profit split strategy

**Preheader:** *Master disciplined session trading using the 2-session Hit & Run framework and 70/30 profit splitting.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

The biggest mistake traders make is staying in the market for too long. Market conditions shift constantly, and "session fatigue" can turn a winning day into a loss.

Today, we're introducing our most disciplined profit blueprint: **The Hit and Run Strategy**.

The concept is simple: get in, hit your profit target quickly, and get out!

---

### 🎯 1. The Standard Hit & Run Strategy (Rules of Engagement)

You will run **at most 2 sessions daily**, using the exact same base stake, target profit, and allowed loss (Stop Loss) for each session:

1️⃣ **Session 1 Execution:**
   * **If Session 1 hits Stop Loss:** STOP immediately for the day. Do NOT attempt a second session. Wait a full 24 hours until tomorrow before trading again.
   * **If Session 1 hits Take Profit:** Take a break for 3 hours minimum, let the market settle, and proceed to Session 2.

2️⃣ **Session 2 Execution:**
   * **If Session 2 hits Take Profit:** Fantastic! You’ve locked in maximum daily profits. Shut down the bot for the day.
   * **If Session 2 hits Stop Loss:** STOP immediately. Do NOT run a 3rd session under any circumstances. Wait until tomorrow!

---

### 🚀 2. The Advanced Hit & Run Strategy (70/30 Target Profit Split)

To make your daily target even easier to hit, use the **Advanced 70/30 Target Profit Split**:

* **Session 1 Target Profit:** Set your Take Profit to **70%** of your total daily target (e.g., if your daily target is $220, set Session 1 Take Profit to **$154.00**).
* **Session 2 Target Profit:** Set your Take Profit to **30%** of your total daily target (e.g., **$66.00**).
* **Allowed Loss (Stop Loss):** Keep your Stop Loss the same for both sessions to protect your account.

Why does this work so well? **Session 1 secures the bulk (70%) of your daily target quickly**, making Session 2 a light, low-exposure run to complete your goal!

👉 [Set Up Your Hit & Run Parameters on Dashboard]({{login_url}})

---

💡 **Pro Tip for Day 3:**
Consistency comes from strict discipline. Set your Target Profit and Stop Loss before toggling the Auto Trader switch, and ALWAYS follow the 2-session rule!

📈 *Gearing Up for Live Trading:* When you switch to a Paid Real Account (`CR...`), the Hit & Run approach ensures your real capital is exposed to the market for the shortest time possible.

Trade disciplined and hit your targets,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 4: Execution Stability – Tick Cooldowns & Wind Down Mode
**Objective:** Teach users how tick-based pacing (post-win 1-3 ticks, post-loss 5-10 ticks) and Wind Down Mode preserve balance integrity and exit cycles cleanly in a win.

### Subject Line Options:
* **Option A (Recommended):** Smart Cooldowns: How tick pacing protects your balance ⏱️
* **Option B:** Why tick delays prevent drawdowns during volatility spikes
* **Option C:** Wind Down Mode 🌀: Exiting automated sessions safely

**Preheader:** *Discover how tick cooldowns and Wind Down Mode keep your trading session safe.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Placing trades too fast during erratic market spikes is one of the most common mistakes in automated trading.

Digit Bot Pro fixes this with **Tick-Based Cooldowns** and **Wind Down Mode**.

---

### ⏱️ Smart Execution Controls:

* **Post-Win Cooldown (1–3 Ticks):** After a winning trade, the bot pauses for 1 to 3 ticks to let market volatility settle before entering the next order.
* **Post-Loss Streak Cooldown (5–10 Ticks):** If consecutive loss steps occur, the bot triggers an extended 5 to 10 tick pause, giving the market time to stabilize before placing the recovery trade.
* **Wind Down Mode 🌀:** Ready to finish a session? Instead of stopping abruptly mid-trade in loss, click **"Wind Down Mode"**. The bot will complete the active trade cycle cleanly in a win before turning off!

👉 [Test Wind Down Mode on Your Dashboard]({{login_url}})

---

💡 **Pro Tip for Day 4:**
Try running a demo session today and click **"Wind Down Mode"** midway through. Watch how gracefully the bot completes the active cycle in a win before stopping!

🔒 *Live Readiness:* On Live Real Accounts, Wind Down Mode ensures you never leave an un-recovered trade sequence hanging when you step away from your desk.

Best regards,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 5: Performance Panel Analytics & Trade Log Audit
**Objective:** Teach users how to evaluate their Session P/L, Daily P/L, Win Rate %, export CSV trade logs, and review category performance (`O1`, `U8`, `EV`, `OD`, `Rise/Fall`).

### Subject Line Options:
* **Option A (Recommended):** How to audit your trading stats & export CSV logs 📈
* **Option B:** Reviewing your win rate: Data-driven session analysis
* **Option C:** Track your Daily P/L like a professional quantitative trader

**Preheader:** *Track Session P/L, analyze win rate percentages, and download complete trade logs.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

You're now 5 days into your trial! Today, let's look at how to evaluate your results using the **Performance Panel**.

Successful traders make decisions based on empirical data, not guesswork.

---

### 📊 Key Performance Panel Metrics to Audit:

* **Session P/L ($):** Real-time net profit or loss for your current trading session.
* **Daily P/L ($):** Total cumulative profit or loss across all sessions today.
* **Win Rate (%):** Percentage of winning trades vs total trades executed.
* **Live Trade Log:** Detailed breakdown showing Symbol, Contract Category (`O1`, `U8`, `EV`, `OD`, `Rise`, `Fall`), Entry Stake, Payout, and Win/Loss status.
* **Download CSV 📥:** Export your complete trade log to Excel or Google Sheets for deep offline analysis.

👉 [View Performance Panel & Download CSV Log]({{login_url}})

---

💡 **Pro Tip for Day 5:**
Export your CSV trade log after a demo session. Review your win rate across different times of day to find your optimal trading window!

🎯 *24 Hours Remaining:* You've proven the engine works on Demo over the last 5 days. Tomorrow is your final trial day—get ready to transition to real balance trading!

Keep refining,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 6: Virtual vs. Real Account Comparison (24 Hours Remaining)
**Objective:** Create high conversion urgency by contrasting Virtual Demo (`VRTC`) limitations with Live Real Account (`CR`) unlocks before the trial expires tomorrow.

### Subject Line Options:
* **Option A (Recommended):** [24 Hours Left] Unlock Live Real Account trading (`CR...`) ⚡
* **Option B:** Your trial ends tomorrow: Don't lose your automated engine
* **Option C:** Virtual Demo vs Live Real Account: Here's what unlocks

**Preheader:** *Your 7-day trial ends tomorrow. Upgrade to unlock Live Real Account trading on Deriv.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

A quick heads-up: **Your 7-Day Trial expires in 24 hours.**

Look at the top of your dashboard—you'll see your **Trial Countdown Banner** counting down the final hours.

As a trial user, you've experienced full automation on your **Deriv Virtual Demo Account (`VRTC...`)**. Once your trial ends, automated execution will lock.

---

### 🔓 What Unlocks When You Upgrade to Paid Pro:

🔴 ➡ 🟢 **Live Real Account Trading:** Switch seamlessly from Virtual (`VRTC`) to your real Deriv account (`CR...`) in your Account Selector and execute live real-money trades.
%0A ♾️ **Unlimited Session Execution:** Run the Auto Trader 24/7 without session lockouts or daily timeouts.
⚡ **Full Engine Priority:** Enjoy low-latency order placement directly on Deriv WebSocket servers.
📊 **Multi-Volatility Index Access:** Continuously scan Volatility 10, 25, 50, 75, 100 & 1s index feeds.
🎧 **Priority VIP Support:** Get direct 1-on-1 assistance setting up parameters tailored to your target balance.

👉 [Upgrade to Digit Bot Pro Now]({{upgrade_url}})

---

Don't let your automated trading engine go offline! Upgrade today so you're ready to switch to live trading tomorrow.

To live automated profits,

**The Digit Bot Pro Team**
```

---

## 🗓️ Day 7: Final Trial Expiry & Conversion Push (Promo Code `PRO20`)
**Objective:** Final conversion push. Explain trial expiration state, highlight instant switching from `VRTC` to `CR`, and offer a 20% discount code (`PRO20`).

### Subject Line Options:
* **Option A (Recommended):** Your trial expires today: Claim 20% off & trade live (`CR...`) ⏳
* **Option B:** Final Call: Switch from Demo to Live Real Account trading
* **Option C:** Last chance! Use promo code PRO20 before midnight 🎁

**Preheader:** *Your trial expires today. Use promo code PRO20 for 20% off your subscription.*

---

### Email Body:

```text
Hi {{first_name|default:"there"}},

Today is the **final day** of your Digit Bot Pro trial.

Over the past 7 days, you’ve seen how real-time tick analytics, high-probability digit barriers, and adaptive recovery controls can bring consistency to your Deriv trading.

Starting tomorrow, trial execution will close. But your automated trading journey is just getting started!

---

### 🎁 Exclusive Final-Day Bonus: 20% OFF Your Subscription

To help you move from Demo testing to Live Real Account trading seamlessly, we're giving you an exclusive **20% discount** on your plan subscription!

🎟️ **Use Promo Code:** `PRO20` (Expires at Midnight)

👉 [Claim 20% Off & Switch to Live Account]({{upgrade_url}})

---

### ⚡ 3-Step Switch to Live Real Trading:
1️⃣ **Upgrade Your Account:** Click the link above and apply code `PRO20`.
2️⃣ **Select Real Account (`CR...`):** Open your **Account Selector** dropdown at the top of your dashboard and switch from `VRTC` to your Real Deriv Account (`CR...`).
3️⃣ **Turn Auto Trader ON:** Launch the bot and start trading with real balance execution!

### 🛡️ 100% Cancel-Anytime Guarantee
You can manage or cancel your subscription at any time with one click directly from your billing portal.

Thank you for spending the week with us. We look forward to seeing your live trading success!

See you on the inside!

**The Digit Bot Pro Team**
{{company_name}}

[Upgrade Now with Code PRO20]({{upgrade_url}})
```
