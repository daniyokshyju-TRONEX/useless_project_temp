// ============================================================================
// UNPREDICTABLE - Main Game Engine
// Manages the game loop, canvas rendering, player movement, trap reactions,
// audio triggers, and level progression.
// ============================================================================

import { ControlManager } from './controls.js';
import { AudioManager } from './audio.js';
import { canWalk, directionVector, findPath, validateLevel } from './collision.js';
import { getLevel } from './levels.js';
import { Player } from './player.js';
import { TrapManager } from './traps.js';
import { UI } from './ui.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 48;

    this.audio = new AudioManager();
    this.controls = new ControlManager((mode) => this.notifyControlChange(mode));
    this.player = new Player({ x: 1, y: 1 });
    this.traps = new TrapManager(this);
    this.ui = new UI(this);

    this.levelIndex = 0;
    this.maxAttempts = 3;
    this.attempts = this.maxAttempts;
    this.levelVariation = 0;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.status = 'SIGNAL STABLE';
    this.oneWay = null;
    this.finished = false;
    this.failed = false;

    // Accuracy system: reduces on moves; when depleted, 5s lockout to regain
    this.accuracy = 100;
    this.moveCost = 5; // 5% per step = 20 moves before 0%
    this.isRegainingAccuracy = false;
    this.regainTimer = 0;
    this.regainTotal = 5000; // 5 seconds wait period
    this.idleTime = 0;

    this.bindInput();
    this.loadLevel(0);
  }

  // Keyboard input binding
  bindInput() {
    window.addEventListener('keydown', (event) => {
      // Direction keys (Arrow keys and WASD)
      const arrowMap = {
        ArrowUp: 'ArrowUp',
        ArrowDown: 'ArrowDown',
        ArrowLeft: 'ArrowLeft',
        ArrowRight: 'ArrowRight',
        w: 'ArrowUp',
        W: 'ArrowUp',
        s: 'ArrowDown',
        S: 'ArrowDown',
        a: 'ArrowLeft',
        A: 'ArrowLeft',
        d: 'ArrowRight',
        D: 'ArrowRight'
      };

      const mappedKey = arrowMap[event.key];
      if (mappedKey) {
        event.preventDefault();
        this.input(mappedKey);
        return;
      }

      // Enter advances modals / start
      if (event.key === 'Enter') {
        if (!this.running && !this.ui.messagePanel.hidden) {
          event.preventDefault();
          this.messageAction();
        } else if (!this.running && !this.ui.startPanel.hidden) {
          event.preventDefault();
          this.start();
        } else if (this.paused) {
          event.preventDefault();
          this.togglePause(false);
        }
      }

      // Escape or P pauses
      if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
        if (this.running) {
          event.preventDefault();
          this.togglePause();
        }
      }
    });
  }

  // Load level by index and variation
  loadLevel(index) {
    this.levelIndex = index;
    this.level = getLevel(index, this.levelVariation);

    if (!this.level || !validateLevel(this.level)) {
      console.error(`Level ${index} failed validation.`);
    }

    this.level.collectedKeys = new Set();
    this.player.reset(this.level.start);
    this.traps.load(this.level);
    this.controls.resetControls();
    this.oneWay = null;
    this.ui.hideFailScreen();
    this.status = `${this.level.name}: SIGNAL STABLE`;

    // Reset accuracy on level load
    this.accuracy = 100;
    this.isRegainingAccuracy = false;
    this.regainTimer = 0;
    this.idleTime = 0;

    // Resize canvas to fit level grid
    this.canvas.width = this.level.width * this.tileSize;
    this.canvas.height = this.level.height * this.tileSize;

    this.ui.sync(this.state());
    this.draw();
  }

  // Current game state snapshot for UI
  state() {
    const isAtStart = this.player.checkpoint.x === this.level.start.x &&
                      this.player.checkpoint.y === this.level.start.y;
    const cpObj = this.level.checkpoints.find(
      cp => cp.x === this.player.checkpoint.x && cp.y === this.player.checkpoint.y
    );

    const totalKeys = Array.isArray(this.level?.keys) ? this.level.keys.length : (this.level?.key ? 1 : 0);

    return {
      level: this.levelIndex + 1,
      levelName: this.level.name,
      keys: this.player.keysCollected ?? 0,
      totalKeys,
      attempts: this.attempts,
      checkpointActive: !isAtStart,
      checkpointName: isAtStart ? 'ORIGIN' : (cpObj?.name || 'ACTIVE'),
      status: this.status,
      accuracy: Math.round(this.accuracy),
      isRegainingAccuracy: this.isRegainingAccuracy,
      regainRemaining: Math.max(0, ((this.regainTotal - this.regainTimer) / 1000)).toFixed(1)
    };
  }

  // Start game session
  start() {
    this.failed = false;
    this.audio.unlock();
    this.running = true;
    this.paused = false;
    this.ui.hideStart();
    this.ui.hideMessage();
    this.ui.hideFailScreen();
    this.lastTime = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  // Core game loop
  loop(time) {
    if (!this.running) return;

    const delta = Math.min(50, time - this.lastTime);
    this.lastTime = time;

    if (!this.paused) {
      this.update(delta, time);
      this.draw();
    }

    requestAnimationFrame((next) => this.loop(next));
  }

  // Frame update
  update(delta, now) {
    this.player.update(delta);
    this.traps.update(delta);

    // Accuracy regain countdown (5 seconds wait)
    if (this.isRegainingAccuracy) {
      this.regainTimer += delta;
      this.accuracy = Math.min(100, Math.floor((this.regainTimer / this.regainTotal) * 100));
      const remaining = Math.max(0, ((this.regainTotal - this.regainTimer) / 1000)).toFixed(1);
      this.status = `ACCURACY EXHAUSTED // REGAINING: ${remaining}s (${this.accuracy}%)`;

      if (this.regainTimer >= this.regainTotal) {
        this.accuracy = 100;
        this.isRegainingAccuracy = false;
        this.regainTimer = 0;
        this.status = 'ACCURACY RESTORED (100%)';
        this.audio.tone(520, 0.15, 'sine', 0.035);
      }
      this.ui.sync(this.state());
    } else if (!this.player.moving) {
      // Gentle recovery if resting before reaching 0%
      this.idleTime += delta;
      if (this.idleTime > 1500 && this.accuracy < 100) {
        this.accuracy = Math.min(100, this.accuracy + (delta * 0.015));
        this.ui.sync(this.state());
      }
    }

    // Drain and process queued delayed inputs
    const readyInputs = this.controls.drain(now);
    for (const item of readyInputs) {
      this.attemptMove(item.direction);
    }

    // Check tile interactions once player completes movement step
    if (!this.player.moving) {
      this.checkTile();
    }
  }

  // Input event handler
  input(rawKey) {
    if (!this.running || this.paused || this.player.isDying) return;

    // If accuracy is depleted, player is locked and cannot move
    if (this.isRegainingAccuracy) {
      const remaining = Math.max(0, ((this.regainTotal - this.regainTimer) / 1000)).toFixed(1);
      this.status = `LOCKED: REGAINING ACCURACY (${remaining}s LEFT)`;
      this.audio.tone(85, 0.05, 'square', 0.025);
      this.ui.sync(this.state());
      return;
    }

    // Resolve key through current control mutation mapping
    const result = this.controls.resolve(rawKey);
    if (!result) return;

    if (result.queued) {
      this.status = 'INPUT DELAYED (PENDING BUFFER)';
      this.ui.sync(this.state());
    } else {
      this.attemptMove(result.direction);
    }
  }

  // Attempt to move player in directed vector
  attemptMove(direction) {
    if (this.player.moving || this.player.isDying || this.isRegainingAccuracy) return;

    // Check one-way corridor restriction
    if (this.oneWay && direction !== this.oneWay) {
      this.status = `BLOCKED: ONE-WAY GATE (${this.oneWay.toUpperCase()} ONLY)`;
      this.ui.sync(this.state());
      this.audio.tone(75, 0.04, 'sawtooth', 0.02);
      return;
    }

    // Apply twist floor tile modification if active
    const finalDirection = this.controls.applyTwist(direction, this.player.twist);
    this.player.twist = 'none'; // Reset twist after applying

    const [dx, dy] = directionVector(finalDirection);
    const targetX = this.player.tile.x + dx;
    const targetY = this.player.tile.y + dy;

    // Check map boundaries and static walls
    if (!canWalk(this.level, targetX, targetY)) {
      this.audio.tone(80, 0.03, 'square', 0.015);
      return;
    }

    // Check dynamic trap walls (moving walls, temporary solid barriers)
    if (this.traps.isWall(targetX, targetY)) {
      this.status = 'BLOCKED BY SHIFTING WALL';
      this.audio.tone(90, 0.04, 'sawtooth', 0.02);
      this.ui.sync(this.state());
      return;
    }

    // Deduct accuracy on successful step
    this.idleTime = 0;
    this.accuracy = Math.max(0, this.accuracy - this.moveCost);
    if (this.accuracy <= 0) {
      this.accuracy = 0;
      this.isRegainingAccuracy = true;
      this.regainTimer = 0;
      this.status = 'ACCURACY DEPLETED // WAIT 5s TO REGAIN';
      this.audio.accuracyDepleted();
      this.ui.shake();
    }

    // Move is valid: execute step
    this.player.moveTo(targetX, targetY, finalDirection);
    this.audio.movement();

    // Reset one-way lock if player moved out of one-way trap tile
    const currentTrap = this.traps.trapAt(targetX, targetY);
    if (!currentTrap || currentTrap.type !== 'one-way') {
      this.oneWay = null;
    }

    this.ui.sync(this.state());
  }

  // Check tile events (traps, keys, checkpoints, exits)
  checkTile() {
    const { x, y } = this.player.tile;

    // 1. Check traps and zones
    this.traps.handleTile(x, y);

    // 2. Check Key collection
    const remainingKey = (this.level.keys || []).find(
      (key) => key && x === key.x && y === key.y && !this.player.hasKey && !this.level.collectedKeys?.has?.(`${x},${y}`)
    );

    if (remainingKey) {
      this.player.collectKey();
      if (!this.level.collectedKeys) {
        this.level.collectedKeys = new Set();
      }
      this.level.collectedKeys.add(`${x},${y}`);
      this.audio.key();
      this.ui.glitch();
      const keysLeft = Math.max(0, (this.level.keys?.length || 0) - this.player.keysCollected);
      this.status = keysLeft > 0 ? `KEY ACQUIRED // ${keysLeft} REMAINING` : 'ALL KEYS ACQUIRED // EXIT UNSEALED';

      // Surprise mechanic: Collecting key alters the maze behavior!
      this.onKeyCollected();
    }

    // 3. Check Exit reached
    if (x === this.level.exit.x && y === this.level.exit.y) {
      const requiredKeys = this.level.requiredKeys ?? (this.level.keys?.length || 0 || (this.level.key ? 1 : 0));
      const hasEnoughKeys = !this.level.requiresKey || this.player.keysCollected >= requiredKeys;
      if (hasEnoughKeys) {
        this.completeLevel();
      } else {
        const missing = requiredKeys - this.player.keysCollected;
        this.status = missing > 0 ? `EXIT SEALED: ${missing} KEY${missing > 1 ? 'S' : ''} REQUIRED` : 'EXIT SEALED: KEY REQUIRED';
        this.ui.sync(this.state());
      }
    }

    this.ui.sync(this.state());
  }

  // Key collection trigger
  onKeyCollected() {
    switch (this.levelIndex) {
      case 0:
        // Level 1: Controls unexpectedly reverse!
        this.controls.setReversedControls();
        this.notifyControlChange('KEY CHANGED REALITY: CONTROLS REVERSED');
        break;
      case 1:
        // Level 2: Controls rotate right
        this.controls.setRotatedControls('right');
        this.notifyControlChange('ROTATION ENGAGED');
        break;
      case 2:
        // Level 3: Controls become delayed
        this.controls.setDelayedControls(500);
        this.notifyControlChange('LATENCY DETECTED (500ms)');
        break;
      case 3:
        // Level 4: Controls mirror horizontally
        this.controls.setMirroredControls('horizontal');
        this.notifyControlChange('MIRRORED CONTROLS ACTIVE');
        break;
      case 4:
        // Level 5: Controls randomize to a new permutation
        this.controls.setRandomControls(3);
        this.notifyControlChange('SYSTEM INSTABILITY: CONTROLS MUTATED');
        break;
    }
  }

  // Checkpoint activation
  activateCheckpoint(point) {
    if (this.player.checkpoint.x === point.x && this.player.checkpoint.y === point.y) return;
    this.player.setCheckpoint(point);
    this.audio.checkpoint();
    this.status = `CHECKPOINT ACTIVE: ${point.name || 'SAFE ZONE'}`;
    this.ui.sync(this.state());
  }

  // Control modification trigger
  changeControls(mode, seed = 1) {
    if (mode === 'NORMAL') this.controls.setNormalControls();
    else if (mode === 'REVERSED') this.controls.setReversedControls();
    else if (mode === 'ROTATED_LEFT') this.controls.setRotatedControls('left');
    else if (mode === 'ROTATED_RIGHT') this.controls.setRotatedControls('right');
    else if (mode === 'MIRRORED') this.controls.setMirroredControls('horizontal');
    else if (mode === 'RANDOMIZED') this.controls.setRandomControls(seed);
    else if (mode === 'DELAYED') this.controls.setDelayedControls(500);
  }

  // Notified when controls change
  notifyControlChange(message) {
    this.status = `CONTROLS: ${message}`;
    this.audio.control();
    this.ui.glitch();
    this.ui.sync(this.state());
  }

  // Teleport player
  teleport(destination) {
    this.player.x = destination.x;
    this.player.y = destination.y;
    this.player.targetX = destination.x;
    this.player.targetY = destination.y;
    this.player.moving = false;
    this.status = 'THE MAZE FOLDED SPACE';
    this.ui.shake();
    this.ui.glitch();
    this.audio.control();
  }

  // Damage / Death handling
  damage(reason) {
    if (this.player.invulnerable || this.player.isDying) return;

    this.player.invulnerable = true;
    this.player.isDying = true;
    this.audio.lifeLost();
    this.ui.shake();
    this.attempts -= 1;
    this.status = reason || 'LETHAL TRAP ACTIVATED';
    this.ui.sync(this.state());

    setTimeout(() => {
      if (this.attempts <= 0) {
        this.gameOver();
      } else {
        this.player.respawn();
        this.accuracy = 100;
        this.isRegainingAccuracy = false;
        this.regainTimer = 0;
        this.idleTime = 0;
        this.status = 'RESPAWNED AT LAST CHECKPOINT';
        this.ui.sync(this.state());
      }
    }, 450);
  }

  // Level completion
  completeLevel() {
    this.running = false;
    this.audio.complete();

    if (this.levelIndex === 4) {
      // Cleared all 5 levels
      this.finished = true;
      this.ui.message(
        'ESCAPE CONFIRMED',
        'YOU BEAT THE PATTERN.',
        'The maze was never truly random. You decoded the hidden psychological trap.',
        'PLAY AGAIN'
      );
    } else {
      // Advance to next level
      this.finished = false;
      this.ui.message(
        `LEVEL ${this.levelIndex + 1} CLEARED`,
        'THE MAZE BLINKED.',
        'You deduced this chamber’s secret rule. The next room will challenge you further.',
        'NEXT LEVEL'
      );
    }
  }

  // Game over: all attempts exhausted
  gameOver() {
    this.running = false;
    this.finished = true;
    this.failed = true;
    this.audio.gameOver();
    this.ui.showFailScreen();
  }

  // Handle modal action button (Try Again, Next Level, Play Again)
  messageAction() {
    this.ui.hideMessage();
    if (this.failed) {
      this.ui.showFailGif();
      return;
    }

    if (this.finished) {
      // Restart full campaign
      this.levelIndex = 0;
      this.levelVariation = 0;
      this.attempts = this.maxAttempts;
      this.failed = false;
      this.loadLevel(0);
      this.start();
    } else {
      // Advance to next level
      this.levelIndex += 1;
      this.attempts = this.maxAttempts;
      this.loadLevel(this.levelIndex);
      this.start();
    }
  }

  // Restart current level with a subtle procedural variation
  restartLevel() {
    this.attempts = this.maxAttempts;
    this.levelVariation += 1;
    this.loadLevel(this.levelIndex);
    this.ui.hideMessage();
    this.audio.unlock();
    if (!this.running) {
      this.running = true;
      this.paused = false;
      this.lastTime = performance.now();
      requestAnimationFrame((time) => this.loop(time));
    }
  }

  // Pause toggle
  togglePause(force) {
    if (!this.running && force !== false) return;
    this.paused = force === undefined ? !this.paused : force;
    this.ui.pause(this.paused);
  }

  // Render everything onto canvas
  draw() {
    const size = this.tileSize;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Deep dark background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    // 1. Draw maze floor and walls
    for (let y = 0; y < this.level.height; y++) {
      for (let x = 0; x < this.level.width; x++) {
        const isWall = this.level.map[y][x] === '#';
        this.drawTile(x, y, isWall);
      }
    }

    // 2. Draw Checkpoints
    for (const cp of this.level.checkpoints) {
      this.drawCheckpoint(cp);
    }

    // 3. Draw Exit
    this.drawExit();

    // 4. Draw Key
    if (this.player.keysCollected < (this.level.requiredKeys ?? this.level.keys?.length ?? 0)) {
      this.drawKey();
    }

    // 5. Draw Traps, Zones, Moving Walls, and Patrolling Enemies
    this.traps.draw(ctx, size);

    // 6. Atmospheric Lighting / Subtle Fog of War
    this.drawAtmosphere();

    // 7. Draw Player (ALWAYS ON TOP, 100% VISIBLE)
    this.player.draw(ctx, size, this.accuracy, this.isRegainingAccuracy);
  }

  // Draw an individual grid tile
  drawTile(x, y, isWall) {
    const ctx = this.ctx;
    const size = this.tileSize;
    const px = x * size;
    const py = y * size;

    if (isWall) {
      // 3D beveled maze wall block
      ctx.fillStyle = '#101721';
      ctx.fillRect(px, py, size, size);

      // Top bevel highlight
      ctx.fillStyle = '#223040';
      ctx.fillRect(px, py, size, 3);
      ctx.fillRect(px, py, 3, size);

      // Bottom shadow bevel
      ctx.fillStyle = '#070b10';
      ctx.fillRect(px, py + size - 3, size, 3);
      ctx.fillRect(px + size - 3, py, 3, size);

      // Inner wall plate
      ctx.strokeStyle = '#182433';
      ctx.strokeRect(px + 4.5, py + 4.5, size - 9, size - 9);
    } else {
      // Floor tile with subtle alternating tone
      const alt = (x + y) % 2 === 0;
      ctx.fillStyle = alt ? '#090e16' : '#070b11';
      ctx.fillRect(px, py, size, size);

      // Subtle floor seam
      ctx.strokeStyle = 'rgba(29, 44, 59, 0.45)';
      ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    }
  }

  // Draw exit portal
  drawExit() {
    const ctx = this.ctx;
    const s = this.tileSize;
    const exit = this.level.exit;
    const ex = exit.x * s + s / 2;
    const ey = exit.y * s + s / 2;
    const time = performance.now();
    const requiredKeys = this.level.requiredKeys ?? this.level.keys?.length ?? 0;
    const exitUnlocked = !this.level.requiresKey || this.player.keysCollected >= requiredKeys;

    // Glowing purple aura
    const pulse = Math.sin(time * 0.004) * 5 + 32;
    const aura = ctx.createRadialGradient(ex, ey, 2, ex, ey, pulse);
    aura.addColorStop(0, 'rgba(169, 139, 255, 0.75)');
    aura.addColorStop(0.5, 'rgba(169, 139, 255, 0.25)');
    aura.addColorStop(1, 'rgba(169, 139, 255, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(ex, ey, pulse, 0, Math.PI * 2);
    ctx.fill();

    // Doorway frame
    ctx.strokeStyle = '#a98bff';
    ctx.lineWidth = 2;
    ctx.strokeRect(exit.x * s + 8, exit.y * s + 8, s - 16, s - 16);

    // Label
    ctx.fillStyle = '#a98bff';
    ctx.font = '700 9px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(exitUnlocked ? 'EXIT' : 'LOCK', ex, ey);
  }

  // Draw floating glowing key
  drawKey() {
    const ctx = this.ctx;
    const s = this.tileSize;
    const time = performance.now();

    (this.level.keys || []).forEach((key, index) => {
      if (!key || this.level.collectedKeys?.has(`${key.x},${key.y}`)) return;

      const kx = key.x * s + s / 2;
      const bob = Math.sin(time * 0.005 + index) * 3;
      const ky = key.y * s + s / 2 + bob;

      // Amber aura
      const aura = ctx.createRadialGradient(kx, ky, 1, kx, ky, 24);
      aura.addColorStop(0, 'rgba(248, 184, 94, 0.7)');
      aura.addColorStop(0.5, 'rgba(248, 184, 94, 0.2)');
      aura.addColorStop(1, 'rgba(248, 184, 94, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(kx, ky, 24, 0, Math.PI * 2);
      ctx.fill();

      // Key shape
      ctx.fillStyle = '#f8b85e';
      ctx.beginPath();
      ctx.arc(kx - 4, ky, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0a0f16';
      ctx.beginPath();
      ctx.arc(kx - 4, ky, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8b85e';
      ctx.fillRect(kx, ky - 2, 10, 4);
      ctx.fillRect(kx + 5, ky + 2, 3, 4);
      ctx.fillRect(kx + 9, ky + 2, 3, 3);
    });
  }

  // Draw checkpoint marker
  drawCheckpoint(cp) {
    const ctx = this.ctx;
    const s = this.tileSize;
    const cx = cp.x * s + s / 2;
    const cy = cp.y * s + s / 2;
    const isActive = this.player.checkpoint.x === cp.x && this.player.checkpoint.y === cp.y;

    ctx.save();
    ctx.strokeStyle = isActive ? '#70f4df' : 'rgba(112, 244, 223, 0.35)';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.strokeRect(cp.x * s + 12, cp.y * s + 12, s - 24, s - 24);

    if (isActive) {
      ctx.fillStyle = 'rgba(112, 244, 223, 0.18)';
      ctx.fillRect(cp.x * s + 12, cp.y * s + 12, s - 24, s - 24);
    }

    ctx.fillStyle = isActive ? '#70f4df' : 'rgba(112, 244, 223, 0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw dark mysterious psychological atmosphere & soft vignette around player
  drawAtmosphere() {
    const ctx = this.ctx;
    const s = this.tileSize;
    const px = this.player.x * s + s / 2;
    const py = this.player.y * s + s / 2;
    const visionRadius = s * 4.8;

    ctx.save();
    // Radial darkening vignette from clear near player to dark in distant corridors
    const vignette = ctx.createRadialGradient(px, py, s * 1.5, px, py, visionRadius);
    vignette.addColorStop(0, 'rgba(4, 7, 12, 0)');
    vignette.addColorStop(0.55, 'rgba(4, 7, 12, 0.35)');
    vignette.addColorStop(0.85, 'rgba(4, 7, 12, 0.7)');
    vignette.addColorStop(1, 'rgba(4, 7, 12, 0.9)');

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }
}
