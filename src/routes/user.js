const express = require("express");
const userRouter = express.Router();
const { userAuth } = require("../middlewares/auth")
const ConnectionRequestModel = require("../models/connectionRequest")

userRouter.get("/user/requests/received", userAuth, async (req, res) => {
    try {
        const loggedInUser = req.user;

        const pendingRequets = await ConnectionRequestModel.find({
            toUserId: loggedInUser._id,
            status: "interested"
        }).populate("fromUserId", "firstName age -_id").exec();

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
        }).populate("fromUserId", ["firstName", "lastName", "gender", "age"]).populate("toUserId", ["firstName", "lastName", "gender", "age"])

        if (!connections) {
            return res.status(404).send("No pending requests")
        }

        const data = connections.map((conn) => {
            if (conn.fromUserId.toString() === loggedInUser._id.toString()) {
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



module.exports = userRouter;
