const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middlewares/auth")
const ConnectionRequestModel = require("../models/connectionRequest")
const User = require("../models/user")
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

userRouter.get("/user/requests/received", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const pendingRequets = await ConnectionRequestModel.find({
            toUserId: loggedInUser._id,
            status: "interested"
        }).populate("fromUserId", ["firstName", "lastName", "gender", "age", "profilePicture", "skills", "headline"]).exec();

        if (!pendingRequets) {
            return res.status(404).send("No pending requests")
        }

        res.status(200).json({
            message: "All Pending Requets",
            data: pendingRequets
        })

    } catch (err) {
        res.status(500).send(err.message);
    }

})

userRouter.get("/user/connections", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const connections = await ConnectionRequestModel.find({
            $or: [
                { fromUserId: loggedInUser._id, status: "accepted" },
                { toUserId: loggedInUser._id, status: "accepted" }
            ]
        }).populate("fromUserId", ["firstName", "lastName", "gender", "age", "profilePicture"])
            .populate("toUserId", ["firstName", "lastName", "gender", "age", "profilePicture"]);

        if (!connections) {
            return res.status(404).send("No pending requests")
        }

        const data = connections.map((conn) => {
            if (conn.fromUserId._id.toString() === loggedInUser._id.toString()) {
                return conn.toUserId
            }
            return conn.fromUserId
        })

        res.status(200).json({
            message: "All Connections",
            data: data
        })


    } catch (err) {
        res.status(500).send(err.message);
    }
})

userRouter.get("/user/feed", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        limit = limit > 50 ? 50 : limit;
        const skip = (page - 1) * limit;

        const connectionRequests = await ConnectionRequestModel.find({
            $or: [
                { fromUserId: loggedInUser._id },
                { toUserId: loggedInUser._id }
            ]
        }).populate("fromUserId", ["firstName", "lastName", "gender", "age"]).populate("toUserId", ["firstName", "lastName", "gender", "age"])

        const hideUsers = new Set();

        connectionRequests.forEach((req) => {
            hideUsers.add(req.fromUserId._id.toString());
            hideUsers.add(req.toUserId._id.toString());

        })

        const users = await User.find({
            $and: [
                { _id: { $nin: Array.from(hideUsers) } },
                { _id: { $ne: loggedInUser._id } }
            ]
        }).select("firstName lastName gender age profilePicture , headline , bio , skills").skip(skip)
            .limit(limit);

        res.json({
            users
        })


    } catch (err) {
        res.status(500).send(err.message);
    }

})

userRouter.post("/user/ai-summary", userAuth, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "userId is required" });
        }

        // RETRIEVE — fetch that user's data from DB
        const user = await User.findById(userId).select(
            "firstName lastName skills headline bio role location githubStats"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // AUGMENT — build prompt with their real data
        const prompt = `You are helping developers decide who to connect with on a developer networking platform.

Here is a developer's profile data:
- Name: ${user.firstName} ${user.lastName}
- Role: ${user.role ?? "Not specified"}
- Headline: ${user.headline ?? "Not specified"}
- Skills: ${user.skills?.join(", ") || "Not specified"}
- Location: ${user.location ?? "Not specified"}
- GitHub Repos: ${user.githubStats?.repoCount ?? "Unknown"}
- Bio: ${user.bio ?? "Not provided"}

Write a 2-3 sentence "Why connect?" summary for this developer in a 
friendly, professional tone. Focus on what makes them a valuable connection.
Return only the summary text, no quotes, no markdown, no labels.`;

        // GENERATE
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        const summary = result.response.text();

        res.json({ summary: summary.trim() });

    } catch (err) {
        console.error("AI summary error:", err.message);
        res.status(500).json({ message: "Failed to generate summary" });
    }
});

module.exports = userRouter;
