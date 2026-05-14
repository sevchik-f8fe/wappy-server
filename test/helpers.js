export const mockUser = {
    _id: 'test_user_id_123',
    _rev: 'test_rev_123',
    email: 'test@example.com',
    isActive: true,
    updatedAt: Date.now()
};

export const mockUserInactive = {
    _id: 'test_user_inactive_123',
    _rev: 'test_rev_456',
    email: 'inactive@example.com',
    isActive: false,
    updatedAt: Date.now() - (25 * 60 * 60 * 1000)
};

export const mockUserOld = {
    _id: 'test_user_old_123',
    _rev: 'test_rev_789',
    email: 'old@example.com',
    isActive: true,
    updatedAt: Date.now() - (4 * 365 * 24 * 60 * 60 * 1000)
};