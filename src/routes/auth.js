const express = require("express")
const User = require("../models/user")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const crypto = require("crypto");
const upload = require("../middlewares/upload")
const uploadToCloudinary = require("../utils/uploadToCloudinary");
const { Resend } = require('resend');
const axios = require("axios")
const getGithubLanguages = require("../utils/getGithubLanguages");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const resend = new Resend(process.env.RESEND_API_KEY);

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

            const token = await user.getJWT()

            res.status(201).json({
                message: "User created successfully",
                token,
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

            // Send the cookie back
            res.cookie("token", token, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                expires: new Date(Date.now() + 8 * 3600000),
            });
            res.json({
                message: "Login Success",
                user,
                token
            })
        } else {
            throw new Error("Password Invalid")
        }

    } catch (err) {
        res.status(400).send("Error saving the user:" + err.message)
    }

})

authRouter.get("/auth/github", (req, res) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email,repo&redirect_uri=${process.env.GITHUB_CALLBACK_URL}`;
    res.redirect(githubAuthUrl);
});

authRouter.get("/auth/github/callback", async (req, res) => {
    try {
        const { code } = req.query;

        const tokenRes = await axios.post(
            "https://github.com/login/oauth/access_token",
            {
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            },
            { headers: { Accept: "application/json" } }
        );

        const accessToken = tokenRes.data.access_token;
        if (!accessToken) {
            return res.status(400).json({ message: "GitHub auth failed" });
        }

        const githubUserRes = await axios.get("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const githubUser = githubUserRes?.data;

        const emailRes = await axios.get("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const primaryEmail = emailRes.data.find((e) => e.primary)?.email;

        // NEW: fetch repos + languages
        const { skillTags, repoCount, languageTotals } = await getGithubLanguages(
            accessToken,
            githubUser.login
        );

        const fullName = githubUser.name || githubUser.login;
        const [firstName, ...rest] = fullName.trim().split(" ");
        const lastName = rest.join(" ") || "GitHub"; // fallback if no last name

        // after getting githubUser, primaryEmail, skillTags, repoCount...

        let user = await User.findOne({ emailId: primaryEmail });

        if (!user) {
            user = await User.create({
                emailId: primaryEmail,
                firstName,
                lastName,
                authProvider: "github",
                githubId: githubUser?.id.toString(),
                profilePicture: githubUser.avatar_url,
                skills: skillTags,
                githubStats: {
                    repoCount,
                    profileUrl: githubUser.html_url,
                },
            });
        } else {
            // existing user — refresh skills every login (per your earlier answer)
            user.skills = skillTags;
            user.githubStats = {
                repoCount,
                profileUrl: githubUser.html_url,
            };
            if (!user.githubId) user.githubId = githubUser.id.toString();
            await user.save();
        }

        const token = await user.getJWT();

        res.redirect(`https://codecrush-nine.vercel.app/oauth-success?token=${token}`);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).json({ message: "GitHub OAuth failed" });
    }
});

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

    const user = await User.findOne({ emailId });
    if (!user) {
        return res.status(404).json({ message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    const resetLink = `https://codecrush-nine.vercel.app/reset-password/${resetToken}`;

    // Send email
    await resend.emails.send({
        from: "onboarding@resend.dev",
        to: user.emailId,
        subject: "Reset your CodeCrush password",
        html: `
            <h2>Password Reset</h2>
            <p>Click the link below to reset your password. Link expires in 10 minutes.</p>
            <a href="${resetLink}">Reset Password</a>
        `,
    });

    res.json({
        message: "Password reset link sent to email",
    });
});

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
            message: "Password reset successfull"
        });

    } catch (err) {
        res.status(500).send(err.message);
    }
});


authRouter.post("/generateBio", async (req, res) => {
    try {
        const { notes } = req.body;

        if (!notes || !notes.trim()) {
            return res.status(400).json({ message: "Notes are required" });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Turn these rough notes into a polished 2-3 sentence developer bio in a friendly, professional tone. Only return the bio text, nothing else, no quotes, no markdown.

Notes: ${notes}`;

        const result = await model.generateContent(prompt);
        const bio = result.response.text();

        res.json({ bio: bio.trim() });

    } catch (err) {
        console.error("Gemini error:", err.message);
        res.status(500).json({ message: "Failed to generate bio" });
    }
});

module.exports = authRouter;