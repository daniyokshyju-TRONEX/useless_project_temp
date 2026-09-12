// ============================================================================
// UNPREDICTABLE - Collision & Pathfinding
// Validates movement, obstacles, and mathematical solvability of levels.
// ============================================================================

export function canWalk(level, x, y) {
  if (!level || y < 0 || y >= level.height || x < 0 || x >= level.width) {
    return false;
  }
  const row = level.map[y];
  if (!row) return false;
  return row[x] !== '#';
}

export function directionVector(direction) {
  switch (direction) {
    case 'up': return [0, -1];
    case 'right': return [1, 0];
    case 'down': return [0, 1];
    case 'left': return [-1, 0];
    default: return [0, 0];
  }
}

export function shortestPathLength(level, start, goal) {
  if (!start || !goal) return Infinity;
  if (start.x === goal.x && start.y === goal.y) return 0;

  const queue = [{ x: start.x, y: start.y, distance: 0 }];
  const visited = new Set([`${start.x},${start.y}`]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current.x === goal.x && current.y === goal.y) {
      return current.distance;
    }

    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y }
    ];

    for (const next of neighbors) {
      const key = `${next.x},${next.y}`;
      if (canWalk(level, next.x, next.y) && !visited.has(key)) {
        visited.add(key);
        queue.push({ x: next.x, y: next.y, distance: current.distance + 1 });
      }
    }
  }

  return Infinity;
}

export function findPath(level, start = level.start, goal = level.exit) {
  return shortestPathLength(level, start, goal) !== Infinity;
}

export function validateLevel(level) {
  if (!level || !level.start || !level.exit) return false;
  if (!canWalk(level, level.start.x, level.start.y)) return false;
  if (!canWalk(level, level.exit.x, level.exit.y)) return false;

  const keys = Array.isArray(level.keys) && level.keys.length ? level.keys : (level.key ? [level.key] : []);
  if (keys.length > 0 && level.requiresKey) {
    for (const key of keys) {
      if (shortestPathLength(level, level.start, key) === Infinity) {
        return false;
      }
      if (shortestPathLength(level, key, level.exit) === Infinity) {
        return false;
      }
    }
    return true;
  }

  return findPath(level, level.start, level.exit);
}
