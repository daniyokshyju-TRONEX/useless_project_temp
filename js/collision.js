export function canWalk(level, x, y) {
  return y >= 0 && y < level.height && x >= 0 && x < level.width && level.map[y][x] !== '#';
}

export function findPath(level) {
  const start = level.start; const goal = level.exit; const queue = [start]; const seen = new Set([`${start.x},${start.y}`]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy }; const key = `${next.x},${next.y}`;
      if (canWalk(level, next.x, next.y) && !seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return false;
}

export function shortestPathLength(level, start, goal) {
  const queue = [{ ...start, distance: 0 }]; const seen = new Set([`${start.x},${start.y}`]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) return current.distance;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { x: current.x + dx, y: current.y + dy }; const key = `${next.x},${next.y}`;
      if (canWalk(level, next.x, next.y) && !seen.has(key)) { seen.add(key); queue.push({ ...next, distance: current.distance + 1 }); }
    }
  }
  return Infinity;
}

export function directionVector(direction) {
  return ({ up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] })[direction];
}
