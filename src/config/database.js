const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const connectDB = async () => {
    let dbURI;

    if (process.env.NODE_ENV === "production") {
        dbURI = process.env.PROD_DB_URI;
    } else {
        dbURI = process.env.DEV_DB_URI;
    }

    await mongoose.connect(dbURI);
    console.log(`MongoDB Connected: ${process.env.NODE_ENV}`);
};

module.exports = connectDB;