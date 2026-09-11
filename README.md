# UNPREDICTABLE

A browser-based top-down psychological trap maze. The maze is authored, but the meaning of your arrow keys is not guaranteed.

## Run in VS Code

1. Open the `unpredictable-game` folder in Visual Studio Code.
2. Install the **Live Server** extension, or use any simple static server.
3. Open `index.html` with Live Server.
4. Click **START GAME** and use the arrow keys. Press `Escape` to pause.

No build step, framework, package manager, backend, or paid asset is required.

## Controls

- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`: attempt movement.
- `Escape`: pause or continue.
- `Enter`: activate the visible start, retry, or next-level action.
- `RESTART RUN`: restart the current level with a small authored variation.

For local testing only, type `TEST` to unlock the current exit, `WIN` to run the real level-complete flow, or `LIMIT` to preview the move-limit game-over screen. These sequences are intentionally undocumented in the game UI.

The current mapping is intentionally hidden. The only reliable information is what the maze teaches you through movement, feedback, and repetition.

## Game mechanics

Five levels use a fixed, validated tile layout. Each has a start, locked exit, key, checkpoint, alternate corridors, and a surprise mechanic. Keys can change the control mode. Reaching an exit requires its key.

The game uses a controlled pattern rather than pure randomness. A room always applies its own kind of rotation, reversal, delay, or shuffle. Restarting can move some traps by one tile, but the underlying route remains valid.

The HUD accuracy meter starts at `100%` and drops by `1%` on every arrow-key press, including blocked or mistimed presses. At `0%`, movement locks until a new run begins and resets the meter.

Each level calculates an exact move target: the shortest authored route from the start to the key plus the shortest route from the key to the exit. The HUD shows `MOVES / TARGET`; the exit only completes the level at the target, while extra movement invalidates the run. The map presentation changes between runs and after a death without changing the validated collision layout.

The route is hidden by a player-centered fog of war. Only a short area around the character is revealed, so players must remember discovered corridors and landmarks. The camera uses a shallow side-elevation projection so the maze reads like a side-view structure while retaining its grid movement.

Each successful step costs `1%` accuracy and advances a four-phase channel shift. Nearby open directions are shown as faint channel lines, while one direction becomes temporarily emphasized, making the maze react in a controlled but hard-to-predict way. At `1%` accuracy, each block requires 20 arrow-key presses. Blocked presses do not spend accuracy.

## Trap system

Trap definitions live in `js/levels.js` and are executed by `js/traps.js`.

Supported trap types include:

- `spike`, `falling`, `fake-safe`, `invisible`, `reset`, `moving-enemy`: reset at the latest checkpoint and consume an attempt.
- `teleport`: move to a designed destination.
- `direction`: activate `NORMAL`, `REVERSED`, `ROTATED_LEFT`, `ROTATED_RIGHT`, `MIRRORED`, or `RANDOMIZED` controls.
- `delay`: queue inputs for a configurable number of milliseconds.
- `temporary-wall`: briefly blocks the tile.
- `one-way`: refuses movement against one corridor direction.
- `control-zone`: changes controls when entered.

Discovered trap tiles receive a subtle indicator, but unknown tiles stay ambiguous.

## Control-shuffle system

`js/controls.js` contains the modular `ControlManager`. It exposes:

- `setNormalControls()`
- `setReversedControls()`
- `setRotatedControls('left' | 'right')`
- `setMirroredControls()`
- `setRandomControls(seed)`
- `setDelayedControls(milliseconds)`
- `resetControls()`

The public `controlMap` concept is represented by `ControlManager.map`; the visible HUD never prints it.

## Add a level

Add a `base(...)` entry to `LEVELS` in `js/levels.js`. Provide:

1. A rectangular array of strings using `#` for walls and any other character for floor.
2. `start`, `exit`, and `key` coordinates.
3. A trap array, checkpoint array, and control-zone array.
4. A level name and hint.

The game runs `findPath()` when loading and refuses an authored map with no wall-ignoring route from start to exit.

## Modify mappings

Edit the direction values passed to `setMap()` in `js/controls.js`. Direction names are `up`, `right`, `down`, and `left`. Add a new setter there, then call it from `Game.changeControls()` or a trap definition.

## Audio and visuals

`js/audio.js` uses short Web Audio API tones only. `style.css` controls the interface. Canvas rendering and the atmospheric grid are in `js/game.js`. No external media files are needed.
