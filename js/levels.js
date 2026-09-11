const base = (name, hint, map, start, exit, key, traps, checkpoints, zones, requiresKey = true) => ({ name, hint, map, width: map[0].length, height: map.length, start, exit, key, traps, checkpoints, zones, requiresKey });

export const LEVELS = [
  base('FIRST IMPRESSION', 'NORMAL MOVEMENT / ONE LIE', [
    '###############', '#S....#.......#', '#.###.#.#####.#', '#...#.#.....#.#', '###.#.#####.#.#', '#...#.....#...#', '#.#######.###.#', '#.............#', '#.###########.#', '#............E#', '###############'
  ], { x: 1, y: 1 }, { x: 13, y: 9 }, { x: 11, y: 7 }, [{ x: 4, y: 1, type: 'fake-safe', label: 'THE FLOOR REMEMBERS' }, { x: 7, y: 3, type: 'direction', mode: 'ROTATED_RIGHT', label: 'THE ROOM TURNS' }, { x: 9, y: 7, type: 'spike', label: 'A SHARP MEMORY' }], [{ x: 1, y: 7, name: 'LOWER HALL' }], [{ x: 6, y: 1, mode: 'MIRRORED' }]),
  base('THE SECOND GUESS', 'SHUFFLED CONTROLS / FAKE SAFETY', [
    '###############', '#S....#.......#', '#.###.#.#####.#', '#...#.#.....#.#', '#.#.#.#####.#.#', '#.#.#.....#...#', '#.#.#####.###.#', '#.#...........#', '#.###########.#', '#............E#', '###############'
  ], { x: 1, y: 1 }, { x: 13, y: 9 }, { x: 11, y: 7 }, [{ x: 4, y: 1, type: 'direction', mode: 'RANDOMIZED', seed: 1, label: 'THE ORDER CHANGES' }, { x: 7, y: 3, type: 'fake-safe', label: 'SAFE IS A RUMOR' }, { x: 9, y: 7, type: 'falling', label: 'DON’T LOOK DOWN' }, { x: 3, y: 9, type: 'control-zone', mode: 'REVERSED', label: 'THE HALL TILTS' }], [{ x: 1, y: 7, name: 'SECOND CHECKPOINT' }], [{ x: 6, y: 1, mode: 'ROTATED_LEFT' }]),
  base('THE WAITING ROOM', 'DELAYED INPUT / TELEPORT', [
    '###############', '#S....#.......#', '#.###.#.#####.#', '#...#.#.....#.#', '###.#.#####.#.#', '#...#.....#...#', '#.#######.###.#', '#.............#', '#.###########.#', '#............E#', '###############'
  ], { x: 1, y: 1 }, { x: 13, y: 9 }, { x: 12, y: 7 }, [{ x: 4, y: 1, type: 'delay', delay: 500, label: 'YOUR INPUT LINGERS' }, { x: 7, y: 3, type: 'teleport', to: { x: 1, y: 7 }, label: 'THE SHORTCUT IS LONGER' }, { x: 9, y: 7, type: 'one-way', direction: 'right', label: 'NO TURNING BACK' }, { x: 11, y: 7, type: 'direction', mode: 'MIRRORED', label: 'LEFT IS RIGHT' }], [{ x: 1, y: 7, name: 'WAITING ROOM' }], [{ x: 6, y: 1, mode: 'DELAYED' }]),
  base('COMPOUND ERROR', 'EVERY RULE IS TRUE / SOMETIMES', [
    '###############', '#S....#.......#', '#.###.#.#####.#', '#...#.#.....#.#', '#.#.#.#####.#.#', '#.#.#.....#...#', '#.#.#####.###.#', '#.#...........#', '#.###########.#', '#............E#', '###############'
  ], { x: 1, y: 1 }, { x: 13, y: 9 }, { x: 10, y: 7 }, [{ x: 4, y: 1, type: 'direction', mode: 'ROTATED_LEFT', label: 'THE ROOM TURNS BACK' }, { x: 7, y: 3, type: 'temporary-wall', label: 'A DOOR THAT WASN’T THERE' }, { x: 9, y: 7, type: 'spike', label: 'SOMETHING MOVED' }, { x: 11, y: 7, type: 'control-zone', mode: 'RANDOMIZED', seed: 2, label: 'THREE WRONGS' }, { x: 3, y: 9, type: 'falling', label: 'THE FLOOR UNMAKES ITSELF' }], [{ x: 1, y: 7, name: 'COMPOUND CHECKPOINT' }], [{ x: 6, y: 1, mode: 'MIRRORED' }]),
  base('NO PATTERN / ALL PATTERN', 'FINAL ESCAPE / REMEMBER EVERYTHING', [
    '###############', '#S....#.......#', '#.###.#.#####.#', '#...#.#.....#.#', '#.#.#.#####.#.#', '#.#.#.....#...#', '#.#.#####.###.#', '#.#...........#', '#.###########.#', '#............E#', '###############'
  ], { x: 1, y: 1 }, { x: 13, y: 9 }, { x: 8, y: 7 }, [{ x: 4, y: 1, type: 'direction', mode: 'RANDOMIZED', seed: 3, label: 'THE LAST SHUFFLE' }, { x: 7, y: 3, type: 'delay', delay: 700, label: 'WAIT FOR IT' }, { x: 9, y: 7, type: 'teleport', to: { x: 1, y: 7 }, label: 'THE MAZE FOLDS' }, { x: 10, y: 7, type: 'spike', label: 'REMEMBER THE SAFE STEP' }, { x: 11, y: 7, type: 'control-zone', mode: 'ROTATED_RIGHT', label: 'THE EXIT IS NOT STRAIGHT' }, { x: 3, y: 9, type: 'fake-safe', label: 'ALMOST' }], [{ x: 1, y: 7, name: 'FINAL CHECKPOINT' }], [{ x: 6, y: 1, mode: 'REVERSED' }])
];

export function getLevel(index, variation = 0) {
  const source = LEVELS[index];
  const level = structuredClone(source);
  level.variant = variation;
  if (variation % 2 === 1) level.traps = level.traps.map((trap, i) => i % 2 === 0 && trap.type !== 'direction' ? { ...trap, x: trap.x + (trap.x < 10 ? 1 : -1) } : trap);
  return level;
}
