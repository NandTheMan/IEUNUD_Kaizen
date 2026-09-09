export type BuzzerStatus = 'IDLE' | 'INITIALIZED' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

export interface BuzzerState {
  sessionId: number;
  /**
   * Current active buzzer number.
   * 0 = Initialized / Ready (before PPIC starts production)
   * 1..totalBuzzers = Running buzzer step
   */
  currentBuzzer: number;
  totalBuzzers: number;
  intervalSeconds: number;
  status: BuzzerStatus;
  startedAt: string | null;
  currentBuzzerStartedAt: string | null;
  nextBuzzerAt: string | null;
  elapsedSecondsInCurrentBuzzer: number;
  remainingSecondsInCurrentBuzzer: number;
  totalElapsedSeconds: number;
  autoEndOnFinalBuzzer: boolean;
}
