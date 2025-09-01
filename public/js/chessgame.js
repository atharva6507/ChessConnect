const socket = io();
const chess = new Chess();

const boardElement = document.querySelector(".chessboard");

// Drag and Drop:
// Implement drag and drop functionality for moving chess pieces on the board.
// Pieces are draggable only if it's the player's turn.
// Event listeners for drag start, drag end, drag over, and drop events are attached to handle drag and drop interactions.

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

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
                pieceElement.draggable = playerRole === square.color;
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
                if(draggedPiece) {
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

    socket.emit("move", move);
}

socket.on("playerRole", (role) => {
    playerRole = role;
    renderBoard();
})

socket.on("boardState", (fen) => {
    chess.load(fen);
    renderBoard();
})

socket.on("move", (move) => {
    chess.move(move);
    renderBoard();
})

renderBoard();