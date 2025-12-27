/*
  VIDEO SOCKET (WebRTC signaling)

  Rules:
  - Socket handles ONLY signaling
  - Auth is already done via HTTP before page load
  - No business logic here
*/

export default function videoSocket(io) {
    io.on("connection", (socket) => {
        console.log("Socket connected:", socket.id);

        /* =========================
           JOIN ROOM
        ========================= */
        socket.on("join-room", ({ roomId, role }) => {
            if (!roomId || !role) {
                return;
            }

            socket.join(roomId);
            socket.roomId = roomId;
            socket.role = role;

            console.log(`Socket ${socket.id} joined room ${roomId} as ${role}`);

            // Notify other peer
            socket.to(roomId).emit("peer-joined", {
                role
            });
        });

        /* =========================
           WEBRTC SIGNALING
        ========================= */
        socket.on("signal", ({ roomId, payload }) => {
            if (!roomId || !payload) return;

            socket.to(roomId).emit("signal", payload);
        });

        /* =========================
           CALL ENDED
        ========================= */
        socket.on("call-ended", ({ roomId }) => {
            if (!roomId) return;

            io.to(roomId).emit("call-ended");
            io.in(roomId).socketsLeave(roomId);

            console.log(`Call ended in room ${roomId}`);
        });

        /* =========================
           DISCONNECT CLEANUP
        ========================= */
        socket.on("disconnect", () => {
            if (socket.roomId) {
                socket.to(socket.roomId).emit("peer-disconnected", {
                    role: socket.role
                });
            }

            console.log("Socket disconnected:", socket.id);
        });
    });
}
