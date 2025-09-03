const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");

// UI elements (may be present in your page)
const lobbyEl = document.getElementById("lobby");
const gameAreaEl = document.getElementById("gameArea");
const statusEl = document.getElementById("status");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const joinInput = document.getElementById("joinInput");
const roomLink = document.getElementById("roomLink");

// Drag and Drop:
let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let roomId = window.ROOM_ID || null;
let started = false;

const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add(
                "square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            );

            squareElement.dataset.row = rowIndex;
            squareElement.dataset.column = squareIndex;

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                );
                pieceElement.innerText = getPieceUnicode(square);

                // Only allow dragging if:
                // - we have a role (not a spectator)
                // - the piece color matches player's role
                // - it's that color's turn
                pieceElement.draggable = !!(playerRole && playerRole === square.color && chess.turn() === square.color && started);

                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowIndex, column: squareIndex };
                        e.dataTransfer.setData("text/plain", "");
                    }
                });
                pieceElement.addEventListener("dragend", (e) => {
                    draggedPiece = null;
                    sourceSquare = null;
                });

                squareElement.appendChild(pieceElement);
            }

            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if(draggedPiece && sourceSquare) {
                    const targetSource = {
                        row: parseInt(squareElement.dataset.row),
                        column: parseInt(squareElement.dataset.column)
                    }

                    handleMove(sourceSquare, targetSource);
                }
            })

            boardElement.appendChild(squareElement);
        })
    })

    if(playerRole === "b") {
        boardElement.classList.add("flipped");
    }
    else {
        boardElement.classList.remove("flipped");
    }
}

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♙",
        n: "♘",
        b: "♗",
        r: "♖",
        q: "♕",
        k: "♔",
        P: "♟",
        N: "♞",
        B: "♝",
        R: "♜",
        Q: "♛",
        K: "♚"
    }

    return unicodePieces[piece.type] || "";
}

const handleMove = (sourceSquare, targetSquare) => {
    const move = {
        from: `${String.fromCharCode(97 + sourceSquare.column)}${8 - sourceSquare.row}`,
        to: `${String.fromCharCode(97 + targetSquare.column)}${8 - targetSquare.row}`,
        promotion: "q"
    }

    // include roomId with the move (server expects { roomId, move })
    socket.emit("move", { roomId, move });
}

// Socket handlers
socket.on("playerRole", (role) => {
    playerRole = role;
    if (statusEl) {
        if (role === "w") statusEl.innerText = "You are White (waiting for black...)";
        else if (role === "b") statusEl.innerText = "You are Black";
    }
    renderBoard();
})

socket.on("waiting", () => {
    started = false;
    if (lobbyEl) lobbyEl.classList.add("hidden");
    if (gameAreaEl) gameAreaEl.classList.remove("hidden");
    if (statusEl) statusEl.innerText = "Waiting for opponent to join...";
})

socket.on("start", (fen) => {
    started = true;
    chess.load(fen);
    if (lobbyEl) lobbyEl.classList.add("hidden");
    if (gameAreaEl) gameAreaEl.classList.remove("hidden");
    if (statusEl) {
        if (playerRole === "w") statusEl.innerText = "Your move (White)";
        else if (playerRole === "b") statusEl.innerText = "Black to move";
        else statusEl.innerText = "Spectator";
    }
    renderBoard();
})

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
})

socket.on("move", (move) => {
    chess.move(move);
    if(statusEl) statusEl.innerText = "";
    renderBoard();
})

socket.on("spectatorRole", () => {
    playerRole = null;
    if (statusEl) statusEl.innerText = "Spectator";
    renderBoard();
})

socket.on("playerLeft", (who) => {
    started = false;
    if (statusEl) statusEl.innerText = `${who} left. Waiting / refresh to start new game.`;
    renderBoard();
})

socket.on("invalidMove", (payload) => {
    // server rejected move
    if (statusEl) statusEl.innerText = "Invalid move";
})

// UI: create / join handling (expects server routes /create and /room/:code)
if (createBtn) {
    createBtn.addEventListener("click", () => {
        window.location.href = "/create";
    });
}
if (joinBtn && joinInput) {
    joinBtn.addEventListener("click", () => {
        const code = joinInput.value.trim();
        if (!code) return;
        window.location.href = `/room/${code}`;
    });
}

// Auto-join room if ROOM_ID is present on page (server should inject it)
if (roomId) {
    if (roomLink) roomLink.innerText = `Room: ${roomId} — share: ${window.location.origin}/room/${roomId}`;
    socket.emit("joinRoom", roomId);
} else {
    // keep lobby visible if present
    if (lobbyEl) lobbyEl.classList.remove("hidden");
}

renderBoard();