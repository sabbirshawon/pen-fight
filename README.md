# Pen Fight 🖊️⚔️

The school desk game. Flick your pen to knock the other pen off the desk.

**▶ Play now: https://pen-fight-cdx4.onrender.com**

- **vs Computer**: three AI levels (Easy, Normal, Hard). The AI tests shots in the physics before it picks one.
- **2 players**: two people on one device, taking turns.
- **Online**: Quick match, or a private room with a 5-letter code and an invite link. Both players see the same aim live, there is a 30 s turn timer, quick reactions (emotes) and rematch.
- 8 pens that play differently, pen levels, Classic or Real look, 2 desks, English and বাংলা, light and dark theme, stats, a leaderboard and world stats.
- **Desk clutter**: an eraser, sharpener or ruler on the desk that pens bounce off. The layout changes every round, and it works online too.
- **Daily challenge**: a new task every day (the same one for everyone), with a streak and a pen-level reward.
- **Badges**: 18 badges for special wins and shots, such as Trick shot, Comeback and Bank shot.
- **Instant replay**: the knockout flick plays again in slow motion, and you can watch it again from the result screen.

## Run it

```bash
git clone https://github.com/sabbirshawon/pen-fight.git
cd pen-fight
npm install
npm start          # http://localhost:3000
```

`npm run dev` restarts the server when files change. `npm test` runs a headless physics check.

## How it is built

| Part | Tech |
|---|---|
| Physics engine | [Matter.js](https://brm.io/matter-js/) (with a custom bounce between pens and friction that depends on direction) |
| Rendering | HTML5 Canvas 2D. The wood desks and the pens are drawn in code, so there are no image files |
| Server | Node.js, Express, Socket.IO |
| Sound | Web Audio, made in code |

```
shared/        same code runs in the browser and on the server
  pens.js      pen stats and levels
  physics.js   Matter.js simulation: a shot is simulated to the end and recorded as frames
  game.js      match rules: turns, rounds, desk shrink, winner
server/
  index.js     online rooms, quick match, turn timer, world stats (data/stats.json)
public/
  index.html, css/style.css
  js/main.js   screens and match flow
  js/game.js   canvas view, flick input, aim guide, playback, effects
  js/ai.js     computer player
  js/render.js wood texture and pen drawing
  js/i18n.js   English / বাংলা
```

**How online stays in sync:** the server runs the same physics. When a player flicks, the server simulates the whole shot and sends the recorded frames to both players. Both screens play back exactly the same motion, and nobody can fake a result.

## Rules

- Grab your pen, pull back, let go. Pull further for more power. Grab near a tip to spin it.
- A pen falls when its middle leaves the desk. Knock theirs off to win the round. If your own pen falls, you lose the round. If both fall, the round is replayed.
- After 6 flicks the desk shrinks every 2 flicks. A red dashed line shows the next edge.

## Deploy

The live game runs on Render. Any host that runs Node works, for example Render, Railway, Fly.io or a VPS:

- Start command: `npm start`
- `PORT` is read from the environment
- `DATA_DIR` (optional) sets where `stats.json` is saved. Point it at a persistent disk.

## Contributing

Contributions are welcome: a new pen, a smarter computer player, a new desk, a translation, a bug fix. Small fixes and big ideas are both fine.

### Found a bug or have an idea?

[Open an issue](https://github.com/sabbirshawon/pen-fight/issues/new/choose). There are two templates:

- **Bug report**: what happened, what you expected, and your device and browser. A screenshot helps a lot.
- **Feature or idea**: what you would like to see and why it would make the game more fun.

Before you open one, check the [open issues](https://github.com/sabbirshawon/pen-fight/issues) in case someone already reported it.

### Sending a pull request

1. Fork the repo and create a branch: `git checkout -b my-change`
2. Make your change and run the game with `npm start`.
3. If you changed the physics or the rules, run `npm test` and play a few matches. Online play uses the same code on the server, so test **vs Computer** and **Online** (two browser windows are enough).
4. Commit with a short, clear message and open a pull request. Say what you changed and why, and add a screenshot if the change is visible.

### Good first ideas

- A new pen in `shared/pens.js` with its own drawing in `public/js/render.js`
- A new language in `public/js/i18n.js`
- New desk carvings and doodles in `public/js/render.js`
- Better computer play in `public/js/ai.js`

Please keep the code style of the file you are editing. There is no build step, so plain JavaScript modules are the way to go.

## Moving to Flutter later

- `shared/physics.js` and `shared/game.js` hold all the rules and do not depend on the browser. They map directly to Dart. Matter.js maps to **Forge2D** (Flame).
- The online protocol (Socket.IO events `room:create`, `room:join`, `quick`, `shot`, `aim`, `turn`, `round:start`, `match:start`, `rematch`, `emote`) can be reused with the `socket_io_client` Dart package. Because the server sends recorded frames, the Flutter client only has to play them back, and it can play against the same server as the web version.
