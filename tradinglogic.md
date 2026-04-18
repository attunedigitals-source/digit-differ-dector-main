# Trading Logic Documentation - Digit Differs Auto-Trader

This document outlines the technical trading logic, signal generation process, and risk management strategies implemented in the current system.

## 1. Signal Generation Engine (`signal-engine.ts`)
The core strategy is built on **statistical momentum analysis** of the last digits of tick data.

### Data Collection
- The system maintains a rolling window of the last **200 ticks** for each selected volatility index.
- A minimum of **30 ticks** is required before any analysis begins.

### Danger Digit Calculation
For each digit (0-9), a "Danger Score" is calculated using four weighted factors:
1.  **Normalized Gap (40%)**: How many ticks have passed since the digit last appeared. Longer gaps increase the score (reversion probability).
2.  **Recent Frequency (30%)**: Frequency of the digit in the last 20 ticks. Lower frequency increases the score.
3.  **Pattern Persistence (15%)**: A binary score based on whether the digit appeared in the last 10 ticks.
4.  **Overall Weight (15%)**: The digit's total frequency over the entire 200-tick history.

The digit with the **highest Danger Score** is selected as the `dangerDigit`.

### Signal Validation
A signal is only emitted if:
- **Confidence > 0.65**: The highest score must meet this threshold.
- **Tick Interval > 10**: At least 10 ticks must have passed since the last signal for that symbol.

---

## 2. Automated Trading Execution (`useAutoTrader.ts`)
Once a signal is received, the auto-trader executes a multi-step flow via WebSocket.

### Execution Flow
1.  **Proposal Request**: Requests a contract price for `DIGITDIFF` with a 1-tick duration and the identified `dangerDigit` as the barrier.
2.  **Buy Execution**: Upon receiving a valid proposal ID, the system sends a `buy` command.
3.  **Contract Subscription**: Subscribes to `proposal_open_contract` to monitor the trade outcome in real-time.

### Stake Management (Martingale)
- **Base Stake**: Default is `$0.35` (configurable).
- **Martingale Factor**: **11x**. 
- **Behavior**: 
  - On **Win**: Stake for that specific symbol resets to the base stake.
  - On **Loss**: The next stake for that symbol is multiplied by 11 (e.g., $0.35 -> $3.85 -> $42.35).

---

## 3. Risk & Stability Systems

### Isolated Cooldowns
- If a trade is lost on a specific symbol, **only that symbol** enters a random **2–8 second cooldown**.
- Other symbols continue to trade normally without interruption.

### Random Digit Mode (Optional)
- When enabled, the system ignores the signal engine and instead persistent assigns a **randomly rotated avoid digit** for each symbol.
- The digit is automatically rotated after every trade (win or loss) to prevent pattern detection.

### WebSocket Watchdog
- A background process monitors the time since the last received message.
- If no messages (ticks/balance) are received for **25 seconds**, the system assumes a ghost connection and forces an immediate reconnect to ensure no signals are missed.

### Safety Valves
- **Lock Expiry**: Symbols are "locked" during an active trade. If a trade response is never received, the lock is automatically released after a short timeout (15-30s) to prevent "freezing."
- **Settlement Cleanup**: Stale contract IDs are pruned from memory after 5 minutes to maintain performance.

---

## 4. Database Integration
- **Trade Logging**: Every trade intent, contract ID, and final outcome (win/loss/profit) is logged in the `trades` table in Supabase.
- **Signal Archiving**: Every generated signal is archived in the `matches_signals` table for historical accuracy auditing.
