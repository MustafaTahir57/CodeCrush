const ConnectionRequest = require("../../models/connectionRequest");

const notifyConnections = async (io, userId, presenceData) => {
    try {
        const connections = await ConnectionRequest.find({
            $or: [
                { fromUserId: userId, status: "accepted" },
                { toUserId: userId, status: "accepted" },
            ],
        });

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

module.exports = { notifyConnections };