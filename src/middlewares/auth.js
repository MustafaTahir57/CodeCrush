
const jwt = require("jsonwebtoken")
const User = require("../models/user")

const userAuth = async (req, res, next) => {
    try {
        console.log("=================================");
        console.log("AUTH MIDDLEWARE");

        console.log("Cookies:", req.cookies);
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({ message: "Invalid Session" });
        }

        console.log("cookies", req.cookies);

        const decodeObj = jwt.verify(token, process.env.JWT_KEY);

        console.log("decodeObj", decodeObj)

        const { _id } = decodeObj;
        const user = await User.findById(_id);

        console.log("user", user)

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        req.user = user;
        next();

    } catch (err) {
        return res.status(401).json({ message: "Authentication failed", error: err.message });
    }
};

const adminAuth = (req, res, next) => {
    const isAuthorized = true;

    if (!isAuthorized) {
        res.send("Not authorized")
    }
    else {
        // throw new Error("Something happended wrong")
        next();
    }
}

module.exports = {
    userAuth,
    adminAuth

}