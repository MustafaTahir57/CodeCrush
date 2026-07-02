const Chat = require("../../models/chat");
const Message = require("../../models/message");

module.exports = (io, socket) => {
    const userId = socket.user._id.toString();

    socket.on("chat:join", async ({ chatId }) => {
        try {
            const chat = await Chat.findById(chatId);
            if (!chat) return;

            const isParticipant = chat.participants.some(
                (p) => p.toString() === userId
            );
            if (!isParticipant) return;

            socket.join(`chat:${chatId}`);

            await Message.updateMany(
                { chatId, sender: { $ne: userId }, readBy: { $nin: [userId] } },
                { $addToSet: { readBy: userId } }
            );

            await Chat.findByIdAndUpdate(chatId, {
                [`lastReadAt.${userId}`]: new Date(),
            });

            console.log(`User ${userId} joined chat ${chatId}`);
        } catch (err) {
            console.error("chat:join error", err.message);
        }
    });

    socket.on("chat:leave", ({ chatId }) => {
        socket.leave(`chat:${chatId}`);
        console.log(`User ${userId} left chat ${chatId}`);
    });

    socket.on("message:send", async ({ chatId, type = "text", text, attachment }) => {
        try {
            const chat = await Chat.findById(chatId);
            if (!chat) return;

            const isParticipant = chat.participants.some(
                (p) => p.toString() === userId
            );
            if (!isParticipant) return;

            if (type === "text" && !text?.trim()) return;
            if ((type === "image" || type === "file") && !attachment?.url) return;

            const message = new Message({
                chatId,
                sender: userId,
                type,
                text: text || "",
                attachment: attachment || {},
                readBy: [userId],
            });

            await message.save();
            await message.populate("sender", ["firstName", "lastName", "profilePicture"]);

            await Chat.findByIdAndUpdate(chatId, {
                lastMessage: {
                    text: type === "text" ? text : `Sent a ${type}`,
                    sender: userId,
                    sentAt: new Date(),
                    type,
                },
                updatedAt: new Date(),
            });

            io.to(`chat:${chatId}`).emit("message:new", message);

            chat.participants.forEach((participantId) => {
                io.to(`user:${participantId.toString()}`).emit("message:new", message);
            });

        } catch (err) {
            console.error("message:send error", err.message);
        }
    });

    socket.on("message:read", async ({ chatId, messageId }) => {
        try {
            const message = await Message.findByIdAndUpdate(
                messageId,
                { $addToSet: { readBy: userId } },
                { new: true }
            );

            if (!message) return;

            await Chat.findByIdAndUpdate(chatId, {
                [`lastReadAt.${userId}`]: new Date(),
            });

            io.to(`chat:${chatId}`).emit("message:read", {
                chatId,
                messageId,
                userId,
            });

        } catch (err) {
            console.error("message:read error", err.message);
        }
    });
};