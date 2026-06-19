const validateSignUpData = (body) => {
    const { firstName, lastName, emailId } = body;

    if (!firstName) {
        throw new Error("Testing Error ")
    }

}

const validateEditProfileData = (req) => {
    const allowedEditFields = [
        "firstName",
        "lastName",
        "age",
        "gender",
        "skills",
        // "headline",
        // "bio",
        // "location",
        // "role",
        // "socialLinks"
    ];

    const bodyFields = Object.keys(req.body);

    const isBodyValid = bodyFields.every((field) =>
        allowedEditFields.includes(field)
    );

    return isBodyValid;
};

module.exports = { validateSignUpData, validateEditProfileData }