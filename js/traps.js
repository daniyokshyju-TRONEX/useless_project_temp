// ============================================================================
// UNPREDICTABLE - Trap Manager
// Implements all 15 trap types, dynamic entities (enemies, moving walls),
// twist tiles, and discovered-state tracking.
// ============================================================================

export class TrapManager {
  constructor(game) {
    this.game = game;
    this.traps = [];
    this.checkpoints = [];
    this.zones = [];
    this.discovered = new Set();   // "x,y" keys discovered by player
    this.triggered = new Set();    // "x,y" keys triggered
    this.crumbles = new Map();     // "x,y" -> { progress: 0..1, fallen: boolean }
    this.movingWalls = [];         // [{ x, y, startX, startY, targetX, targetY, t, speed, dir }]
    this.movingEnemies = [];       // [{ x, y, path: [{x,y}], currentIndex, t, speed }]
    this.tempWalls = [];           // [{ x, y, period, solid: boolean, timer }]
    this.elapsedTime = 0;
  }

  load(level) {
    this.level = level;
    this.traps = level.traps ? [...level.traps] : [];
    this.checkpoints = level.checkpoints ? [...level.checkpoints] : [];
    this.zones = level.zones ? [...level.zones] : [];
    this.discovered.clear();
    this.triggered.clear();
    this.crumbles.clear();
    this.elapsedTime = 0;

    // Initialize moving walls
    this.movingWalls = (level.movingWalls || []).map(mw => ({
      x: mw.from.x,
      y: mw.from.y,
      fromX: mw.from.x,
      fromY: mw.from.y,
      toX: mw.to.x,
      toY: mw.to.y,
      progress: 0,
      direction: 1,
      speed: mw.speed || 0.0008, // cycle speed
      pauseTimer: 0,
      pauseDuration: mw.pause || 800
    }));

    // Initialize patrolling enemies
    this.movingEnemies = (level.enemies || []).map(e => ({
      x: e.path[0].x,
      y: e.path[0].y,
      path: e.path,
      targetIndex: 1,
      progress: 0,
      speed: e.speed || 0.0015,
      radius: 0.35,
      color: e.color || '#ff4f64'
    }));

    // Initialize temporary walls (periodically toggling)
    this.tempWalls = (level.tempWalls || []).map(tw => ({
      x: tw.x,
      y: tw.y,
      period: tw.period || 2400,
      timer: tw.initialOffset || 0,
      solid: true
    }));
  }

  trapAt(x, y) {
    return this.traps.find(t => t.x === x && t.y === y);
  }

  checkpointAt(x, y) {
    return this.checkpoints.find(cp => cp.x === x && cp.y === y);
  }

  zoneAt(x, y) {
    return this.zones.find(z => z.x === x && z.y === y);
  }

  // Called when player lands on or traverses tile (x, y)
  handleTile(x, y) {
    const key = `${x},${y}`;

    // 1. Check check-point activation
    const cp = this.checkpointAt(x, y);
    if (cp) {
      this.game.activateCheckpoint(cp);
    }

    // 2. Check control-shuffle zone
    const zone = this.zoneAt(x, y);
    if (zone) {
      this.game.changeControls(zone.mode, zone.seed || 1);
    }

    // 3. Check twist tiles (modifies next movement)
    const twistTrap = this.traps.find(t => t.x === x && t.y === y && t.type === 'twist');
    if (twistTrap) {
      this.game.player.twist = twistTrap.twist || 'rotate-right';
      this.discovered.add(key);
      this.game.notifyControlChange('TWIST TILE ENGAGED');
    }

    // 4. Check falling or disappearing floors
    const crumbleTrap = this.traps.find(t => t.x === x && t.y === y && (t.type === 'falling' || t.type === 'disappearing-floor'));
    if (crumbleTrap) {
      this.discovered.add(key);
      const state = this.crumbles.get(key);
      if (state && state.fallen) {
        // Stepped on already collapsed pit!
        this.game.damage('FALLEN INTO VOID');
        return;
      }
      if (!state) {
        // Start collapsing
        this.crumbles.set(key, { progress: 0, fallen: false, delay: crumbleTrap.delay || 700 });
        this.game.audio.trapTrigger();
      }
    }

    // 5. Check other traps on this tile
    const trap = this.trapAt(x, y);
    if (trap) {
      this.discovered.add(key);

      // Traps that can re-trigger: direction, delay, teleport, invisible-trigger
      const canRetrigger = ['direction', 'delay', 'teleport', 'invisible-trigger', 'spike', 'fake-safe', 'fake-exit', 'reset'].includes(trap.type);
      if (!this.triggered.has(key) || canRetrigger) {
        this.triggered.add(key);
        this.activate(trap, x, y);
      }
    }
  }

  // Activate specific trap logic
  activate(trap, x, y) {
    switch (trap.type) {
      case 'spike':
        // Spikes deal damage immediately upon step
        this.game.damage(trap.label || 'SPIKE TRAP ACTIVATED');
        break;

      case 'fake-safe':
        // Looks like a normal safe tile until stepped on!
        this.game.damage(trap.label || 'FAKE SAFE PATH COLLAPSED');
        break;

      case 'fake-exit':
        // Looks like real exit, but warps player or triggers a hazard with glitch
        this.game.ui.glitch();
        this.game.ui.shake();
        this.game.audio.glitch();
        if (trap.to) {
          this.game.teleport(trap.to);
          this.game.status = 'THE EXIT WAS AN ILLUSION';
        } else {
          this.game.damage('DECOY EXIT COLLAPSED');
        }
        break;

      case 'teleport':
        if (trap.to) {
          this.game.teleport(trap.to);
          this.game.status = trap.label || 'THE MAZE FOLDED';
        }
        break;

      case 'direction':
        // Switches control mode
        this.game.changeControls(trap.mode, trap.seed || 1);
        if (trap.label) this.game.status = trap.label;
        break;

      case 'delay':
        // Enables delayed movement mode
        this.game.controls.setDelayedControls(trap.delay || 500);
        this.game.notifyControlChange('INPUT DELAY ENGAGED (500ms)');
        break;

      case 'reset':
        // Resets player back to checkpoint or start
        this.game.teleport(this.game.player.checkpoint);
        this.game.status = trap.label || 'RESET TRAP TRIGGERED';
        break;

      case 'invisible-trigger':
        // Toggles a wall or triggers an event
        if (trap.targetWall) {
          this.toggleWallAt(trap.targetWall.x, trap.targetWall.y);
          this.game.notifyControlChange('A WALL SHIFTED IN THE DARK');
        } else if (trap.mode) {
          this.game.changeControls(trap.mode, trap.seed || 1);
        } else {
          this.game.status = trap.label || 'SOMETHING CLICKED BENEATH YOU';
        }
        break;

      case 'one-way':
        // Sets current one-way corridor constraint
        this.game.oneWay = trap.direction;
        this.game.notifyControlChange(`ONE-WAY PASSAGE: MUST MOVE ${trap.direction.toUpperCase()}`);
        break;
    }
  }

  toggleWallAt(x, y) {
    const existing = this.tempWalls.find(w => w.x === x && w.y === y);
    if (existing) {
      existing.solid = !existing.solid;
    } else {
      this.tempWalls.push({ x, y, solid: true, period: 0, timer: 0 });
    }
  }

  // Check if moving wall or solid temporary wall currently blocks tile (x, y)
  isWall(x, y) {
    // Check moving walls
    for (const mw of this.movingWalls) {
      const mwTileX = Math.round(mw.x);
      const mwTileY = Math.round(mw.y);
      if (mwTileX === x && mwTileY === y) return true;
    }

    // Check temporary walls
    for (const tw of this.tempWalls) {
      if (tw.x === x && tw.y === y && tw.solid) return true;
    }

    return false;
  }

  // Update animated entities, patrols, timers
  update(delta) {
    this.elapsedTime += delta;

    // 1. Update falling/disappearing floors
    for (const [key, state] of this.crumbles.entries()) {
      if (!state.fallen) {
        state.progress += delta / state.delay;
        if (state.progress >= 1) {
          state.progress = 1;
          state.fallen = true;
          // If player is still standing on this tile when it completely falls:
          const [cx, cy] = key.split(',').map(Number);
          if (this.game.player.tile.x === cx && this.game.player.tile.y === cy && !this.game.player.moving) {
            this.game.damage('FLOOR COLLAPSED UNDERNEATH');
          }
        }
      }
    }

    // 2. Update temporary walls
    for (const tw of this.tempWalls) {
      if (tw.period > 0) {
        tw.timer += delta;
        if (tw.timer >= tw.period) {
          tw.timer = 0;
          tw.solid = !tw.solid;
        }
      }
    }

    // 3. Update moving walls
    for (const mw of this.movingWalls) {
      if (mw.pauseTimer > 0) {
        mw.pauseTimer -= delta;
        continue;
      }

      mw.progress += mw.direction * mw.speed * delta;
      if (mw.progress >= 1) {
        mw.progress = 1;
        mw.direction = -1;
        mw.pauseTimer = mw.pauseDuration;
      } else if (mw.progress <= 0) {
        mw.progress = 0;
        mw.direction = 1;
        mw.pauseTimer = mw.pauseDuration;
      }

      mw.x = mw.fromX + (mw.toX - mw.fromX) * mw.progress;
      mw.y = mw.fromY + (mw.toY - mw.fromY) * mw.progress;

      // Crush check: if moving wall overlaps player
      const dist = Math.hypot(mw.x - this.game.player.x, mw.y - this.game.player.y);
      if (dist < 0.6) {
        this.game.damage('CRUSHED BY MOVING WALL');
      }
    }

    // 4. Update patrolling enemies
    for (const enemy of this.movingEnemies) {
      const from = enemy.path[(enemy.targetIndex - 1 + enemy.path.length) % enemy.path.length];
      const to = enemy.path[enemy.targetIndex];

      enemy.progress += enemy.speed * delta;
      if (enemy.progress >= 1) {
        enemy.progress = 0;
        enemy.targetIndex = (enemy.targetIndex + 1) % enemy.path.length;
        enemy.x = to.x;
        enemy.y = to.y;
      } else {
        enemy.x = from.x + (to.x - from.x) * enemy.progress;
        enemy.y = from.y + (to.y - from.y) * enemy.progress;
      }

      // Check collision with player
      const pDist = Math.hypot(enemy.x - this.game.player.x, enemy.y - this.game.player.y);
      if (pDist < 0.65) {
        this.game.damage('CAUGHT BY THE PATROLLING WATCHER');
      }
    }
  }

  // Draw hints, trap visuals, and dynamic entities onto the canvas
  draw(ctx, size) {
    const time = this.elapsedTime;

    // Draw control zones background shimmer
    for (const zone of this.zones) {
      const zx = zone.x * size;
      const zy = zone.y * size;
      ctx.save();
      const shimmer = Math.sin(time * 0.003 + zone.x * 2 + zone.y * 3) * 0.12 + 0.15;
      ctx.fillStyle = zone.mode === 'REVERSED' ? `rgba(255, 101, 116, ${shimmer})`
        : zone.mode.startsWith('ROTATED') ? `rgba(169, 139, 255, ${shimmer})`
        : `rgba(112, 244, 223, ${shimmer})`;
      ctx.fillRect(zx + 2, zy + 2, size - 4, size - 4);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.strokeRect(zx + 3, zy + 3, size - 6, size - 6);
      ctx.restore();
    }

    // Draw traps
    for (const trap of this.traps) {
      const key = `${trap.x},${trap.y}`;
      const px = trap.x * size;
      const py = trap.y * size;
      const isDiscovered = this.discovered.has(key);

      ctx.save();
      ctx.translate(px + size / 2, py + size / 2);

      switch (trap.type) {
        case 'spike': {
          // Subtle floor slits, extending spikes when triggered or periodic
          ctx.fillStyle = '#1a1f29';
          ctx.fillRect(-size * 0.35, -size * 0.35, size * 0.7, size * 0.7);

          if (isDiscovered) {
            ctx.fillStyle = '#ff6574';
            const spikeOffset = Math.sin(time * 0.005) * 3;
            // Draw 4 mini spikes
            [-8, 8].forEach(sx => {
              [-8, 8].forEach(sy => {
                ctx.beginPath();
                ctx.moveTo(sx, sy - 5 + spikeOffset);
                ctx.lineTo(sx - 3, sy + 3);
                ctx.lineTo(sx + 3, sy + 3);
                ctx.closePath();
                ctx.fill();
              });
            });
          } else {
            // Unrevealed: faint sinister floor grate
            ctx.strokeStyle = 'rgba(255, 101, 116, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(-size * 0.3, -size * 0.3, size * 0.6, size * 0.6);
          }
          break;
        }

        case 'falling':
        case 'disappearing-floor': {
          const state = this.crumbles.get(key);
          if (state && state.fallen) {
            // Abyss pit
            ctx.fillStyle = '#020305';
            ctx.fillRect(-size / 2 + 1, -size / 2 + 1, size - 2, size - 2);
            ctx.strokeStyle = '#22080a';
            ctx.strokeRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4);
          } else if (state && state.progress > 0) {
            // Cracking state
            ctx.strokeStyle = `rgba(255, 140, 90, ${0.4 + state.progress * 0.6})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-12, -8); ctx.lineTo(4, 2); ctx.lineTo(12, -10);
            ctx.moveTo(-6, 12); ctx.lineTo(4, 2); ctx.lineTo(10, 10);
            ctx.stroke();
          } else if (isDiscovered) {
            ctx.strokeStyle = 'rgba(248, 184, 94, 0.4)';
            ctx.strokeRect(-size * 0.3, -size * 0.3, size * 0.6, size * 0.6);
          }
          break;
        }

        case 'fake-safe': {
          if (isDiscovered) {
            ctx.strokeStyle = '#ff6574';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-6, -6); ctx.lineTo(6, 6);
            ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
            ctx.stroke();
          }
          break;
        }

        case 'fake-exit': {
          // Mimics the real exit with purple glow, but subtle glitch
          const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 28);
          glow.addColorStop(0, 'rgba(169, 139, 255, 0.6)');
          glow.addColorStop(1, 'rgba(169, 139, 255, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(0, 0, 28, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#a98bff';
          ctx.lineWidth = 2;
          ctx.strokeRect(-12, -12, 24, 24);
          ctx.fillStyle = '#a98bff';
          ctx.font = '700 8px Consolas, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('EXIT?', 0, 0);
          break;
        }

        case 'teleport': {
          // Swirling portal rift
          ctx.strokeStyle = isDiscovered ? '#70f4df' : 'rgba(112, 244, 223, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const angle = time * 0.003;
          ctx.arc(0, 0, 10, angle, angle + Math.PI * 1.5);
          ctx.stroke();
          break;
        }

        case 'direction': {
          if (isDiscovered) {
            ctx.strokeStyle = '#f8b85e';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#f8b85e';
            ctx.font = '700 9px Consolas';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⟳', 0, 0);
          }
          break;
        }

        case 'delay': {
          if (isDiscovered) {
            ctx.strokeStyle = '#ff9f43';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ff9f43';
            ctx.font = '700 8px Consolas';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⏱', 0, 0);
          }
          break;
        }

        case 'one-way': {
          // Neon directional arrow
          ctx.fillStyle = '#70f4df';
          ctx.save();
          const dirAngle = {
            up: -Math.PI / 2,
            right: 0,
            down: Math.PI / 2,
            left: Math.PI
          }[trap.direction || 'right'];
          ctx.rotate(dirAngle);
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, -6);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-5, 6);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'twist': {
          // Geometric rotation or mirror glyph
          ctx.strokeStyle = 'rgba(255, 101, 116, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ff6574';
          ctx.font = '700 10px Consolas';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⇄', 0, 0);
          break;
        }
      }

      ctx.restore();
    }

    // Draw temporary walls
    for (const tw of this.tempWalls) {
      if (tw.solid) {
        const tx = tw.x * size;
        const ty = tw.y * size;
        ctx.save();
        ctx.fillStyle = '#39213d';
        ctx.fillRect(tx + 2, ty + 2, size - 4, size - 4);
        ctx.strokeStyle = '#a98bff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(tx + 3, ty + 3, size - 6, size - 6);

        // Warning energetic pulse
        const alpha = Math.sin(time * 0.008) * 0.3 + 0.5;
        ctx.strokeStyle = `rgba(169, 139, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(tx + 6, ty + 6);
        ctx.lineTo(tx + size - 6, ty + size - 6);
        ctx.moveTo(tx + size - 6, ty + 6);
        ctx.lineTo(tx + 6, ty + size - 6);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw moving walls
    for (const mw of this.movingWalls) {
      const mx = mw.x * size;
      const my = mw.y * size;
      ctx.save();
      ctx.fillStyle = '#1c2834';
      ctx.fillRect(mx + 2, my + 2, size - 4, size - 4);
      ctx.strokeStyle = '#ff6574';
      ctx.lineWidth = 2;
      ctx.strokeRect(mx + 3, my + 3, size - 6, size - 6);

      // Warning hazard stripes
      ctx.fillStyle = 'rgba(255, 101, 116, 0.35)';
      ctx.fillRect(mx + 6, my + 6, size - 12, size - 12);
      ctx.restore();
    }

    // Draw patrolling enemies
    for (const enemy of this.movingEnemies) {
      const ex = enemy.x * size + size / 2;
      const ey = enemy.y * size + size / 2;
      ctx.save();

      // Menacing red aura
      const aura = ctx.createRadialGradient(ex, ey, 2, ex, ey, size * 0.55);
      aura.addColorStop(0, 'rgba(255, 79, 100, 0.7)');
      aura.addColorStop(0.6, 'rgba(255, 79, 100, 0.2)');
      aura.addColorStop(1, 'rgba(255, 79, 100, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(ex, ey, size * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Enemy core body
      ctx.fillStyle = '#0a0d14';
      ctx.beginPath();
      ctx.arc(ex, ey, size * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Piercing glowing eye
      const eyeOffset = Math.sin(time * 0.006) * 2;
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(ex + eyeOffset, ey, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
}
