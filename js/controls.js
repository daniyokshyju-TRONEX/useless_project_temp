const DIRECTIONS = ['up', 'right', 'down', 'left'];
const KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'];

export class ControlManager {
  constructor(onChange) {
    this.onChange = onChange;
    this.mode = 'NORMAL';
    this.map = {};
    this.delayMs = 0;
    this.pending = [];
    this.pattern = ['up', 'right', 'down', 'left'];
    this.setNormalControls(false);
  }

  setMap(name, values, delay = 0, announce = true) {
    this.mode = name;
    this.map = { ...values };
    this.delayMs = delay;
    if (announce && this.onChange) this.onChange(name);
  }

  setNormalControls(announce = true) { this.setMap('NORMAL', { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }, 0, announce); }
  setReversedControls(announce = true) { this.setMap('REVERSED', { ArrowUp: 'down', ArrowDown: 'up', ArrowLeft: 'right', ArrowRight: 'left' }, 0, announce); }
  setRotatedControls(direction = 'right', announce = true) {
    const rotate = direction === 'left' ? { up: 'left', left: 'down', down: 'right', right: 'up' } : { up: 'right', right: 'down', down: 'left', left: 'up' };
    this.setMap(direction === 'left' ? 'ROTATED_LEFT' : 'ROTATED_RIGHT', Object.fromEntries(KEYS.map((key, index) => [key, rotate[DIRECTIONS[index]]])), 0, announce);
  }
  setMirroredControls(announce = true) { this.setMap('MIRRORED', { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'right', ArrowRight: 'left' }, 0, announce); }
  setRandomControls(seed = 0, announce = true) {
    const offset = Math.abs(seed) % 4;
    const values = KEYS.map((key, index) => [key, DIRECTIONS[(index + offset) % 4]]);
    this.setMap('RANDOMIZED', Object.fromEntries(values), 0, announce);
  }
  setDelayedControls(delay = 500, announce = true) { this.setMap('DELAYED', { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }, delay, announce); }
  resetControls() { this.pending = []; this.setNormalControls(); }

  resolve(key, now = performance.now()) {
    const direction = this.map[key];
    if (!direction) return null;
    if (this.delayMs > 0) {
      this.pending.push({ direction, executeAt: now + this.delayMs });
      return { queued: true, direction, executeAt: now + this.delayMs };
    }
    return { queued: false, direction };
  }

  drain(now = performance.now()) {
    const ready = this.pending.filter(item => item.executeAt <= now);
    this.pending = this.pending.filter(item => item.executeAt > now);
    return ready;
  }

  applyTwist(direction, twist = 'none') {
    const index = DIRECTIONS.indexOf(direction);
    if (twist === 'rotate-right') return DIRECTIONS[(index + 1) % 4];
    if (twist === 'rotate-left') return DIRECTIONS[(index + 3) % 4];
    if (twist === 'mirror-horizontal') return direction === 'left' ? 'right' : direction === 'right' ? 'left' : direction;
    if (twist === 'mirror-vertical') return direction === 'up' ? 'down' : direction === 'down' ? 'up' : direction;
    return direction;
  }
}

export { DIRECTIONS };
