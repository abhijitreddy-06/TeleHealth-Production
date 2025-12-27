export default function videoSocket(io) {
    io.on("connection", socket => {

        socket.on("join-room", ({ roomId, role }) => {
            socket.join(roomId);
            socket.roomId = roomId;

            if (role === "user") {
                socket.to(roomId).emit("user-ready");
            }
        });

        socket.on("signal", ({ roomId, payload }) => {
            socket.to(roomId).emit("signal", payload);
        });

        socket.on("call-ended", ({ roomId }) => {
            io.to(roomId).emit("call-ended", { roomId });
            io.in(roomId).socketsLeave(roomId);
        });

    });
}
