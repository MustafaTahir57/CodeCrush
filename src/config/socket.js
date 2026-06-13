const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Chat = require("../models/chat");
const Message = require("../models/message");

const onlineUsers = new Map(); // userId -> Set of socketIds

const ConnectionRequest = require("../models/connectionRequest");

const JWT_KEY = process.env.JWT_KEY

const notifyConnections = async (io, userId, presenceData) => {
    try {
        // Find all accepted connections for this user
        const connections = await ConnectionRequest.find({
            $or: [
                { fromUserId: userId, status: "accepted" },
                { toUserId: userId, status: "accepted" },
            ],
        });

        // For each connection, emit to their personal room
        connections.forEach((conn) => {
            const otherUserId =
                conn.fromUserId.toString() === userId
                    ? conn.toUserId.toString()
                    : conn.fromUserId.toString();

            io.to(`user:${otherUserId}`).emit("presence:update", {
                userId,
                ...presenceData,
            });
        });

    } catch (err) {
        console.error("notifyConnections error:", err.message);
    }
};

const initSocket = (server) => {

    const io = new Server(server, {
        cors: {
            origin: "http://localhost:8080",
            credentials: true,
        },
    });

    // Auth middleware for every socket connection
    io.use(async (socket, next) => {
        try {
            const cookies = cookie.parse(socket.handshake.headers.cookie || "");
            const token = cookies.token;

            if (!token) {
                return next(new Error("Authentication error: No token"));
            }

            const decoded = jwt.verify(token, JWT_KEY);
            const user = await User.findById(decoded._id);

            if (!user) {
                return next(new Error("Authentication error: User not found"));
            }

            socket.user = user;
            next();

        } catch (err) {
            next(new Error("Authentication error: " + err.message));
        }
    });


    io.on("connection", async (socket) => {
        const userId = socket.user._id.toString();

        // Add to online users map
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);

        // Join personal room
        socket.join(`user:${userId}`);

        console.log(`User ${userId} connected — socket ${socket.id}`);

        // Tell all connections this user is online
        await notifyConnections(io, userId, { online: true, lastSeen: null });

        // Join a chat room
        socket.on("chat:join", async ({ chatId }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;

                const isParticipant = chat.participants.some(
                    (p) => p.toString() === userId
                );
                if (!isParticipant) return;

                socket.join(`chat:${chatId}`);

                // Mark all messages as read
                await Message.updateMany(
                    { chatId, sender: { $ne: userId }, readBy: { $nin: [userId] } },
                    { $addToSet: { readBy: userId } }
                );

                // Update lastReadAt on Chat
                await Chat.findByIdAndUpdate(chatId, {
                    [`lastReadAt.${userId}`]: new Date(),
                });

                console.log(`User ${userId} joined chat ${chatId}`);

            } catch (err) {
                console.error("chat:join error", err.message);
            }
        });


        // Leave a chat room
        socket.on("chat:leave", ({ chatId }) => {
            socket.leave(`chat:${chatId}`);
            console.log(`User ${userId} left chat ${chatId}`);
        });


        // Send a message
        socket.on("message:send", async ({ chatId, type = "text", text, attachment }) => {
            try {
                const chat = await Chat.findById(chatId);
                if (!chat) return;

                const isParticipant = chat.participants.some(
                    (p) => p.toString() === userId
                );
                if (!isParticipant) return;

                // Validate
                if (type === "text" && !text?.trim()) return;
                if ((type === "image" || type === "file") && !attachment?.url) return;

                // Save message
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

                // Update lastMessage on Chat
                await Chat.findByIdAndUpdate(chatId, {
                    lastMessage: {
                        text: type === "text" ? text : `Sent a ${type}`,
                        sender: userId,
                        sentAt: new Date(),
                        type,
                    },
                    updatedAt: new Date(),
                });

                // Broadcast to everyone in the chat room
                io.to(`chat:${chatId}`).emit("message:new", message);

                // Also emit to each participant's personal room
                // so their inbox updates even if they haven't opened the chat
                chat.participants.forEach((participantId) => {
                    io.to(`user:${participantId.toString()}`).emit("message:new", message);
                });

            } catch (err) {
                console.error("message:send error", err.message);
            }
        });


        // Read receipt
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

                // Tell the other person their message was seen
                io.to(`chat:${chatId}`).emit("message:read", {
                    chatId,
                    messageId,
                    userId,
                });

            } catch (err) {
                console.error("message:read error", err.message);
            }
        });


        // Typing indicators
        socket.on("typing:start", ({ chatId }) => {
            socket.to(`chat:${chatId}`).emit("typing:start", { chatId, userId });
        });

        socket.on("typing:stop", ({ chatId }) => {
            socket.to(`chat:${chatId}`).emit("typing:stop", { chatId, userId });
        });

        // Handle disconnect
        socket.on("disconnect", async () => {
            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);

                if (sockets.size === 0) {
                    onlineUsers.delete(userId);

                    // Save lastSeen to DB
                    const now = new Date();
                    await User.findByIdAndUpdate(userId, { lastSeen: now });

                    // Tell all connections this user is offline
                    await notifyConnections(io, userId, { online: false, lastSeen: now });

                    console.log(`User ${userId} is now offline`);
                }
            }
            console.log(`Socket ${socket.id} disconnected`);
        });
    });

    return io;
};

module.exports = initSocket;