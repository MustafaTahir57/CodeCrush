const mongoose = require("mongoose")

const connectionSchema = new mongoose.Schema({
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: {
            values: ["pending", "interested", "accepted", "rejected"],
            message: `{VALUE} is incorrect sttaus type`
        }
    }

}, {
    timestamps: true
})

// connectionSchema.pre("save", function (next) {
//     const connectionRequest = this;

//     if (connectionRequest.fromUserId.equals(connectionRequest.toUserId)) {
//         return next(new Error("Cannot send connection request to yourself"));
//     }

//     next();
// });

const ConnectionRequestModel = new mongoose.model("connectionSchema", connectionSchema)
module.exports = ConnectionRequestModel;