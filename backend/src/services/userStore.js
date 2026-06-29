const { hashPassword } = require('../utils/password');
const User = require('../models/User');

const VALID_ROLES = ['admin', 'country_manager', 'dealer'];

function sanitizeUser(user) {
    if (!user) {
        return null;
    }

    if (typeof user.toJSON === 'function') {
        return user.toJSON();
    }

    const { passwordHash, _id, __v, ...safeUser } = user;
    return {
        ...safeUser,
        id: user.id || _id?.toString(),
    };
}

async function seedAdminUser() {
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
        return existingAdmin;
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bsmart.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    return User.create({
        name: 'Admin',
        email: adminEmail,
        role: 'admin',
        passwordHash: hashPassword(adminPassword),
        active: true,
    });
}

async function listUsers() {
    const users = await User.find().sort({ createdAt: 1 });
    return users.map(sanitizeUser);
}

function findUserByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
}

function findUserById(id) {
    return User.findById(id);
}

async function createUser(payload) {
    const email = payload.email.trim().toLowerCase();
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        const error = new Error('A user with this email already exists.');
        error.statusCode = 409;
        throw error;
    }

    if (!VALID_ROLES.includes(payload.role)) {
        const error = new Error('Invalid role.');
        error.statusCode = 400;
        throw error;
    }

    const user = await User.create({
        name: payload.name.trim(),
        email,
        role: payload.role,
        dealerCode: payload.dealerCode || '',
        countryCode: payload.countryCode || '',
        passwordHash: hashPassword(payload.password),
        active: payload.active !== false,
    });

    return sanitizeUser(user);
}

async function updateUser(id, payload) {
    const user = await User.findById(id);

    if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    if (payload.role && !VALID_ROLES.includes(payload.role)) {
        const error = new Error('Invalid role.');
        error.statusCode = 400;
        throw error;
    }

    if (payload.email) {
        const email = payload.email.trim().toLowerCase();
        const emailExists = await User.exists({
            email,
            _id: { $ne: id },
        });

        if (emailExists) {
            const error = new Error('A user with this email already exists.');
            error.statusCode = 409;
            throw error;
        }

        user.email = email;
    }

    ['name', 'role', 'dealerCode', 'countryCode', 'active'].forEach((field) => {
        if (payload[field] !== undefined) {
            user[field] = payload[field];
        }
    });

    if (payload.password) {
        user.passwordHash = hashPassword(payload.password);
    }

    await user.save();
    return sanitizeUser(user);
}

async function deleteUser(id) {
    const user = await User.findById(id);

    if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404;
        throw error;
    }

    if (user.role === 'admin') {
        const remainingAdmins = await User.countDocuments({
            role: 'admin',
            _id: { $ne: id },
        });

        if (remainingAdmins === 0) {
            const error = new Error('At least one admin user is required.');
            error.statusCode = 400;
            throw error;
        }
    }

    await User.deleteOne({ _id: id });
}

module.exports = {
    VALID_ROLES,
    createUser,
    deleteUser,
    findUserByEmail,
    findUserById,
    listUsers,
    sanitizeUser,
    seedAdminUser,
    updateUser,
};
