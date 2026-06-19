const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/database");
const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat");
const initSocket = require("./config/socket");

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.WHITE_LIST_URL.split(',');

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);

connectDB().then(() => {
    initSocket(server);
    server.listen(7777, () => {
        console.log("Server running on port 7777");
    });
}).catch((err) => {
    console.error("Connection Failed", err);
});