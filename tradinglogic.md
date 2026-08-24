# Automation Logic Documentation - Randomized Over/Under Auto-Automation

This document outlines the technical automation logic, execution flow, and risk management strategies implemented in the current system following the Over/Under overhaul.

## 1. Strategy Engine (`useAutoTrader.ts`)
The system has been refactored to use a **Randomized Over/Under** strategy, moving away from statistical digit avoidance.

### Contract Selection
For every trade initiation, the bot randomly selects one of two contract types:
1.  **DIGITOVER**: Barrier = 5 (Wins if last digit is 6, 7, 8, or 9).
2.  **DIGITUNDER**: Barrier = 4 (Wins if last digit is 0, 1, 2, or 3).

### Symbol Selection
The bot randomly selects a volatility index from the supported list for every trade to distribute risk across different market conditions:
- Volatility 10, 25, 50, 75, 100
- Volatility 10 (1s), 15 (1s), 25 (1s), 30 (1s), 50 (1s), 75 (1s), 90 (1s), 100 (1s)

### Strategy R Recovery Trade Selection
For Strategy R, base trades use Over 1 / Under 8 contracts. During Martingale recovery steps (following a loss), the bot manages recovery trades as follows:
1. **50/50 Pair Decision**: For every recovery trade step, the bot randomly selects between **EVEN/ODD** pair (`even` / `odd`) and **PUTE/CALLE** pair (`rise` / `fall` -> PUTE / CALLE).
2. **PUTE/CALLE Trade Execution**: If PUTE/CALLE is chosen, the bot selects `rise` or `fall` (alternating from previous trade if applicable) and executes the trade immediately.
3. **EVEN/ODD Trade Execution & Criteria A-F**: If EVEN/ODD is chosen, the bot scans all 10 volatility symbols using up to 1000 digits against **Criteria A-F**:
   - **Criteria A-D**: Evaluates digit percentages P1, P2 (>=11%), P3 (<=9.5%), and trigger digit D10 parity.
   - **Criterion E**: Live tick pattern sequence validation.
   - **Criterion F (Tie-Breaker)**: If top digits D1 and D2 have different parities (one EVEN and one ODD), Criterion F randomly selects target parity (`EVEN` or `ODD`).
   - **Validation & Waiting**: If one or more symbols qualify (`isValidated === true`), the trade is executed immediately. If no symbol currently qualifies, the bot waits (`WAIT_EVEN_ODD_TRIG`) and re-scans on subsequent ticks until execution.
4. **Independent Step Decision**: If a recovery trade loses, the bot re-evaluates the 50/50 pair choice independently for the next recovery step.

---

## 2. Automated Execution
The execution flow is a continuous, state-aware loop driven by WebSocket responses and tick events.

### Execution Flow
1.  **Proposal Request**: Requests a proposal for the randomly selected symbol and contract type.
2.  **Buy Execution**: Automatically buys the contract upon receiving a valid proposal.
3.  **Result Monitoring**: Listens for `proposal_open_contract` updates. Once `is_sold` is true, the result is processed.

### Stake Management (Martingale)
- **Base Stake**: Configurable in the UI (e.g., $0.35).
- **Multiplier**: **1.8x** on losses.
- **Max Steps**: Configurable safety cap (e.g., 10 steps). If reached, the bot automatically stops.
- **Behavior**: 
  - On **Win**: Stake resets to the base stake and martingale step resets to 0.
  - On **Loss**: Stake is multiplied by 1.8 for the next trade.

---

## 3. Risk & Stability Systems

### Tick-Based Cooldowns
Unlike time-based cooldowns, the bot uses real-time market ticks to pace execution:
- **Post-Win Cooldown**: A random wait of **1–3 ticks** before the next trade.
- **Post-Loss-Streak Cooldown**: If the bot enters a loss streak (2 or more consecutive Martingale steps), it triggers a longer cooldown of **5–10 ticks** to wait for market stabilization.

### Concurrency Guard
- An internal `isExecuting` flag prevents the bot from firing multiple overlapping trades, ensuring the session state remains synchronized with the account balance.

### WebSocket Watchdog
- Monitors connection health. If no messages are received for **25 seconds**, the system forces a reconnection.

---

## 4. Logging & Diagnostics
- **Automation Log**: Real-time history displayed in the UI with Win/Loss status and Martingale step tracking.
- **Console Monitoring**: JSON-structured logs (`automation_initiated`, `automation_settled`) are outputted for external auditing and Monitor integration.
- **Supabase Sync**: Results are synchronized to the `trades` table for long-term performance tracking.
