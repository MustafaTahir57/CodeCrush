const express = require("express")
const User = require("../models/user")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("crypto");
const upload = require("../middlewares/upload")
const uploadToCloudinary = require("../utils/uploadToCloudinary");

const { validateSignUpData } = require("../utils/validation")

const authRouter = express.Router();

authRouter.post("/signup", upload.single("profilePicture"),
    async (req, res) => {
        try {
            validateSignUpData(req.body);

            const {
                firstName,
                lastName,
                emailId,
                password,
                age,
                gender,
                skills,
                headline,
                bio,
                location,
                role,
                socialLinks
            } = req.body;

            // Check existing user
            const existingUser = await User.findOne({ emailId });
            if (existingUser) {
                return res.status(400).json({ message: "User already exists" });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // 🔥 Handle profile picture upload (IMPORTANT PART)
            let profilePictureUrl = "";

            if (req.file) {
                const uploadedImage = await uploadToCloudinary(req.file.buffer);
                profilePictureUrl = uploadedImage.secure_url;
            }

            // Parse JSON fields safely
            const parsedSkills = skills ? JSON.parse(skills) : [];
            const parsedSocialLinks = socialLinks ? JSON.parse(socialLinks) : {};

            // Create user
            const user = new User({
                firstName,
                lastName,
                emailId,
                password: passwordHash,
                age,
                gender,
                skills: parsedSkills,
                profilePicture: profilePictureUrl,
                headline,
                bio,
                location,
                role,
                socialLinks: parsedSocialLinks
            });

            await user.save();

            res.status(201).json({
                message: "User created successfully",
                user: {
                    _id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    emailId: user.emailId,
                    profilePicture: user.profilePicture,
                    headline: user.headline,
                    bio: user.bio,
                    location: user.location,
                    skills: user.skills,
                    role: user.role
                }
            });

        } catch (err) {
            res.status(400).json({
                message: "Error saving the user",
                error: err.message
            });
        }
    }
);

authRouter.post("/signIn", async (req, res) => {
    try {
        const { emailId, password } = req.body;

        const user = await User.findOne({ emailId: emailId })
        if (!user) {
            res.status(404).send("user Not found")
        }
        const isPasswordvalid = await bcrypt.compare(password, user.password);

        if (isPasswordvalid) {

            // Create a JWT token
            const token = await user.getJWT();

            console.log("=================================");
            console.log("LOGIN SUCCESS");
            console.log("User ID:", user._id);
            console.log("JWT Token:", token);
            console.log("=================================");

            // Send the cookie back
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                expires: new Date(Date.now() + 8 * 3600000),
            });
            res.json({
                message: "Login Success",
                user
            })
        } else {
            throw new Error("Password Invalid")
        }

    } catch (err) {
        res.status(400).send("Error saving the user:" + err.message)
    }

})

authRouter.post("/logout", async (req, res) => {

    // Send the cookie back
    res.cookie("token", null, {
        expires: new Date(Date.now())
    })
    res.json({
        message: "Logout Success"
    })
})

authRouter.post("/forgetPassword", async (req, res) => {
    const { emailId } = req.body;
    const user = await User.findOne({ emailId: emailId })
    if (!user) {
        throw new Error("User not found")
    }
    // will create a test link and send it to the user's email

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 mins

    res.cookie("resetToken", resetToken, {
        expires: new Date(Date.now() + 10 * 60 * 1000)
    })

    await user.save();
    // Create reset link
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    // TODO: Send email here
    console.log("Reset Link:", resetLink);

    res.json({
        message: "Password reset link sent to email",
    });

})

authRouter.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        // find user with valid token
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired token"
            });
        }

        // hash password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // update password
        user.password = hashedPassword;

        // clear reset fields
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;

        await user.save();

        res.json({
            message: "Password reset successful"
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = authRouter;