// ============================================================================
// UNPREDICTABLE - Control Manager
// Handles dynamic control mapping mutations, input buffering, and delays.
// The player's keyboard controls are themselves a trap.
// ============================================================================

export const DIRECTIONS = ['up', 'right', 'down', 'left'];
export const ARROW_KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

export class ControlManager {
  constructor(onChange) {
    this.onChange = onChange; // Callback when control scheme mutates
    this.mode = 'NORMAL';
    this.controlMap = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right'
    };
    this.delayMs = 0;
    this.pendingInputs = [];
    this.setNormalControls(false);
  }

  // Set active mapping with optional delay and change notification
  setMap(name, mapping, delay = 0, announce = true) {
    this.mode = name;
    this.controlMap = { ...mapping };
    this.delayMs = delay;
    if (announce && this.onChange) {
      this.onChange(name, this);
    }
  }

  // Normal: Standard intuitive directions
  setNormalControls(announce = true) {
    this.setMap(
      'NORMAL',
      {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
      },
      0,
      announce
    );
  }

  // Reversed: All directions inverted 180 degrees
  setReversedControls(announce = true) {
    this.setMap(
      'REVERSED',
      {
        ArrowUp: 'down',
        ArrowDown: 'up',
        ArrowLeft: 'right',
        ArrowRight: 'left'
      },
      0,
      announce
    );
  }

  // Rotated: 90 degrees clockwise (right) or counter-clockwise (left)
  setRotatedControls(direction = 'right', announce = true) {
    if (direction === 'left') {
      // Rotated 90 degrees counter-clockwise
      // Up -> Left, Left -> Down, Down -> Right, Right -> Up
      this.setMap(
        'ROTATED_LEFT',
        {
          ArrowUp: 'left',
          ArrowLeft: 'down',
          ArrowDown: 'right',
          ArrowRight: 'up'
        },
        0,
        announce
      );
    } else {
      // Rotated 90 degrees clockwise
      // Up -> Right, Right -> Down, Down -> Left, Left -> Up
      this.setMap(
        'ROTATED_RIGHT',
        {
          ArrowUp: 'right',
          ArrowRight: 'down',
          ArrowDown: 'left',
          ArrowLeft: 'up'
        },
        0,
        announce
      );
    }
  }

  // Mirrored: Left becomes Right, Right becomes Left (Up/Down unchanged by default)
  setMirroredControls(axis = 'horizontal', announce = true) {
    if (axis === 'vertical') {
      this.setMap(
        'MIRRORED',
        {
          ArrowUp: 'down',
          ArrowDown: 'up',
          ArrowLeft: 'left',
          ArrowRight: 'right'
        },
        0,
        announce
      );
    } else {
      this.setMap(
        'MIRRORED',
        {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'right',
          ArrowRight: 'left'
        },
        0,
        announce
      );
    }
  }

  // Randomized: Controlled deterministic permutation based on a seed or room index
  setRandomControls(seed = 1, announce = true) {
    // Controlled permutations that feel unpredictable yet are consistent per room/seed
    const permutations = [
      { ArrowUp: 'right', ArrowRight: 'up', ArrowDown: 'left', ArrowLeft: 'down' },
      { ArrowUp: 'down', ArrowRight: 'left', ArrowDown: 'up', ArrowLeft: 'right' },
      { ArrowUp: 'left', ArrowRight: 'down', ArrowDown: 'right', ArrowLeft: 'up' },
      { ArrowUp: 'right', ArrowRight: 'left', ArrowDown: 'up', ArrowLeft: 'down' }
    ];
    const index = Math.abs(seed) % permutations.length;
    this.setMap('RANDOMIZED', permutations[index], 0, announce);
  }

  // Delayed: Keys queue and trigger after delayMs
  setDelayedControls(delayMs = 500, announce = true) {
    this.setMap(
      'DELAYED',
      {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
      },
      delayMs,
      announce
    );
  }

  // Reset to default normal controls
  resetControls() {
    this.pendingInputs = [];
    this.setNormalControls(false);
  }

  // Resolve incoming raw key press to intended direction (or queue if delayed)
  resolve(key, now = performance.now()) {
    const direction = this.controlMap[key];
    if (!direction) return null;

    if (this.delayMs > 0) {
      // Input is delayed: queue it up
      const executeAt = now + this.delayMs;
      this.pendingInputs.push({ direction, executeAt });
      return { queued: true, direction, executeAt };
    }

    return { queued: false, direction };
  }

  // Drain pending delayed inputs that are ready to execute
  drain(now = performance.now()) {
    if (this.pendingInputs.length === 0) return [];
    const ready = [];
    const remaining = [];

    for (const item of this.pendingInputs) {
      if (item.executeAt <= now) {
        ready.push(item);
      } else {
        remaining.push(item);
      }
    }

    this.pendingInputs = remaining;
    return ready;
  }

  // Twist floor tiles modify the player's movement on that specific step
  applyTwist(direction, twist = 'none') {
    const index = DIRECTIONS.indexOf(direction);
    if (index === -1) return direction;

    switch (twist) {
      case 'rotate-right': // 90 deg clockwise
        return DIRECTIONS[(index + 1) % 4];
      case 'rotate-left': // 90 deg counter-clockwise
        return DIRECTIONS[(index + 3) % 4];
      case 'invert': // 180 deg
        return DIRECTIONS[(index + 2) % 4];
      case 'mirror-horizontal':
        return direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction;
      case 'mirror-vertical':
        return direction === 'up' ? 'down' : direction === 'down' ? 'up' : direction;
      default:
        return direction;
    }
  }
}
