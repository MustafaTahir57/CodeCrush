const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

const validator = require("validator")

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
    },

    authProvider: {
        type: String,
        enum: ["local", "github"],
        default: "local",
    },

    githubId: {
        type: String,
        default: null,
    },

    emailId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error("Invalid email address: " + value);
            }
        }
    },

    githubStats: {
        repoCount: { type: Number, default: 0 },
        profileUrl: { type: String, default: null },
    },

    password: {
        type: String,
        required: function () {
            return this.authProvider === "local";
        },
    },

    age: {
        type: Number,
        default: 21,
        min: 18
    },

    gender: {
        type: String,
        validate(value) {
            if (value && !["male", "female", "non-binary"].includes(value)) {
                throw new Error("Gender invalid!");
            }
        }
    },

    skills: {
        type: [String],
        default: []
    },

    // =========================
    // NEW PROFILE FIELDS
    // =========================

    profilePicture: {
        type: String, // URL of avatar
        default: ""
    },

    headline: {
        type: String, // e.g. "Senior Full-Stack Engineer"
        default: ""
    },

    bio: {
        type: String,
        default: ""
    },

    location: {
        type: String, // e.g. "Berlin, DE"
        default: ""
    },

    role: {
        type: String, // e.g. "Developer"
        default: "User"
    },

    socialLinks: {
        github: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        twitter: { type: String, default: "" },
        portfolio: { type: String, default: "" }
    },

    lastSeen: {
        type: Date,
        default: null,
    },

    resetToken: {
        type: String,
    },

    resetTokenExpiry: {
        type: Date
    }

}, { timestamps: true });

userSchema.index({ email: 1 })  // Indexing email in ascending order it will make a copy of this field

userSchema.methods.getJWT = async function () {
    const user = this;
    // Create a JWT Token
    const token = await jwt.sign({ _id: user._id }, process.env.JWT_KEY, {
        expiresIn: "7d"
    })

    return token;
}

const User = mongoose.model("User", userSchema)
module.exports = User;