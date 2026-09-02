/**
 * Configuration constants for the modular Toyota Production System (TPS) buzzer framework.
 *
 * Customize these constants or pass overrides per session to adjust takt intervals,
 * number of buzzer cycles, and end-of-game behavior.
 */

export interface BuzzerConfig {
  /**
   * Total number of buzzers in a game cycle (e.g. 12 buzzers).
   */
  totalBuzzers: number;

  /**
   * Interval duration in seconds between each buzzer (e.g. 90 seconds).
   */
  intervalSeconds: number;

  /**
   * Whether reaching the end of the final buzzer (e.g. buzzer 12) automatically finishes
   * and shuts off the session.
   */
  autoEndOnFinalBuzzer: boolean;
}

export const BUZZER_CONFIG: BuzzerConfig = {
  /**
   * Default total number of buzzers (Buzzer 1 through Buzzer 12).
   */
  totalBuzzers: 12,

  /**
   * Default interval between each buzzer in seconds (90s takt time pitch).
   */
  intervalSeconds: 90,

  /**
   * If true, concluding the final buzzer (e.g. Buzzer 12) will automatically call
   * stopActive() on the session and broadcast 'session_finished'.
   * If false, the session stays active in COMPLETED buzzer state.
   */
  autoEndOnFinalBuzzer: true,
};
