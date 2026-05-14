export const createUser = async (email, password) => {
    return {
        email,
        passwordHash: `hashed-${password}`,
        isActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
};