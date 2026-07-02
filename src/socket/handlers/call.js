module.exports = (io, socket) => {
    const userId = socket.user._id.toString();

    socket.on("call:initiate", ({ chatId, toUserId, callType }) => {
        io.to(`user:${toUserId}`).emit("call:incoming", {
            chatId,
            callType,
            from: {
                _id: socket.user._id,
                firstName: socket.user.firstName,
                lastName: socket.user.lastName,
                profilePicture: socket.user.profilePicture,
            },
        });
        console.log(`Call initiated by ${userId} to ${toUserId}`);
    });

    socket.on("call:accept", ({ chatId, toUserId }) => {
        io.to(`user:${toUserId}`).emit("call:accepted", { chatId, userId });
        console.log(`Call accepted by ${userId}`);
    });

    socket.on("call:reject", ({ chatId, toUserId }) => {
        io.to(`user:${toUserId}`).emit("call:rejected", { chatId, userId });
        console.log(`Call rejected by ${userId}`);
    });

    socket.on("webrtc:offer", ({ toUserId, offer }) => {
        io.to(`user:${toUserId}`).emit("webrtc:offer", { offer, fromUserId: userId });
    });

    socket.on("webrtc:answer", ({ toUserId, answer }) => {
        io.to(`user:${toUserId}`).emit("webrtc:answer", { answer, fromUserId: userId });
    });

    socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
        io.to(`user:${toUserId}`).emit("webrtc:ice-candidate", { candidate, fromUserId: userId });
    });

    socket.on("call:end", ({ toUserId, chatId }) => {
        io.to(`user:${toUserId}`).emit("call:ended", { chatId, userId });
        console.log(`Call ended by ${userId}`);
    });
};