const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middlewares/auth")
const ConnectionRequestModel = require("../models/connectionRequest")
const User = require("../models/user")

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
            return conn.fromUserId._id
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
        }).select("firstName lastName gender age profilePicture , headline , bio").skip(skip)
            .limit(limit);

        res.json({
            users
        })


    } catch (err) {
        res.status(500).send(err.message);
    }

})

module.exports = userRouter;
