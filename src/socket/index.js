const { Server } = require("socket.io");
const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const { notifyConnections } = require("./handlers/presence");
const chatHandler = require("./handlers/chat");
const typingHandler = require("./handlers/typing");
const callHandler = require("./handlers/call");
// const aiReviewHandler = require("./handlers/aiReview"); ← uncomment when ready

const JWT_KEY = process.env.JWT_KEY;
const onlineUsers = new Map();

const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.WHITE_LIST_URL,
            credentials: true,
        },
    });

    // Auth middleware
    io.use(async (socket, next) => {
        try {
            const cookies = cookie.parse(socket.handshake.headers.cookie || "");
            const token = cookies.token || socket.handshake.auth.token;

            if (!token) return next(new Error("Authentication error: No token"));

            const decoded = jwt.verify(token, JWT_KEY);
            const user = await User.findById(decoded._id);

            if (!user) return next(new Error("Authentication error: User not found"));

            socket.user = user;
            next();
        } catch (err) {
            next(new Error("Authentication error: " + err.message));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.user._id.toString();

        // Track online users
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);

        socket.join(`user:${userId}`);
        console.log(`User ${userId} connected — socket ${socket.id}`);

        await notifyConnections(io, userId, { online: true, lastSeen: null });

        // Mount handlers
        chatHandler(io, socket);
        typingHandler(io, socket);
        callHandler(io, socket);
        // aiReviewHandler(io, socket); ← uncomment when ready

        // Disconnect
        socket.on("disconnect", async () => {
            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);

                if (sockets.size === 0) {
                    onlineUsers.delete(userId);

                    const now = new Date();
                    await User.findByIdAndUpdate(userId, { lastSeen: now });
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