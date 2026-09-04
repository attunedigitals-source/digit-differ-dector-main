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
2. **PUTE/CALLE Trade Execution & Trend-Momentum Criteria**: If PUTE/CALLE is chosen, the bot evaluates all 10 volatility symbols using tick price trend and directional momentum:
   - **Criterion A**: Evaluates EMA(5) vs EMA(15) trend and directional tick ratio (`"rise"` for bullish trend, `"fall"` for bearish trend).
   - **Criteria B & C**: Evaluates Directional Momentum Strength (>=52.5%) and Flat Tick Ratio (<=25.0%).
   - **Criterion D**: If only one volatility meets Criteria A-C, trade is executed on that volatility in its trend direction.
   - **Criterion E**: If more than one volatility meets Criteria A-C, the volatility with the highest directional momentum strength is selected and traded in its trend direction.
3. **EVEN/ODD Trade Execution & Criteria Analysis**: If EVEN/ODD is chosen, the bot scans all 10 volatility symbols using up to 1000 digits against statistical criteria:
   - **Criterion A**: Evaluates top digits D1 and D2 parity (both EVEN -> `"even"`, both ODD -> `"odd"`).
   - **Criteria B & C**: Evaluates digit percentages P1, P2 (>=10.5%) and P3 (<=10.0%).
   - **Criterion D**: If only one volatility meets Criteria A-C, trade is executed on that volatility in the direction of the criterion.
   - **Criterion E**: If more than one volatility meets Criteria A-C, the volatility with the highest average top percentage `((1st Top % + 2nd Top %)/2)` is selected and traded in its direction.
### Strategy S (Graduated Over/Under Recovery Ladder)
Strategy S is an advanced evolution of Strategy R featuring a graduated Over/Under recovery ladder where probability of win and payout interest rates transition progressively across recovery tiers before utilizing high-edge statistical recovery at tier 5+:

1. **Base Trade (Step 0)**:
   - Contract: **OVER 1** (Barrier 1) or **UNDER 8** (Barrier 8).
   - Volatility Selection: Scans all 10 Volatilities (1HZ10V - 100V, R_10 - 100) for last digits equal to **0 or 1**.
   - Win Reset & Halving: On consecutive base wins, the stake is halved each win down to a floor limit of `1/4 * baseStake` (or minimum `$0.35`). Once the floor is hit, the stake resets back to `baseStake`.

2. **Graduated Recovery Ladder (Steps 1 to 5+)**:
   - **Step 1 (1st Recovery)**: **OVER 1 / UNDER 8** (Calibrated Divisor: `0.20`, Deriv net return ~20-23%).
   - **Step 2 (2nd Recovery)**: **OVER 2 / UNDER 7** (Calibrated Divisor: `0.36`, Deriv net return ~36-40%).
   - **Step 3 (3rd Recovery)**: **OVER 3 / UNDER 6** (Calibrated Divisor: `0.55`, Deriv net return ~55-60%).
   - **Step 4 (4th Recovery)**: **OVER 4 / UNDER 5** (Calibrated Divisor: `0.85`, Deriv net return ~85-92%).
   - **Step 5+ (5th Recovery and above)**: **PUTE/CALLE** (`rise` / `fall`) or **EVEN/ODD** (`even` / `odd`) (Calibrated Divisor: `0.85`, Deriv net return ~85-92%) using the multi-candidate statistical trend-momentum and parity scanners from Strategy R.

3. **Loss-Recovery Staking Formula**:
   Every recovery trade is sized so that a winning trade completely recoups all cumulative sequence losses plus guarantees a target profit equal to the base profit of the sequence, calibrated to account for broker house edge:
   $$\text{Stake} = \frac{\text{Accumulated Sequence Loss} + (0.23 \times \text{Sequence Base Stake})}{\text{Calibrated Tier Divisor}}$$
   - Using calibrated divisors (`0.20, 0.36, 0.55, 0.85, 0.85`) ensures that even with broker house margin, every win generates more net profit than the accumulated losses, ensuring a positive net balance.
   - If calculated stake is below `$0.35`, the minimum `$0.35` stake is applied.
   - On a recovery **Win**: All sequence losses are eliminated, target profit is secured, and the system resets immediately to base stake.

4. **Dynamic Cooldown Pacing**:
   Shares the scaled loss delay with Strategy R:
   - Initial / After Win: 5 to 8 ticks.
   - Per consecutive loss: `(5 + 5 * N)` to `(8 + 5 * N)` ticks.

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
