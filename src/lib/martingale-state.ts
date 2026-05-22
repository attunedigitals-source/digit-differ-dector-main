export type MartingaleSettlementStatus = "WIN" | "LOSS";

export type MartingaleSessionState = {
  currentStake: number;
  martingaleStep: number;
  sequenceStep: number;
  status: MartingaleSettlementStatus | "IDLE" | "SKIP" | "PENDING";
  nextAction: string;
};

export type SettledTradeSnapshot = {
  stake: number;
  martingaleStep: number;
  sequenceStep: number;
};

export const resolveSettledMartingaleState = <TState extends MartingaleSessionState>(
  state: TState,
  snapshot: SettledTradeSnapshot,
  isWin: boolean,
  baseStake: number,
  nextAction: string
): TState => ({
  ...state,
  status: isWin ? "WIN" : "LOSS",
  nextAction,
  currentStake: isWin ? baseStake : snapshot.stake,
  martingaleStep: isWin ? 0 : snapshot.martingaleStep,
  sequenceStep: isWin ? 0 : snapshot.sequenceStep,
});
