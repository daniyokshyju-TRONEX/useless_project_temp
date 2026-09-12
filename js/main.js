import { Game } from './game.js';

const canvas = document.querySelector('#gameCanvas');
const game = new Game(canvas);
window.unpredictable = game;
