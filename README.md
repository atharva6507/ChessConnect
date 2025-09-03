# chessconnect — Rooms & Flow

This document describes the room implementation and overall runtime flow for the Chesscom Clone project (server, client, sockets). Use it as the single-source guide for how rooms are created, joined, how game state is managed, and where to find the relevant code.

## Project overview (high level)
- Express + EJS serves the UI.
- Socket.IO handles realtime messaging between clients and server.
- chess.js maintains game rules/state on the server per-room.
- A room is a short random code (e.g. `/room/abc123`) that groups players and spectators.
- Files of interest:
  - `app.js` — server, routes, socket logic (rooms, games map).
  - `views/index.ejs` — main page; injects `window.ROOM_ID`.
  - `public/js/chessgame.js` — client logic (UI, dragging, sockets).
  - `public/css/chessgame.css` — board styles.

## How rooms work (implementation summary)
- Server maintains two in-memory structures:
  - `games = { [roomId]: ChessInstance }` — game state per room.
  - `rooms = { [roomId]: { white: socketId|null, black: socketId|null } }` — player slots.
- Routes:
  - `GET /` — lobby (create / join UI).
  - `GET /create` — creates a short random room id and redirects to `/room/:id`.
  - `GET /room/:roomId` — renders the page with `ROOM_ID` injected.
- Client auto-joins room (if `ROOM_ID` present) by emitting `joinRoom` socket event.

## Socket events (server ↔ client)
- Client -> Server
  - `joinRoom` (roomId: string)
    - Client joins socket.io room and server assigns role.
  - `move` ({ roomId, move })
    - Sent when player attempts a move (from, to, promotion). Server validates and applies.
- Server -> Client
  - `playerRole` (role: "w" | "b")
    - Informs client of assigned role.
  - `waiting`
    - Sent to first player when waiting for opponent.
  - `start` (fen: string)
    - Sent to entire room when both players are present. Includes initial FEN.
  - `boardState` (fen: string)
    - Current board FEN; sent after moves or when a spectator connects.
  - `move` (move)
    - Broadcast when server accepts a move; clients apply and re-render.
  - `spectatorRole`
    - Sent to extra connections; they receive `boardState` and cannot move.
  - `invalidMove` (payload)
    - Sent to the client if move rejected/invalid.
  - `playerLeft` (who: "white" | "black")
    - Sent when a player disconnects. Server resets the game state for the room.

## Runtime sequence (create/join & play)
1. User A visits `/`:
   - Clicks "Create Room".
   - Server generates ID `roomId` and redirects to `/room/:roomId`.
2. User A (tab1) loads `/room/:roomId`:
   - EJS injects `ROOM_ID`.
   - Client emits `joinRoom` with `roomId`.
   - Server: if white slot empty — assigns `white`, sends `playerRole: "w"`, sends `waiting`, and `boardState` (initial FEN).
   - Client shows waiting UI.
3. User B opens same `/room/:roomId` (or uses Join flow):
   - Client emits `joinRoom`.
   - Server assigns `black` if available, then emits `start` (fen) to room.
   - Both clients switch to game UI; `started = true`.
4. Play:
   - Player whose turn it is drags/drops a piece.
   - Client emits `move` with `{ roomId, move }`.
   - Server validates with chess.js; if valid:
     - Applies move to `games[roomId]`.
     - Emits `move` and `boardState` to entire room.
     - If invalid, emits `invalidMove` to the origin socket.
5. Spectators:
   - Any extra clients join same `roomId` and receive `spectatorRole` + `boardState`. They cannot move.
6. Disconnects:
   - On player disconnect, server clears that slot, emits `playerLeft`, and deletes `games[roomId]` so next pair starts fresh.
   - Empty rooms are cleaned up from `rooms` and `games`.

## Client behavior & key details
- `views/index.ejs` injects `window.ROOM_ID`.
- `public/js/chessgame.js`:
  - Auto-join when `ROOM_ID` exists: `socket.emit("joinRoom", roomId)`.
  - UI shows lobby when not in a room.
  - Board renders only after `start` or when receiving `boardState`.
  - Moves include `roomId` in emitted payload: `socket.emit("move", { roomId, move })`.
  - Valid move confirmation: when client receives `move` event, it clears `statusEl.innerText` (this avoids stale messages).
  - If server sends `invalidMove` the UI shows an error.

## How to run (quick)
1. Install dependencies:
   - npm install express socket.io ejs chess.js
2. Run server:
   - node app.js
   - or with nodemon: npx nodemon app.js
3. Open browser:
   - http://localhost:3000 — create room or join with code.

## Troubleshooting / common checks
- No board shown:
  - Ensure `window.ROOM_ID` is set in `index.ejs` for `/room/:id`.
  - Confirm `socket.emit("joinRoom", roomId)` ran and server logged the connect/join.
- Move rejected:
  - Confirm `move` payload shape is `{ roomId, move }`.
  - Ensure server and client use compatible chess.js versions.
  - Confirm turn enforcement: server checks `game.turn()` against stored socket id.
- Socket fail to connect:
  - Ensure `<script src="/socket.io/socket.io.js"></script>` is present or using matching CDN/socket.io version.

## Next improvements (suggestions)
- Persist rooms/games to Redis for multi-process or restart-safe state.
- Add copy-to-clipboard for room link and nicer UI/UX.
- Add reconnection logic: reassign role when player reconnects (based on token).
- Add matchmaking and room expiry (delete inactive rooms after X minutes).

## Files to inspect for implementation
- `app.js` — where `games` and `rooms` are defined and socket handlers live.
- `views/index.ejs` — ROOM_ID injection and lobby/game DOM.
- `public/js/chessgame.js` — UI, join/create flows, socket events and move emission.
- `public/css/chessgame.css` — board styling.
