const express = require("express")

const profileRouter = express.Router();
const { userAuth } = require("../middlewares/auth")
const { validateEditProfileData } = require("../utils/validation.js")
const User = require("../models/user")
const upload = require("../middlewares/upload.js")
const uploadToCloudinary = require("../utils/uploadToCloudinary");

profileRouter.get("/profile", userAuth, async (req, res) => {
    try {
        const user = req.user;
        res.json(user);
    } catch (err) {
        res.status(400).send("ERROR : " + err.message)
    }
})

profileRouter.post("/profile/edit", userAuth, (req, res, next) => {
    upload.single("profilePicture")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    message: "Image too large. Maximum size is 5MB."
                });
            }
            return res.status(400).json({
                message: err.message || "File upload failed"
            });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!validateEditProfileData(req)) {
            throw new Error("Invalid Update Fields");
        }
        const loggedInUser = req.user;

        if (req.file) {
            const uploadedImage = await uploadToCloudinary(req.file.buffer);
            loggedInUser.profilePicture = uploadedImage.secure_url;
        }

        Object.keys(req.body).forEach((key) => {
            if (key === "socialLinks") {
                loggedInUser.socialLinks = {
                    ...loggedInUser.socialLinks,
                    ...JSON.parse(req.body.socialLinks)
                };
            } else if (key === "skills") {
                loggedInUser.skills = JSON.parse(req.body.skills);
            } else {
                loggedInUser[key] = req.body[key];
            }
        });

        await loggedInUser.save();

        res.json({
            message: `${loggedInUser.firstName}, your profile updated`,
            data: loggedInUser
        });

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = profileRouter;