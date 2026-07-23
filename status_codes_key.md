# AI-Automation Loop: Status Code Reference Key

This document provides the mapping for the obfuscated status codes displayed under the Cooldown Timer in the Automation Panel. Use this as a reference for debugging and monitoring.

## 1. Primary Status Codes

| Code | Full Meaning | Description |
| :--- | :--- | :--- |
| **`IDLE_RDY`** | Idle & Ready | The system is active but no automation logic is currently running. |
| **`ATM_LIV`** | Automation Live | A contract has been proposed or purchased; awaiting settlement. |
| **`SKP_DIR`** | Skip Direction | Automation was skipped to avoid consecutive trades in the same direction on one symbol. |
| **`W8_TCK`** | Waiting for Ticks | System is waiting for a fresh tick stream before initiating analysis. |
| **`WD_CMP`** | Wind Down Complete | "Wind Down on Next Profit" was active and has finished successfully. |

## 2. Cooldown & Delay Codes

| Code | Full Meaning | Description |
| :--- | :--- | :--- |
| **`P_CD_{N}T`** | Positive Cooldown | A short delay of {N} ticks after a **Win**. |
| **`L_CD_{N}T`** | Loss Cooldown | A short delay of {N} ticks after a **Loss**. |
| **`B_CD_{N}M`** | Block Cooldown | A long interval pause of {N} minutes (Configured in Cooldown Interval). |

## 3. Error & Recovery Codes

| Code | Full Meaning | Description |
| :--- | :--- | :--- |
| **`PRP_TMO`** | Proposal Timeout | Deriv did not respond to a proposal request within 15s; system reset the lock. |
| **`WDT_RST`** | Watchdog Reset | The background watchdog found a stuck execution state and cleared it. |
| **`ERR_RTY`** | Error Retry | A general API error occurred; system is waiting before retrying. |

---
*Note: This file is for Admin reference only. Keep this file private to maintain Intellectual Property protection.*
