const express = require("express");
const chatRouter = express.Router();

const { userAuth } = require("../middlewares/auth");
const Chat = require("../models/chat");
const Message = require("../models/message");
const ConnectionRequest = require("../models/connectionRequest");
const upload = require("../middlewares/upload");
const uploadToCloudinary = require("../utils/uploadToCloudinary");

// 1. Get all chats for logged in user (inbox)
chatRouter.get("/chat/list", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const chats = await Chat.find({
            participants: { $in: [loggedInUser._id] },
        })
            .populate("participants", ["firstName", "lastName", "profilePicture", "headline"])
            .sort({ updatedAt: -1 });

        res.status(200).json({ message: "Chats fetched", data: chats });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 2. Open or create a chat with a connection
chatRouter.get("/chat/:targetUserId", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;
        const { targetUserId } = req.params;

        const isConnected = await ConnectionRequest.findOne({
            $or: [
                { fromUserId: loggedInUser._id, toUserId: targetUserId, status: "accepted" },
                { fromUserId: targetUserId, toUserId: loggedInUser._id, status: "accepted" },
            ],
        });

        if (!isConnected) {
            return res.status(403).json({ message: "You are not connected with this user" });
        }

        let chat = await Chat.findOne({
            participants: { $all: [loggedInUser._id, targetUserId] },
        }).populate("participants", ["firstName", "lastName", "profilePicture", "headline"]);

        if (!chat) {
            chat = new Chat({
                participants: [loggedInUser._id, targetUserId],
            });
            await chat.save();
            chat = await chat.populate("participants", ["firstName", "lastName", "profilePicture", "headline"]);
        }

        res.status(200).json({ message: "Chat fetched", data: chat });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. Get paginated messages for a chat
chatRouter.get("/chat/:chatId/messages", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const isParticipant = chat.participants.some(
            (p) => p.toString() === loggedInUser._id.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({ message: "You are not part of this chat" });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 30;
        const skip = (page - 1) * limit;

        const messages = await Message.find({ chatId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("sender", ["firstName", "lastName", "profilePicture"]);

        res.status(200).json({
            message: "Messages fetched",
            data: messages.reverse(),
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// 4. Upload attachment (image or file) to Cloudinary
chatRouter.post("/chat/:chatId/attachment", userAuth, upload.single("file"), async (req, res) => {
    try {
        const loggedInUser = req.user;
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }

        const isParticipant = chat.participants.some(
            (p) => p.toString() === loggedInUser._id.toString()
        );
        if (!isParticipant) {
            return res.status(403).json({ message: "You are not part of this chat" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ message: "File type not allowed" });
        }

        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ message: "File size exceeds 5MB" });
        }

        const uploaded = await uploadToCloudinary(req.file.buffer);

        res.status(200).json({
            message: "File uploaded",
            data: {
                url: uploaded.secure_url,
                mimeType: req.file.mimetype,
                size: req.file.size,
                name: req.file.originalname,
            },
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = chatRouter;