import bcrypt from "bcrypt"

export const createUser = async (email, pass) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(pass, salt);

    return ({
        email: email, // string, unique, required
        passwordHash: passwordHash, // string, required
        isActive: false, // boolean, required, default = false
        refreshToken: null,
        activation: {
            code: null, // string, default=null
            generatedAt: null, // timestamp, default=null
        },
        signInVerification: {
            code: null, // string, default=null
            generatedAt: null // timestamp, default=null
        },
        emailChange: {
            newEmail: null, // string, default=null
            code: null, // string, default=null
            generatedAt: null // timestamp, default=null
        },
        favorites: [], // [{media_id:string, photoUrl:string, source: string enum[storyblock, giphy, noun, photo], link: string}]
        historyLoad: [], // [{media_id:string, photoUrl:string, source: string enum[storyblock, giphy, noun, photo], link: string, loadedAt: timestamp}]
        createdAt: new Date().getTime(), // timestamp, required
        updatedAt: new Date().getTime(), // timestamp, required
    })
};
