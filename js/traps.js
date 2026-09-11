export class TrapManager {
  constructor(game) { this.game = game; this.discovered = new Set(); this.triggered = new Set(); this.temporaryWalls = []; }
  load(level) { this.level = level; this.discovered.clear(); this.triggered.clear(); this.temporaryWalls = []; }
  trapAt(x, y) { return this.level.traps.find(trap => trap.x === x && trap.y === y); }
  checkpointAt(x, y) { return this.level.checkpoints.find(point => point.x === x && point.y === y); }
  zoneAt(x, y) { return this.level.zones.find(zone => zone.x === x && zone.y === y); }
  handleTile(x, y) {
    const trap = this.trapAt(x, y); const key = `${x},${y}`;
    if (trap) {
      this.discovered.add(key);
      if (!this.triggered.has(key) || ['direction', 'control-zone', 'delay'].includes(trap.type)) { this.triggered.add(key); this.activate(trap); }
    }
    const checkpoint = this.checkpointAt(x, y); if (checkpoint) this.game.activateCheckpoint(checkpoint);
    const zone = this.zoneAt(x, y); if (zone && !this.triggered.has(`zone-${key}`)) { this.triggered.add(`zone-${key}`); this.game.changeControls(zone.mode, zone.seed); }
  }
  activate(trap) {
    this.game.ui.status.textContent = trap.label || 'THE FLOOR ANSWERS';
    switch (trap.type) {
      case 'spike': case 'falling': case 'fake-safe': case 'invisible': case 'reset': case 'moving-enemy': this.game.damage(trap.label); break;
      case 'teleport': this.game.teleport(trap.to); break;
      case 'direction': case 'control-zone': this.game.changeControls(trap.mode, trap.seed); break;
      case 'delay': this.game.controls.setDelayedControls(trap.delay || 500); this.game.notifyControlChange('DELAYED INPUT'); break;
      case 'temporary-wall': this.temporaryWalls.push({ x: trap.x, y: trap.y, ttl: 4200 }); this.game.notifyControlChange('A WALL MOVED'); break;
      case 'one-way': this.game.oneWay = trap.direction; this.game.notifyControlChange('ONE-WAY CORRIDOR'); break;
    }
  }
  update(delta) { this.temporaryWalls = this.temporaryWalls.map(wall => ({ ...wall, ttl: wall.ttl - delta })).filter(wall => wall.ttl > 0); }
  isWall(x, y) { return this.temporaryWalls.some(wall => wall.x === x && wall.y === y); }
  drawHints(ctx, size) {
    for (const trap of this.level.traps) {
      const known = this.discovered.has(`${trap.x},${trap.y}`); const px = trap.x * size; const py = trap.y * size;
      ctx.save(); ctx.translate(px + size / 2, py + size / 2);
      if (known) { ctx.globalAlpha = .36; ctx.strokeStyle = trap.type === 'spike' ? '#ff6574' : '#f8b85e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, size * .25, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.globalAlpha = .08; ctx.fillStyle = '#a98bff'; ctx.fillRect(-1, -1, 2, 2); }
      ctx.restore();
    }
  }
}
