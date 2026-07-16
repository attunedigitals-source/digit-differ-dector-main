# Strategy R: Comprehensive Technical Documentation

This document outlines the underlying mathematical framework, contract selection rules, dynamic staking mechanics, and volatility management implemented in **Strategy R** of the Digits AI Engine.

---

## 1. Core Mechanics & Contract Selection

Strategy R divides trading execution into two distinct logical states based on the outcome of the preceding trade: the **Base Phase** (Step 0) and the **Recovery Phase** (Steps 1+).

### A. Base Phase (Step 0)
When starting a session or immediately following any winning trade, the system operates in the Base Phase. It trades high-probability contract directions to build target profit:

*   **`over1`** (Digit Over 1): Barrier = `1`. Wins if the tick's last digit is **2, 3, 4, 5, 6, 7, 8, or 9** (probability = 80%, payout multiplier = $1.25\times$).
*   **`under8`** (Digit Under 8): Barrier = `8`. Wins if the tick's last digit is **0, 1, 2, 3, 4, 5, 6, or 7** (probability = 80%, payout multiplier = $1.25\times$).

The active base direction is selected randomly from this pool on every Step 0 trade.

### B. Recovery Phase (Steps 1+)
Upon experiencing a loss, the bot enters the Recovery Phase. In this state, it expands the selection pool to include special contract types with alternative barrier conditions and probability profiles to aggressively target drawdown recovery.

The recovery pool includes 8 contract directions:
1.  **`over5`** (Digit Over 5): Barrier = `5`. Wins if the tick's last digit is **6, 7, 8, or 9** (probability = 40%, payout multiplier = $2.50\times$).
2.  **`under4`** (Digit Under 4): Barrier = `4`. Wins if the tick's last digit is **0, 1, 2, or 3** (probability = 40%, payout multiplier = $2.50\times$).
3.  **`under5`** (Digit Under 5): Barrier = `5`. Wins if the tick's last digit is **0, 1, 2, 3, or 4** (probability = 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.
4.  **`over4`** (Digit Over 4): Barrier = `4`. Wins if the tick's last digit is **5, 6, 7, 8, or 9** (probability = 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.
5.  **`even`** (Digit Even): Wins if the tick's last digit is **0, 2, 4, 6, or 8** (probability = 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.
6.  **`odd`** (Digit Odd): Wins if the tick's last digit is **1, 3, 5, 7, or 9** (probability = 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.
7.  **`rise`** (Digit Rise): Wins if the current tick is higher than the previous tick (probability $\approx$ 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.
8.  **`fall`** (Digit Fall): Wins if the current tick is lower than the previous tick (probability $\approx$ 50%, payout multiplier = $2.00\times$) — *Special Markup Contract*.

#### Exclusions Rules
To prevent entering predictable drawdown patterns, the bot filters the recovery pool to **exclude the immediately preceding trade category**, ensuring that the same contract direction is never selected back-to-back.

---

## 2. Dynamic Staking (Martingale & Payout Markup)

Strategy R features an advanced staking engine designed to fully recover accumulated losses while targeting a guaranteed **22% profit** on the sequence's base stake.

### A. Base Stake & Win Halving
*   **Initialization**: The bot begins trading at the client's configured `baseStake`.
*   **Win Scaling (Halving)**: To secure profits and reduce exposure during positive streaks, the bot halves the stake (`currentStake / 2`) after a win, provided the resulting stake does not fall below the minimum allowed trade stake of **$0.35**. If halving drops the stake below $0.35$, or if the preceding stake was higher than the user's `baseStake`, it resets to `baseStake`.

### B. Recovery Stake Calculation
When in the Recovery Phase (Step 1+), Strategy R determines the next stake dynamically based on the type of contract selected:

#### 1. Step 1 (First Loss Recovery)
The next stake is calculated from the base stake of the sequence. If the randomly chosen recovery direction is a **Special Markup Contract** ($50\%$ win probability but lower $2.0\times$ payout), the stake is scaled by a **$1.26\times$ markup multiplier**:
$$\text{Stake} = \text{SequenceBaseStake} \times 1.26$$
Otherwise, it remains at the sequence base stake.

#### 2. Step 2+ (Deep Recovery)
For subsequent steps in the drawdown, the stake is calculated using the accumulated loss of the current run plus a targeted profit margin, divided by the payout multiplier coefficient:
$$\text{Stake} = \frac{\text{AccumulatedLoss} + 0.22 \times \text{SequenceBaseStake}}{\text{Divisor}}$$

*   **For Normal Recovery Contracts** (`over5`, `under4`): Divisor = **$1.381$** (reflecting $2.5\times$ payout).
*   **For Special Markup Contracts** (`under5`, `over4`, `even`, `odd`, `rise`, `fall`): Divisor = **$0.90$** (reflecting $2.0\times$ payout).

This mathematical formula guarantees that a single win anywhere in the recovery phase completely clears all losses in the current sequence and registers the targeted profit.

---

## 3. Volatility Management (Sticky Volatility)

When Stickiness is enabled, Strategy R manages market risk by switching or locking onto volatility indexes (symbols) in pseudo-random cycles of **3 to 5 runs**.

On initialization or when a cycle count expires, the bot randomly chooses a volatility mode from three options (excluding the previously active mode to prevent back-to-back duplicates):

1.  **`win_sticky`** (Win Sticky):
    *   The bot remains on the same volatility index when winning or idle.
    *   On a win/idle, the run counter decrements. If the run count expires, a new mode and symbol are selected.
    *   If a loss is registered, it immediately triggers an early transition (switches the volatility symbol and selects a new mode and count).
2.  **`loss_sticky`** (Loss Sticky):
    *   The bot remains on the same volatility index when experiencing a loss (during the recovery phase) to ride out drawdowns in a single market without spreading debt across different indexes.
    *   On a loss, the run counter decrements. If the run count expires, a new mode and symbol are selected.
    *   If a win/idle is registered, it immediately triggers an early transition (switches volatility symbol and selects a new mode and count).
3.  **`none_sticky`** (None Sticky):
    *   The bot switches the volatility index on *every single trade* regardless of win or loss.
    *   The run counter decrements on each trade. When the count expires, a new mode and symbol are selected.
