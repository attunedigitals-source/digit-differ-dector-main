# Trading Strategies A to G: Comprehensive Technical Documentation

This document outlines the underlying mathematical framework, individual strategies (Strategy A through Strategy G), and execution mechanics implemented in the **Digits AI Engine**.

---

## 1. Mathematical & Structural Foundation

All strategies (A to F) run on a continuous **12-trade cycle** composed of exactly **4 element types** (permutations of market contract directions):

*   **`U4`** (Digit Under 4): Barrier = `4`. Wins if the tick's last digit is **0, 1, 2, or 3** (probability = 40%).
*   **`O4`** (Digit Over 4): Barrier = `4`. Wins if the tick's last digit is **5, 6, 7, 8, or 9** (probability = 50%).
*   **`U5`** (Digit Under 5): Barrier = `5`. Wins if the tick's last digit is **0, 1, 2, 3, or 4** (probability = 50%).
*   **`O5`** (Digit Over 5): Barrier = `5`. Wins if the tick's last digit is **6, 7, 8, or 9** (probability = 40%).

### The Permutation Deck
In every 12-trade cycle, each of these elements is programmatically required to appear **exactly 3 times** (`[3, 3, 3, 3]`). This ensures a mathematically balanced distribution.
*   This constraint yields exactly **369,600 unique balanced permutations** of the 12-trade cycle:
    $$\frac{12!}{3! \times 3! \times 3! \times 3!} = 369,600$$
*   **LCG Cycle-Walking Bijection**: The bot traverses this deck of 369,600 arrangements using a Linear Congruential Generator (LCG) cycle-walking bijection seeded at the session level. This allows the system to walk through every unique arrangement in a pseudo-randomized path with **zero duplicate sequences** and **$O(1)$ memory complexity** without storing a massive array in RAM.

### Risk & Stake Management (Martingale)
*   **Base Stake**: The starting trade stake (e.g., $\$0.35$).
*   **Martingale Multiplier**: On a loss, the next stake is multiplied by **$1.8\times$** to recover the loss.
*   **Special Stake Factor**: If the active trade is a lower-probability "special" contract (`U5` or `O4` which have $50\%$ win probabilities but lower payouts), the bot applies an additional **$1.26\times$** multiplier to ensure payout coverage.
*   **On Win**: The martingale step resets to `0` and the stake resets to the base stake.

---

## 2. Technical Breakdown of Strategies A–F

Here is how each strategy determines when, where, and how to place its trades:

### Strategy A: Pre-Planned Cycles
*   **Core Concept**: Pure, path-based sequence walking through the LCG-shuffled 369,600 arrangement deck.
*   **Trade Execution**:
    *   The bot selects a random volatility index to distribute risk across different market conditions.
    *   It begins executing the 12-trade sequence (e.g. `U4 -> O5 -> U5 -> O4...`).
    *   **On Win**: Resets martingale to 0, increments `arrangementProgressIndex`, and pulls the next pre-planned arrangement from the LCG deck.
    *   **On Loss**: Tracks the consecutive loss prefix (e.g., if it loses step 1 and step 2, the prefix is `["U4", "O5"]`). It dynamically pools all valid permutations from the 369,600 database that start with that exact prefix, draws a new arrangement at random from this pooled subset, and uses it to complete the remainder of the 12-trade cycle.

### Strategy B: Sticky Loss Cycles
*   **Core Concept**: Sequence-walking with index lock-in during drawdowns.
*   **Trade Execution**:
    *   Runs the same LCG-walking sequence as Strategy A.
    *   **Sticky Behavior**: On a loss, instead of swapping volatility symbols, the bot **locks on to the current Volatility Index symbol**. It executes the remaining trades of the arrangement sequence on that *same* symbol to ride out consecutive losses on the same index, preventing the fragmentation of loss streaks across different markets.
    *   **On Win**: Swaps the symbol to a new one, advances to the next 12-trade arrangement, and resets the Martingale step.

### Strategy C: Sticky Loss + Suspension (Deferred Suspension)
*   **Core Concept**: Sticky trading combined with delayed safety cooldowns for highly chaotic indexes.
*   **Trade Execution**:
    *   Like Strategy B, the bot remains sticky to a single volatility index during consecutive losses to close out the Martingale cycle.
    *   **Deferred Suspension**: If a volatility index triggers **5 consecutive losses**, the system marks it as `pendingSuspension` instead of suspending it immediately. This allows the current Martingale cycle to complete on the same index without transferring accumulated debt to a new index under unproven market states.
    *   **Post-Win Cooldown**: The moment the index registers a win and successfully recovers the martingale run, the deferred suspension is enacted. The volatility index is blacklisted from selection for a random period of **5 to 10 minutes** to allow the market to stabilize.

### Strategy D: Immediate Suspension
*   **Core Concept**: Aggressive risk mitigation that prioritizes immediate index abandonment during market drawdowns.
*   **Trade Execution**:
    *   **Immediate Action**: If a volatility index triggers **5 consecutive losses** during the normal martingale phase (`martingaleStep < 5`), the bot **suspends the index immediately** for a random period of **5 to 10 minutes**.
    *   **High-Sensitivity Phase**: If the bot enters a deeper martingale phase (`martingaleStep >= 5`), the threshold tightens, and the index is suspended immediately after only **2 consecutive losses**.
    *   **Immediate Swap**: The bot instantly resets its index loss counter, sets a `forceSwapSymbol` flag, and selects a new active volatility index to handle the next high-stake trade.

### Strategy E: God Mode - Multi-Strategy Arbitrage
*   **Core Concept**: The premium engine, using real-time mathematical market state classification, probability overlays, and drawdown reducers.
*   **Trade Execution**:
    *   **Market State Classification**: Evaluates the Standard Deviation (SD) of last-digit frequencies over the last 50 ticks:
        *   `SD > 2.0` $\rightarrow$ Classified as **Chaotic/Dynamic**.
        *   `SD <= 2.0` $\rightarrow$ Classified as **Stable/Mean-Reverting**.
    *   **Adaptive Suspensions**: If a symbol hits 5 consecutive losses under a *Chaotic* state, it is suspended **immediately** (Strategy D behavior). If it hits 5 losses under a *Stable* state, it enters **Deferred Suspension** (Strategy C behavior) to exploit the reversion.
    *   **Real-time Probability Overlay**: Monitors last-digit distributions. If the arrangement dictates `U4` but `O5` is statistically overdue based on the last 25 ticks (e.g. `U4` occurred $\ge 13$ times and `O5` occurred $\le 7$ times), it overrides the planned sequence to execute `O5` (and vice-versa for `U5`/`O4`).
    *   **Drawdown Reducer**: At deep steps (`martingaleStep >= 5`), it automatically upgrades elements to safer versions (`U5 -> U4` and `O4 -> O5`) and drops the Martingale multiplier to **$1.45\times$** to prevent exponential stake explosion.
    *   **Smart Entry Filter**: Integrates with a live tick-digit signal engine. If a "Danger Digit" is predicted with high confidence ($\ge 70\%$) inside the planned trade's win zone, the bot **delays trade entry by 2 seconds** (skipping the tick).
    *   **Intelligent Volatility Selector**: Prioritizes symbols with the highest mean-reverting properties.

### Strategy F: Sticky + Deferred Suspension + Prefix Elimination
*   **Core Concept**: Builds on Strategy C (Deferred Suspension) by adding a real-time pattern-elimination engine that blacklists underperforming sequence prefixes.
*   **Trade Execution**:
    *   Tracks the first **5 elements** of the current arrangement as a **prefix** (e.g. `["U4", "O4", "U4", "O5", "U5"]`).
    *   **Prefix Elimination**: If a volatility symbol suffers **5 consecutive losses** using a specific 5-element prefix, that prefix is **permanently blacklisted** specifically for that symbol. The bot then discards the current arrangement, shuffles a brand new one, and forces a swap to a different symbol.
    *   **Arrangement Pool Filtering**: When drawing a new arrangement from the 369,600 deck, Strategy F checks if the arrangement's prefix is blacklisted on the chosen symbol. If it is blacklisted everywhere, the LCG walks to the next arrangement until a valid one is found, completely filtering out failing configurations.
    *   **Intelligent Swap**: When a symbol swap is forced, it selects from symbols with the fewest blacklisted prefixes.

### Strategy G: Pre-Planned + Session Prefix Elimination
*   **Core Concept**: A modification of Strategy A (Pre-Planned Cycles) that introduces a global session-wide prefix blacklist to permanently eliminate failing 12-trade arrangement sequences in real-time.
*   **Trade Execution**:
    *   **Purely Random Volatility Selection**: Unlike other strategies that use consecutive loss statistics to prioritize symbols, Strategy G selects a volatility symbol purely randomly after every trade.
    *   **No Back-to-Back Duplicates**: It automatically filters out the last traded volatility symbol from the active candidate pool to guarantee that the same volatility is never selected back-to-back.
    *   **Global Session Blacklisting**: When the bot encounters **5 consecutive losses** in its current Martingale run, the active 5-element prefix of the arrangement is **blacklisted globally** (for the entire session).
    *   **Arrangement Pool Filtering**: Once blacklisted globally, any arrangement starting with that 5-element prefix is barred from selection. The bot immediately discards the current arrangement, shuffles a brand new arrangement that has a clean, non-blacklisted prefix, and resets the Martingale cycle.

### Strategy H: Fibonacci Trade Engine
*   **Core Concept**: A mathematical, sequence-driven walking engine that executes trades along the Fibonacci sequence mapped modulo 4, entirely independent of win/loss streaks, paired with a randomized non-duplicate volatility selector.
*   **Trade Execution**:
    *   **Purely Random Volatility Selection**: Selects a volatility symbol purely randomly after every single trade, filtering out the active symbol to ensure the same volatility is never traded back-to-back.
    *   **Fibonacci-Mapped Walk**: Tracks the current Fibonacci index $k$ in the session state.
    *   **Modulo 4 Mapping**: Map the $k$-th Fibonacci number $F(k)$ to one of the 4 contract directions based on $F(k) \pmod 4$:
        *   `0`: **`U4`** (Digit Under 4)
        *   `1`: **`O5`** (Digit Over 5)
        *   `2`: **`U5`** (Digit Under 5)
        *   `3`: **`O4`** (Digit Over 4)
    *   **Seeding (First Trade)**: Starts by randomly selecting one of the four contract directions, which seeds the starting Fibonacci index $k$:
        *   `U4` $\rightarrow$ $k = 0$ ($F(0) = 0$)
        *   `O5` $\rightarrow$ $k = 1$ ($F(1) = 1$)
        *   `U5` $\rightarrow$ $k = 3$ ($F(3) = 2$)
        *   `O4` $\rightarrow$ $k = 4$ ($F(4) = 3$)
    *   **Uninterrupted Progression**: The Fibonacci index $k$ increments by exactly 1 after every trade. Wins or losses do not pause, skip, or reset this mathematical walk, maintaining a continuous path.

---

## 3. Comparative Summary

| Feature / Strategy | Strategy A | Strategy B | Strategy C | Strategy D | Strategy E (God Mode) | Strategy F | Strategy G | Strategy H |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Vol. Index Lock-on on Loss** | No (Random) | Yes (Sticky) | Yes (Sticky) | Yes (until threshold) | Adaptive | Yes (until 5th loss) | No (Random) | No (Random) |
| **Suspension Trigger** | None | None | Deferred (5 losses) | Immediate (5 losses / 2 losses) | Hybrid (SD-based) | Deferred + Force Swap | None | None |
| **Drawdown Reducers** | No | No | No | No | Yes (Upgrades barriers + 1.45x) | No | No | No |
| **Probability Overlays** | No | No | No | No | Yes (Dynamic 25-tick overlay) | No | No | No |
| **Smart Entry Filter** | No | No | No | No | Yes (2s delay on danger digit) | No | No | No |
| **Pattern Elimination** | No | No | No | No | No | Yes (Symbol-specific prefix) | Yes (Global session prefix) | No |
| **Trade Progression Path** | LCG arrangement deck | LCG arrangement deck | LCG arrangement deck | LCG arrangement deck | LCG arrangement deck with dynamic upgrades | LCG arrangement deck with blacklists | LCG arrangement deck with global blacklists | Fibonacci modulo 4 progression |

