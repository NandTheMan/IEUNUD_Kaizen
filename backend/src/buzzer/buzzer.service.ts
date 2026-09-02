import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { BUZZER_CONFIG, BuzzerConfig } from './buzzer.config';
import { BuzzerState, BuzzerStatus } from './buzzer.types';

interface InternalBuzzerSession {
  sessionId: number;
  config: BuzzerConfig;
  currentBuzzer: number;
  status: BuzzerStatus;
  startedAt: Date | null;
  currentBuzzerStartedAt: Date | null;
  timer: NodeJS.Timeout | null;
  pausedRemainingMs: number | null;
}

@Injectable()
export class BuzzerService implements OnModuleDestroy {
  private readonly logger = new Logger(BuzzerService.name);
  private sessions = new Map<number, InternalBuzzerSession>();
  private onFinalBuzzerCallback?: (sessionId: number) => Promise<void> | void;

  constructor(private readonly eventsGateway: EventsGateway) {}

  onModuleDestroy() {
    this.sessions.forEach((session) => {
      if (session.timer) clearTimeout(session.timer);
    });
    this.sessions.clear();
  }

  /**
   * Registers a callback to be invoked when the final buzzer concludes and
   * autoEndOnFinalBuzzer is enabled.
   */
  registerOnFinalBuzzerCallback(cb: (sessionId: number) => Promise<void> | void) {
    this.onFinalBuzzerCallback = cb;
  }

  /**
   * Initializes a session in Buzzer 0 state (ready / waiting for PPIC order).
   */
  initBuzzer(sessionId: number, customConfig?: Partial<BuzzerConfig>): BuzzerState {
    this.clearSessionTimer(sessionId);

    const config: BuzzerConfig = {
      ...BUZZER_CONFIG,
      ...customConfig,
    };

    const session: InternalBuzzerSession = {
      sessionId,
      config,
      currentBuzzer: 0,
      status: 'INITIALIZED',
      startedAt: null,
      currentBuzzerStartedAt: null,
      timer: null,
      pausedRemainingMs: null,
    };

    this.sessions.set(sessionId, session);
    const state = this.getBuzzerState(sessionId);
    this.eventsGateway.broadcastBuzzerUpdate(state);
    this.logger.log(`Buzzer initialized for session ${sessionId} (Buzzer 0/ ${config.totalBuzzers}, interval: ${config.intervalSeconds}s)`);
    return state;
  }

  /**
   * Starts Buzzer 1 and begins autonomous timer progression.
   * Typically triggered when PPIC places the initial order.
   */
  startBuzzer(sessionId: number): BuzzerState {
    let session = this.sessions.get(sessionId);
    if (!session) {
      this.initBuzzer(sessionId);
      session = this.sessions.get(sessionId)!;
    }

    if (session.status === 'RUNNING') {
      return this.getBuzzerState(sessionId);
    }

    const now = new Date();
    session.currentBuzzer = 1;
    session.status = 'RUNNING';
    session.startedAt = now;
    session.currentBuzzerStartedAt = now;
    session.pausedRemainingMs = null;

    const state = this.getBuzzerState(sessionId);
    this.eventsGateway.broadcastBuzzerTick(state);
    this.eventsGateway.broadcastBuzzerUpdate(state);
    this.logger.log(`Buzzer 1 started for session ${sessionId}. Next buzzer in ${session.config.intervalSeconds}s.`);

    this.scheduleNextTick(session, session.config.intervalSeconds * 1000);
    return state;
  }

  /**
   * Moves the buzzer from N to N+1 autonomously or finishes on the final buzzer.
   */
  private handleBuzzerTick(sessionId: number) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'RUNNING') return;

    if (session.currentBuzzer < session.config.totalBuzzers) {
      session.currentBuzzer += 1;
      session.currentBuzzerStartedAt = new Date();

      const state = this.getBuzzerState(sessionId);
      this.eventsGateway.broadcastBuzzerTick(state);
      this.eventsGateway.broadcastBuzzerUpdate(state);
      this.logger.log(`Buzzer ${session.currentBuzzer}/${session.config.totalBuzzers} triggered for session ${sessionId}`);

      this.scheduleNextTick(session, session.config.intervalSeconds * 1000);
    } else {
      // Reached the end of the final buzzer
      session.status = 'COMPLETED';
      this.clearSessionTimer(sessionId);

      const state = this.getBuzzerState(sessionId);
      this.eventsGateway.broadcastBuzzerCompleted(state);
      this.eventsGateway.broadcastBuzzerUpdate(state);
      this.logger.log(`Final Buzzer (${session.config.totalBuzzers}) completed for session ${sessionId}`);

      if (session.config.autoEndOnFinalBuzzer && this.onFinalBuzzerCallback) {
        this.logger.log(`Auto-ending session ${sessionId} after final buzzer completion.`);
        Promise.resolve(this.onFinalBuzzerCallback(sessionId)).catch((err) => {
          this.logger.error(`Error in onFinalBuzzerCallback for session ${sessionId}:`, err);
        });
      }
    }
  }

  private scheduleNextTick(session: InternalBuzzerSession, delayMs: number) {
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.handleBuzzerTick(session.sessionId);
    }, delayMs);
  }

  /**
   * Pauses the active buzzer timer.
   */
  pauseBuzzer(sessionId: number): BuzzerState {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'RUNNING' || !session.currentBuzzerStartedAt) {
      return this.getBuzzerState(sessionId);
    }

    const elapsedMs = Date.now() - session.currentBuzzerStartedAt.getTime();
    const totalDurationMs = session.config.intervalSeconds * 1000;
    session.pausedRemainingMs = Math.max(0, totalDurationMs - elapsedMs);

    this.clearSessionTimer(sessionId);
    session.status = 'PAUSED';

    const state = this.getBuzzerState(sessionId);
    this.eventsGateway.broadcastBuzzerUpdate(state);
    return state;
  }

  /**
   * Resumes a paused buzzer timer.
   */
  resumeBuzzer(sessionId: number): BuzzerState {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'PAUSED') {
      return this.getBuzzerState(sessionId);
    }

    const remainingMs = session.pausedRemainingMs ?? session.config.intervalSeconds * 1000;
    session.status = 'RUNNING';
    session.currentBuzzerStartedAt = new Date(Date.now() - (session.config.intervalSeconds * 1000 - remainingMs));
    session.pausedRemainingMs = null;

    this.scheduleNextTick(session, remainingMs);
    const state = this.getBuzzerState(sessionId);
    this.eventsGateway.broadcastBuzzerUpdate(state);
    return state;
  }

  /**
   * Resets the buzzer back to Buzzer 0 (initialized).
   */
  resetBuzzer(sessionId: number): BuzzerState {
    const session = this.sessions.get(sessionId);
    const config = session ? session.config : BUZZER_CONFIG;
    return this.initBuzzer(sessionId, config);
  }

  /**
   * Stops and cleans up any running timer for a session.
   */
  stopBuzzer(sessionId: number) {
    this.clearSessionTimer(sessionId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'COMPLETED';
      const state = this.getBuzzerState(sessionId);
      this.eventsGateway.broadcastBuzzerUpdate(state);
    }
  }

  /**
   * Retrieves the real-time computed state for a session.
   */
  getBuzzerState(sessionId: number): BuzzerState {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        sessionId,
        currentBuzzer: 0,
        totalBuzzers: BUZZER_CONFIG.totalBuzzers,
        intervalSeconds: BUZZER_CONFIG.intervalSeconds,
        status: 'IDLE',
        startedAt: null,
        currentBuzzerStartedAt: null,
        nextBuzzerAt: null,
        elapsedSecondsInCurrentBuzzer: 0,
        remainingSecondsInCurrentBuzzer: BUZZER_CONFIG.intervalSeconds,
        totalElapsedSeconds: 0,
        autoEndOnFinalBuzzer: BUZZER_CONFIG.autoEndOnFinalBuzzer,
      };
    }

    let elapsedInCurrent = 0;
    let remainingInCurrent = session.config.intervalSeconds;
    let totalElapsed = 0;
    let nextBuzzerAt: string | null = null;

    if (session.status === 'RUNNING' && session.currentBuzzerStartedAt) {
      const nowMs = Date.now();
      const currentStartMs = session.currentBuzzerStartedAt.getTime();
      elapsedInCurrent = Math.min(
        session.config.intervalSeconds,
        Math.floor((nowMs - currentStartMs) / 1000)
      );
      remainingInCurrent = Math.max(0, session.config.intervalSeconds - elapsedInCurrent);
      nextBuzzerAt = new Date(currentStartMs + session.config.intervalSeconds * 1000).toISOString();

      if (session.startedAt) {
        totalElapsed = Math.floor((nowMs - session.startedAt.getTime()) / 1000);
      }
    } else if (session.status === 'PAUSED' && session.pausedRemainingMs !== null) {
      remainingInCurrent = Math.ceil(session.pausedRemainingMs / 1000);
      elapsedInCurrent = session.config.intervalSeconds - remainingInCurrent;
    }

    return {
      sessionId,
      currentBuzzer: session.currentBuzzer,
      totalBuzzers: session.config.totalBuzzers,
      intervalSeconds: session.config.intervalSeconds,
      status: session.status,
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
      currentBuzzerStartedAt: session.currentBuzzerStartedAt ? session.currentBuzzerStartedAt.toISOString() : null,
      nextBuzzerAt,
      elapsedSecondsInCurrentBuzzer: elapsedInCurrent,
      remainingSecondsInCurrentBuzzer: remainingInCurrent,
      totalElapsedSeconds: totalElapsed,
      autoEndOnFinalBuzzer: session.config.autoEndOnFinalBuzzer,
    };
  }

  private clearSessionTimer(sessionId: number) {
    const session = this.sessions.get(sessionId);
    if (session?.timer) {
      clearTimeout(session.timer);
      session.timer = null;
    }
  }
}
