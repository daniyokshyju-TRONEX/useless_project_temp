// ============================================================================
// UNPREDICTABLE - Level Definitions & Procedural Solvability
// 5 Handcrafted levels featuring psychological traps, secret room rules,
// checkpoints, keys, and solvable procedural variations.
// ============================================================================

import { validateLevel } from './collision.js';

// Base builder function for level schemas
function createLevel({
  id,
  name,
  subtitle,
  map,
  start,
  exit,
  key,
  requiresKey = true,
  checkpoints = [],
  traps = [],
  zones = [],
  enemies = [],
  movingWalls = [],
  tempWalls = [],
  keys,
  requiredKeys
}) {
  const levelKeys = Array.isArray(keys) && keys.length ? keys : (key ? [key] : []);

  return {
    id,
    name,
    subtitle,
    map,
    width: map[0].length,
    height: map.length,
    start,
    exit,
    key: key || levelKeys[0] || null,
    keys: levelKeys,
    requiresKey,
    requiredKeys: requiredKeys ?? levelKeys.length,
    checkpoints,
    traps,
    zones,
    enemies,
    movingWalls,
    tempWalls
  };
}

function pickRandomFloorTiles(level, count, avoid = []) {
  const blocked = new Set(avoid.map(({ x, y }) => `${x},${y}`));
  const choices = [];

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.map[y][x] === '#') continue;
      const key = `${x},${y}`;
      if (blocked.has(key)) continue;
      if (x === level.start.x && y === level.start.y) continue;
      if (x === level.exit.x && y === level.exit.y) continue;
      choices.push({ x, y });
    }
  }

  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return choices.slice(0, count);
}

function generateLevelKeys(level, targetCount = 4) {
  const primary = Array.isArray(level.keys) && level.keys.length ? [...level.keys] : (level.key ? [level.key] : []);
  const avoid = [...primary, level.start, level.exit];
  const extras = pickRandomFloorTiles(level, Math.max(0, targetCount - primary.length), avoid);
  const allKeys = [...primary, ...extras].slice(0, targetCount);

  level.keys = allKeys;
  level.key = allKeys[0] || level.key || null;
  level.requiredKeys = level.requiredKeys ?? allKeys.length;
  return level;
}

function randomizeTrapPositions(level) {
  if (!level.traps || !level.traps.length) return;

  const avoid = [level.start, level.exit, ...(level.keys || [])];
  const original = [...level.traps];

  level.traps = original.map((trap) => {
    const candidate = pickRandomFloorTiles(level, 1, [
      ...avoid,
      ...original.filter(t => t !== trap).map(({ x, y }) => ({ x, y }))
    ])[0];

    if (!candidate) return trap;
    return { ...trap, x: candidate.x, y: candidate.y };
  });
}

// ----------------------------------------------------------------------------
// LEVEL 1: FIRST IMPRESSION (Teaching + Inversion Surprise)
// Teaches standard movement, introduces spike timing, a checkpoint, and
// collecting the key flips controls to REVERSED while waking up new traps.
// ----------------------------------------------------------------------------
const LEVEL_1_MAP = [
  '#############',
  '#S..#.......#',
  '#.#.#.#####.#',
  '#.#...#...#.#',
  '#.#####.#.#.#',
  '#.......#...#',
  '#####.#####.#',
  '#...#.#.....#',
  '#.#.#.#.###.#',
  '#.#...#.#...#',
  '#.#####.#.#.#',
  '#.........#E#',
  '#############'
];

const LEVEL_1 = createLevel({
  id: 1,
  name: 'FIRST IMPRESSION',
  subtitle: 'LEARN THE RULES / PREPARE FOR BETRAYAL',
  map: LEVEL_1_MAP,
  start: { x: 1, y: 1 },
  exit: { x: 11, y: 11 },
  key: { x: 11, y: 1 },
  requiresKey: true,
  checkpoints: [
    { x: 5, y: 5, name: 'CENTRAL HALL' }
  ],
  traps: [
    { x: 3, y: 1, type: 'spike', label: 'A SUDDEN SPIKE' },
    { x: 7, y: 5, type: 'fake-safe', label: 'SAFE WAS AN ILLUSION' },
    { x: 9, y: 9, type: 'spike', label: 'SURPRISE DEFENSE' }
  ],
  zones: [
    { x: 3, y: 5, mode: 'NORMAL' }
  ]
});

// ----------------------------------------------------------------------------
// LEVEL 2: THE SECOND GUESS (Rotated Chambers & Fake Safe Paths)
// Contains two distinct puzzle chambers:
// - East Wing: Always ROTATED_RIGHT (Up->Right, Right->Down, etc.)
// - South Hallway: ROTATED_LEFT
// Observant players can memorize the consistent room rotation rules.
// ----------------------------------------------------------------------------
const LEVEL_2_MAP = [
  '#############',
  '#S..#.......#',
  '#.#.###.###.#',
  '#.#...#.#...#',
  '#.###.#.#.###',
  '#...#.#.#...#',
  '###.#.#.###.#',
  '#...#.....#.#',
  '#.#######.#.#',
  '#.#.....#.#.#',
  '#.#.###.#.#.#',
  '#...#.....#E#',
  '#############'
];

const LEVEL_2 = createLevel({
  id: 2,
  name: 'THE SECOND GUESS',
  subtitle: 'GEOMETRIC ROTATIONS & DECEPTIVE FLOORS',
  map: LEVEL_2_MAP,
  start: { x: 1, y: 1 },
  exit: { x: 11, y: 11 },
  key: { x: 11, y: 3 },
  requiresKey: true,
  checkpoints: [
    { x: 5, y: 7, name: 'CROSSROAD' }
  ],
  traps: [
    { x: 3, y: 1, type: 'fake-safe', label: 'FLOOR COLLAPSED' },
    { x: 9, y: 1, type: 'direction', mode: 'ROTATED_RIGHT', label: 'EAST WING: 90Â° ROTATION' },
    { x: 3, y: 7, type: 'falling', delay: 800, label: 'CRUMBLING RUNWAY' },
    { x: 1, y: 9, type: 'direction', mode: 'ROTATED_LEFT', label: 'WEST SHAFT: COUNTER-ROTATION' },
    { x: 7, y: 11, type: 'twist', twist: 'rotate-right', label: 'TWIST TILE APPLIED' },
    { x: 5, y: 3, type: 'one-way', direction: 'down', label: 'ONE-WAY SHAFT' }
  ],
  zones: [
    { x: 9, y: 3, mode: 'ROTATED_RIGHT' },
    { x: 1, y: 7, mode: 'ROTATED_LEFT' }
  ]
});

// ----------------------------------------------------------------------------
// LEVEL 3: TIME & SPACE (Delayed Input Trap & Teleport Rift)
// Introduces the 500ms input delay queue where moves execute after a beat.
// Features a Decoy Fake Exit that punishes hasty navigation, and teleport rifts.
// ----------------------------------------------------------------------------
const LEVEL_3_MAP = [
  '#############',
  '#S..#.......#',
  '#.#.#.#####.#',
  '#.#...#...#.#',
  '#.#####.#.#.#',
  '#.#.....#...#',
  '#.#.#####.###',
  '#...#.......#',
  '#####.#####.#',
  '#...#.#...#.#',
  '#.#.#.#.#.#.#',
  '#.#.....#.#E#',
  '#############'
];

const LEVEL_3 = createLevel({
  id: 3,
  name: 'TIME & SPACE',
  subtitle: 'DELAYED NERVES & FOLDED DIMENSIONS',
  map: LEVEL_3_MAP,
  start: { x: 1, y: 1 },
  exit: { x: 11, y: 11 },
  key: { x: 1, y: 11 },
  requiresKey: true,
  checkpoints: [
    { x: 7, y: 7, name: 'RIFT CHAMBER' }
  ],
  traps: [
    { x: 3, y: 1, type: 'delay', delay: 500, label: 'INPUT DELAY ENGAGED' },
    { x: 7, y: 3, type: 'teleport', to: { x: 1, y: 5 }, label: 'WARPED BACK TO FOYER' },
    { x: 11, y: 1, type: 'fake-exit', to: { x: 5, y: 9 }, label: 'DECOY EXIT COLLAPSED' },
    { x: 3, y: 9, type: 'spike', label: 'DELAY TIMING HAZARD' },
    { x: 9, y: 7, type: 'direction', mode: 'NORMAL', label: 'CONTROLS RESTORED' }
  ],
  zones: [
    { x: 5, y: 1, mode: 'DELAYED' }
  ],
  movingWalls: [
    { from: { x: 9, y: 9 }, to: { x: 9, y: 11 }, speed: 0.0009, pause: 600 }
  ]
});

// ----------------------------------------------------------------------------
// LEVEL 4: THE PHANTOM CHAMBER (Patrolling Enemies & Temporary Walls)
// Features active patrolling shadow sentinels, invisible pressure plates that
// toggle temporary laser walls, and mirrored corridors.
// ----------------------------------------------------------------------------
const LEVEL_4_MAP = [
  '#############',
  '#S....#.....#',
  '#.###.#.###.#',
  '#.#...#...#.#',
  '#.#.#####.#.#',
  '#.#...#...#.#',
  '#.###.#.###.#',
  '#...#...#...#',
  '###.#####.###',
  '#...#...#...#',
  '#.###.#.###.#',
  '#.....#...#E#',
  '#############'
];

const LEVEL_4 = createLevel({
  id: 4,
  name: 'THE PHANTOM CHAMBER',
  subtitle: 'PATROLLING SENTINELS & INVISIBLE TRIGGERS',
  map: LEVEL_4_MAP,
  start: { x: 1, y: 1 },
  exit: { x: 11, y: 11 },
  key: { x: 5, y: 5 },
  requiresKey: true,
  checkpoints: [
    { x: 1, y: 7, name: 'SHADOW ALCOVE' },
    { x: 9, y: 7, name: 'EAST PILLAR' }
  ],
  traps: [
    { x: 3, y: 1, type: 'invisible-trigger', targetWall: { x: 5, y: 3 }, label: 'PRESSURE PLATE CLICKED' },
    { x: 5, y: 1, type: 'direction', mode: 'MIRRORED', label: 'MIRRORED HORIZONTAL CONTROLS' },
    { x: 7, y: 7, type: 'disappearing-floor', delay: 750, label: 'DISAPPEARING BRIDGE' },
    { x: 3, y: 9, type: 'spike', label: 'PERIODIC SPIKES' },
    { x: 1, y: 11, type: 'teleport', to: { x: 9, y: 1 }, label: 'DISORIENTATION RIFT' }
  ],
  zones: [
    { x: 7, y: 1, mode: 'MIRRORED' }
  ],
  enemies: [
    {
      path: [{ x: 1, y: 3 }, { x: 5, y: 3 }, { x: 5, y: 5 }, { x: 1, y: 5 }],
      speed: 0.0014,
      color: '#ff4f64'
    },
    {
      path: [{ x: 7, y: 9 }, { x: 11, y: 9 }, { x: 11, y: 7 }, { x: 7, y: 7 }],
      speed: 0.0016,
      color: '#a98bff'
    }
  ],
  tempWalls: [
    { x: 5, y: 3, period: 3200, initialOffset: 0 }
  ]
});

// ----------------------------------------------------------------------------
// LEVEL 5: THE FINAL LABYRINTH (Grand Psychological Climax)
// The ultimate test: Patrolling watchers, delayed zones, rotating rooms,
// one-way shafts, decoy fake exits, crumbling floors, and secret patterns.
// ----------------------------------------------------------------------------
const LEVEL_5_MAP = [
  '###############',
  '#S..#...#.....#',
  '#.#.#.#.#.###.#',
  '#.#...#...#...#',
  '#.#####.###.#.#',
  '#...#...#...#.#',
  '###.#.###.###.#',
  '#...#...#.....#',
  '#.#####.#.#####',
  '#.#.....#...#.#',
  '#.#.#######.#.#',
  '#.#.#.....#...#',
  '#...#...#.#...#',
  '#####.###.#..E#',
  '###############'
];

const LEVEL_5 = createLevel({
  id: 5,
  name: 'THE FINAL LABYRINTH',
  subtitle: 'ALL PATTERNS CONVERGE / ESCAPE THE PSYCHE',
  map: LEVEL_5_MAP,
  start: { x: 1, y: 1 },
  exit: { x: 13, y: 13 },
  key: { x: 7, y: 7 },
  requiresKey: true,
  checkpoints: [
    { x: 7, y: 3, name: 'NORTH SANCTUARY' },
    { x: 3, y: 9, name: 'WEST VAULT' },
    { x: 7, y: 11, name: 'GATEWAY' }
  ],
  traps: [
    { x: 3, y: 1, type: 'direction', mode: 'ROTATED_RIGHT', label: 'SECTOR 1: 90Â° CLOCKWISE' },
    { x: 5, y: 3, type: 'spike', label: 'FALSE CORRIDOR SPIKE' },
    { x: 9, y: 3, type: 'delay', delay: 450, label: 'INPUT LATENCY FIELD' },
    { x: 13, y: 1, type: 'fake-exit', to: { x: 1, y: 7 }, label: 'DECOY TELEPORTED YOU DEEP' },
    { x: 3, y: 7, type: 'falling', delay: 700, label: 'COLLAPSING CHASM' },
    { x: 9, y: 7, type: 'one-way', direction: 'left', label: 'ONE-WAY VAULT SEAL' },
    { x: 5, y: 9, type: 'fake-safe', label: 'CRUSHED UNDERNEATH' },
    { x: 11, y: 9, type: 'direction', mode: 'REVERSED', label: 'SECTOR 4: INVERTED REALITY' },
    { x: 2, y: 12, type: 'twist', twist: 'invert', label: 'INVERTED HEADING' }
  ],
  zones: [
    { x: 3, y: 3, mode: 'ROTATED_RIGHT' },
    { x: 11, y: 11, mode: 'REVERSED' }
  ],
  enemies: [
    {
      path: [{ x: 5, y: 5 }, { x: 9, y: 5 }, { x: 9, y: 7 }, { x: 5, y: 7 }],
      speed: 0.0018,
      color: '#ff4f64'
    },
    {
      path: [{ x: 1, y: 11 }, { x: 3, y: 11 }, { x: 3, y: 12 }, { x: 1, y: 12 }],
      speed: 0.002,
      color: '#70f4df'
    }
  ],
  movingWalls: [
    { from: { x: 9, y: 11 }, to: { x: 9, y: 13 }, speed: 0.001, pause: 700 }
  ]
});

export const LEVELS = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5
];

// ----------------------------------------------------------------------------
// Procedural Variation Generator
// On restart, subtly alters safe routes or trap positions, but strictly validates
// solvability so no impossible level is EVER produced.
// ----------------------------------------------------------------------------
export function getLevel(index, variation = 0) {
  const baseLevel = LEVELS[index];
  if (!baseLevel) return null;

  // Deep clone so base levels remain pristine
  const level = structuredClone(baseLevel);
  level.variation = variation;

  generateLevelKeys(level, 4);

  if (variation > 0) {
    // Controlled variation: vary trap placement or delay timings
    randomizeTrapPositions(level);

    level.traps = level.traps.map((trap, i) => {
      if (trap.type === 'delay') {
        const delays = [450, 500, 600];
        return { ...trap, delay: delays[variation % delays.length] };
      }

      return trap;
    });
  }

  // Solvability check guarantee
  if (!validateLevel(level)) {
    console.warn('Procedural variation failed solvability; reverting to base level layout.');
    return structuredClone(baseLevel);
  }

  return level;
}
