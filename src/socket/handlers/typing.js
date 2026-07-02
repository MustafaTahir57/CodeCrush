module.exports = (io, socket) => {
    socket.on("typing:start", ({ chatId }) => {
        socket.to(`chat:${chatId}`).emit("typing:start", {
            chatId,
            userId: socket.user._id.toString()
        });
    });

    socket.on("typing:stop", ({ chatId }) => {
        socket.to(`chat:${chatId}`).emit("typing:stop", {
            chatId,
            userId: socket.user._id.toString()
        });
    });
};