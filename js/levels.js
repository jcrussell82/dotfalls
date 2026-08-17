// ---------------------------------------------------------
// Level definitions.
//
// Per the design decision: each level requires keeping a
// minimum number of dots alive simultaneously when the timer
// reaches zero. The game ends immediately if all dots are
// lost before the timer expires. Difficulty comes purely
// from the player's own choice to split more dots — there
// are no obstacles or enemies.
// ---------------------------------------------------------

const Levels = [
  { level: 1, duration: 20, required: 1, gravity: 165 },
  { level: 2, duration: 20, required: 2, gravity: 172 },
  { level: 3, duration: 20, required: 3, gravity: 180 },
  { level: 4, duration: 24, required: 4, gravity: 188 },
  { level: 5, duration: 24, required: 5, gravity: 196 },
  { level: 6, duration: 28, required: 6, gravity: 204 },
  { level: 7, duration: 28, required: 7, gravity: 212 },
  { level: 8, duration: 32, required: 8, gravity: 220 },
];

function getLevelConfig(levelNumber) {
  if (levelNumber <= Levels.length) return Levels[levelNumber - 1];
  // Beyond the authored list, keep extending the same curve indefinitely.
  const last = Levels[Levels.length - 1];
  const extra = levelNumber - Levels.length;
  return {
    level: levelNumber,
    duration: Math.min(45, last.duration + extra * 2),
    required: last.required + extra,
    gravity: Math.min(320, last.gravity + extra * 8),
  };
}
