export interface Attribution {
  author: string;
  work: string;
  year: number;
  essay: string;
}

export interface Level {
  id: number;
  tier: number;
  /** Per character of `solution`: cipher number 1-26 for letters, -1 otherwise. */
  cipher: number[];
  solution: string;
  /** Cell indices pre-filled with their solution letter. Other cells of the
   * same cipher number start empty: the player fills each one by hand. */
  revealedIndices: number[];
  /** Letter-cell indices whose cipher number starts hidden. */
  lockedIndices: number[];
  /** Optional per-locked-index unlock direction ("left" | "right"); absent means both. */
  halfLocked?: Record<string, 'left' | 'right'>;
  attribution: Attribution;
}

export interface BatchInfo {
  index: number;
  file: string;
  sha256: string;
  levelIds: [number, number];
}

export interface Manifest {
  dataVersion: string;
  totalLevels: number;
  batchSize: number;
  batches: BatchInfo[];
}

export interface Batch {
  levels: Level[];
}
