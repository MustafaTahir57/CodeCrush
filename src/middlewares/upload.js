const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage, // your existing storage config
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPEG, PNG and WebP images are allowed"));
        }
    }
});

module.exports = upload;