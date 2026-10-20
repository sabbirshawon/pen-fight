# Pen Fight 🖊️⚔️

The school desk game. Flick your pen to knock the other pen off the desk.

- **vs Computer**: three AI levels (Easy, Normal, Hard). The AI tests shots in the physics before it picks one.
- **2 players**: two people on one device, taking turns.
- **Online**: Quick match, or a private room with a 5-letter code and an invite link. Both players see the same aim live, there is a 30 s turn timer, quick reactions (emotes) and rematch.
- 8 pens that play differently, pen levels, Classic or Real look, 2 desks, English and বাংলা, light and dark theme, stats, a leaderboard and world stats.

## Run it

```bash
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

The game needs a Node server for online play, for example Render, Railway, Fly.io or a VPS:

- Start command: `npm start`
- `PORT` is read from the environment
- `DATA_DIR` (optional) sets where `stats.json` is saved. Point it at a persistent disk.

## Moving to Flutter later

- `shared/physics.js` and `shared/game.js` hold all the rules and do not depend on the browser. They map directly to Dart. Matter.js maps to **Forge2D** (Flame).
- The online protocol (Socket.IO events `room:create`, `room:join`, `quick`, `shot`, `aim`, `turn`, `round:start`, `match:start`, `rematch`, `emote`) can be reused with the `socket_io_client` Dart package. Because the server sends recorded frames, the Flutter client only has to play them back, and it can play against the same server as the web version.
