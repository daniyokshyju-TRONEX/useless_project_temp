// ============================================================================
// UNPREDICTABLE - UI Manager
// Manages the heads-up display, modals, buttons, glitch feedback, and screen shake.
// ============================================================================

export class UI {
  constructor(game) {
    this.game = game;

    // HUD Elements
    this.levelValue = document.querySelector('#levelValue');
    this.levelName = document.querySelector('#levelName');
    this.keysValue = document.querySelector('#keysValue');
    this.attemptsValue = document.querySelector('#attemptsValue');
    this.pips = document.querySelector('#attemptPips')?.children || [];
    this.checkpointValue = document.querySelector('#checkpointValue');
    this.checkpointName = document.querySelector('#checkpointName');
    this.statusText = document.querySelector('#statusText');
    this.shell = document.querySelector('.playfield-wrap');

    // Accuracy HUD elements
    this.accuracyBlock = document.querySelector('#accuracyBlock');
    this.accuracyValue = document.querySelector('#accuracyValue');
    this.accuracyBar = document.querySelector('#accuracyBar');
    this.accuracyStatus = document.querySelector('#accuracyStatus');

    // Panels
    this.startPanel = document.querySelector('#startPanel');
    this.pausePanel = document.querySelector('#pausePanel');
    this.messagePanel = document.querySelector('#messagePanel');
    this.messageKicker = document.querySelector('#messageKicker');
    this.messageTitle = document.querySelector('#messageTitle');
    this.messageBody = document.querySelector('#messageBody');
    this.messageAction = document.querySelector('#messageAction');

    this.failOverlay = document.querySelector('#failOverlay');
    this.failPanel = document.querySelector('.fail-panel');
    this.failAction = document.querySelector('#failAction');
    this.gifStage = document.querySelector('#gifStage');
    this.failGif = document.querySelector('#failGif');
    if (this.failGif) {
      this.failGif.addEventListener('error', () => {
        this.gifStage?.classList.add('media-fallback');
      });
    }

    // Buttons
    const startBtn = document.querySelector('#startButton');
    const continueBtn = document.querySelector('#continueButton');
    const restartBtn = document.querySelector('#restartButton');
    const pauseBtn = document.querySelector('#pauseButton');
    const soundBtn = document.querySelector('#soundButton');

    if (startBtn) startBtn.addEventListener('click', () => this.game.start());
    if (continueBtn) continueBtn.addEventListener('click', () => this.game.togglePause(false));
    if (restartBtn) restartBtn.addEventListener('click', () => this.game.restartLevel());
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.game.togglePause());
    if (this.messageAction) this.messageAction.addEventListener('click', () => this.game.messageAction());
    if (this.failAction) this.failAction.addEventListener('click', () => {
      this.showFailGif();
    });

    if (soundBtn) {
      soundBtn.addEventListener('click', (e) => {
        const enabled = this.game.audio.toggle();
        e.currentTarget.textContent = enabled ? 'SOUND ON' : 'SOUND OFF';
      });
    }
  }

  // Synchronize game state with DOM HUD elements
  sync(state) {
    if (this.levelValue) this.levelValue.textContent = `${state.level} / 5`;
    if (this.levelName) this.levelName.textContent = state.levelName || '';
    if (this.keysValue) this.keysValue.textContent = `${state.keys ?? 0} / ${state.totalKeys ?? 0}`;
    if (this.attemptsValue) this.attemptsValue.textContent = state.attempts;

    if (this.checkpointValue) {
      this.checkpointValue.textContent = state.checkpointActive ? 'ACTIVE' : 'ORIGIN';
    }
    if (this.checkpointName) {
      this.checkpointName.textContent = state.checkpointName || 'START';
    }

    if (this.statusText) {
      this.statusText.textContent = state.status || 'SIGNAL STABLE';
    }

    // Update Accuracy HUD
    if (this.accuracyValue) {
      this.accuracyValue.textContent = `${state.accuracy}%`;
    }
    if (this.accuracyBar) {
      this.accuracyBar.style.width = `${state.accuracy}%`;
    }
    if (this.accuracyStatus) {
      if (state.isRegainingAccuracy) {
        this.accuracyStatus.textContent = `REGAINING (${state.regainRemaining}s)`;
      } else if (state.accuracy <= 25) {
        this.accuracyStatus.textContent = 'CRITICAL';
      } else if (state.accuracy <= 50) {
        this.accuracyStatus.textContent = 'DEGRADED';
      } else {
        this.accuracyStatus.textContent = 'OPTIMAL';
      }
    }
    if (this.accuracyBlock) {
      this.accuracyBlock.classList.toggle('depleted', state.isRegainingAccuracy || state.accuracy === 0);
      this.accuracyBlock.classList.toggle('low', !state.isRegainingAccuracy && state.accuracy > 0 && state.accuracy <= 40);
    }

    // Update attempt pips
    if (this.pips) {
      [...this.pips].forEach((pip, idx) => {
        pip.classList.toggle('off', idx >= state.attempts);
      });
    }
  }

  hideStart() {
    if (this.startPanel) this.startPanel.hidden = true;
  }

  pause(show) {
    if (this.pausePanel) this.pausePanel.hidden = !show;
  }

  // Chromatic aberration and CRT scanline glitch on control shift
  glitch() {
    if (!this.shell) return;
    this.shell.classList.remove('control-glitch');
    void this.shell.offsetWidth; // Trigger reflow
    this.shell.classList.add('control-glitch');
    setTimeout(() => {
      this.shell.classList.remove('control-glitch');
    }, 450);
  }

  // Screen shake effect on impact or trap activation
  shake() {
    if (!this.shell) return;
    this.shell.classList.remove('shake');
    void this.shell.offsetWidth; // Trigger reflow
    this.shell.classList.add('shake');
    setTimeout(() => {
      this.shell.classList.remove('shake');
    }, 400);
  }

  // Display modal message (Level complete, Game Over, Win)
  message(kicker, title, body, actionText) {
    if (this.messageKicker) this.messageKicker.textContent = kicker;
    if (this.messageTitle) this.messageTitle.textContent = title;
    if (this.messageBody) this.messageBody.textContent = body;
    if (this.messageAction) this.messageAction.textContent = `${actionText} ↵`;
    if (this.messagePanel) this.messagePanel.hidden = false;
  }

  hideMessage() {
    if (this.messagePanel) this.messagePanel.hidden = true;
  }

  showFailScreen() {
    if (this.failOverlay) this.failOverlay.hidden = false;
    if (this.failPanel) this.failPanel.hidden = false;
    if (this.messagePanel) this.messagePanel.hidden = false;
    if (this.messageKicker) this.messageKicker.textContent = 'FAILURE';
    if (this.messageTitle) this.messageTitle.textContent = 'patathe panikku pono';
    if (this.messageBody) this.messageBody.textContent = 'The maze has claimed the final chance.';
    if (this.messageAction) this.messageAction.textContent = 'onnu koode sremikkam';
  }

  hideFailScreen() {
    if (this.failOverlay) this.failOverlay.hidden = true;
    if (this.failPanel) this.failPanel.hidden = false;
    if (this.gifStage) this.gifStage.hidden = true;
    if (this.gifStage) this.gifStage.classList.remove('media-fallback');
  }

  showFailGif() {
    if (this.failOverlay) this.failOverlay.hidden = false;
    if (this.failPanel) this.failPanel.hidden = true;
    if (this.gifStage) this.gifStage.hidden = false;
    if (this.messagePanel) this.messagePanel.hidden = true;
    if (this.failGif) this.failGif.setAttribute('src', this.failGif.getAttribute('src') || 'assets/fail-placeholder.gif');
  }
}
