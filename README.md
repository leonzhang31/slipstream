Slipstream

A 2D drift racing game. The car accelerates on its own. You only steer left and right. Hitting walls slows you down.

Running it

Open dist/index.html in a browser, or run this from the slipstream folder:

python3 -m http.server 4173 --bind 127.0.0.1 --directory dist

Then open http://localhost:4173.

There is nothing to install or build.

Controls

Player 1: A / D
Player 2: Left / Right arrows
Player 3: J / L
Player 4: V / N

When playing alone, you can also use the arrow keys.
P or Escape pauses. R restarts.

Race setup

Open Race setup above the track to change the mode, circuit, cars and difficulty.

Races last three laps. You can have up to 20 cars, including up to four people on the same keyboard. Online multiplayer is not supported.

The AI levels are Beginner, Standard, Advanced and Expert. Rival styles change how aggressively bots pass other cars.

Derby has stronger collisions and more spinning. Finish three laps or wreck all the bots to win. Players have five times the bots' durability by default, but can still wreck. Scrapyard Bowl is the dedicated Derby track.

Personal best chase lets you race alone against a ghost of your fastest lap. Complete a lap to record your first ghost.

Cars and damage

Apex is balanced, Spark changes direction quickly, and Comet holds longer slides.

Under Tune car, each player can change horsepower and starting position. There are no gears or pedals.

Durability has separate settings for players and bots, from 0.5x to 10x. Higher values mean less damage. Changes restart the race.

Hard hits damage cars and can spin them into barriers. Damaged cars lose performance. At zero health, a car is out. Other human players can keep going until everyone wrecks or someone finishes. Restarting repairs all cars.

Following another car gives you a slipstream. Clean drifts give a small automatic speed boost when you straighten out.

Settings, lap times and ghosts are saved in your browser. Records are kept separately for different cars, power and durability settings.

Tracks

The Foundry, Velocity Ring, Tidal Run, Switchback and Scrapyard Bowl are original tracks.

Monza, Spa, Silverstone and Interlagos are based on F1 circuits, with wider roads, shorter straights and extra bends for drifting. They are not exact replicas.

Sharing the game

Upload the contents of dist to a static host such as GitHub Pages, Netlify or itch.io. Keep index.html at the root, alongside game.js, style.css, data and licenses.

Tests

The tests use Node.js. Run them from the slipstream folder:

node tests/simulation.cjs
node tests/traffic.cjs
node tests/damage.cjs
node tests/party.cjs
node tests/derby.cjs
node tests/durability.cjs

The other files in tests cover car setup, drifting, slipstreams, ghosts, collisions and performance.

Track data

The game is released under the MIT license. See LICENSE.

The F1 circuit outlines come from Tomislav Bacinger's f1-circuits project:
https://github.com/bacinger/f1-circuits

The data is used under the MIT license. The notice is in dist/licenses/f1-circuits-LICENSE.txt.

To update the bundled circuit data, run python3 tools/import-circuits.py. This needs internet access and curl. To rebuild the drift layouts from the existing data, run python3 tools/make-drift-layouts.py.
