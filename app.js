const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { Chess } = require("chess.js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Per-room state
const games = {}; // { roomId: Chess }
const rooms = {}; // { roomId: { white: socketId|null, black: socketId|null } }

app.get("/", (req, res) => {
  res.render("index", { title: "Chess Game", roomId: null });
});

// create a short random room id and redirect
app.get("/create", (req, res) => {
  const roomId = Math.random().toString(36).slice(2, 8);
  res.redirect(`/room/${roomId}`);
});

app.get("/room/:roomId", (req, res) => {
  res.render("index", { title: "Chess Game", roomId: req.params.roomId });
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    if (!roomId) return;
    socket.join(roomId);
    rooms[roomId] = rooms[roomId] || { white: null, black: null };
    games[roomId] = games[roomId] || new Chess();

    const room = rooms[roomId];

    if (!room.white) {
      room.white = socket.id;
      socket.emit("playerRole", "w");
      socket.emit("waiting");
      // ensure new player sees fresh board (initial)
      socket.emit("boardState", games[roomId].fen());
    } else if (!room.black) {
      room.black = socket.id;
      socket.emit("playerRole", "b");
      // start for everyone in the room
      io.to(roomId).emit("start", games[roomId].fen());
    } else {
      // spectator
      socket.emit("spectatorRole");
      socket.emit("boardState", games[roomId].fen());
    }
  });

  socket.on("move", ({ roomId, move }) => {
    try {
      const game = games[roomId];
      const room = rooms[roomId];
      if (!game || !room) return;

      // turn check
      if (game.turn() === "w" && socket.id !== room.white) return;
      if (game.turn() === "b" && socket.id !== room.black) return;

      const result = game.move(move);
      if (result) {
        io.to(roomId).emit("move", move);
        io.to(roomId).emit("boardState", game.fen());
      } else {
        socket.emit("invalidMove", move);
      }
    } catch (err) {
      socket.emit("invalidMove", { error: err.message });
    }
  });

  socket.on("disconnect", () => {
    // remove socket from any rooms mapping and notify room
    Object.keys(rooms).forEach((roomId) => {
      const room = rooms[roomId];
      if (!room) return;
      let changed = false;
      if (room.white === socket.id) {
        room.white = null;
        io.to(roomId).emit("playerLeft", "white");
        changed = true;
      }
      if (room.black === socket.id) {
        room.black = null;
        io.to(roomId).emit("playerLeft", "black");
        changed = true;
      }
      if (changed) {
        // reset game so next two players start fresh
        delete games[roomId];
      }
      // cleanup empty rooms
      if (!room.white && !room.black) {
        delete rooms[roomId];
        delete games[roomId];
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));