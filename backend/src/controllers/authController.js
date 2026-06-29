const { findUserByEmail, sanitizeUser } = require('../services/userStore');
const { verifyPassword } = require('../utils/password');
const { sign } = require('../utils/token');

async function login(req, res, next) {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        const user = await findUserByEmail(email);

        if (!user || user.active === false || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const safeUser = sanitizeUser(user);
        const token = sign({
            sub: user.id,
            role: user.role,
            email: user.email,
        });

        return res.json({
            token,
            user: safeUser,
        });
    } catch (error) {
        return next(error);
    }
}

function me(req, res) {
    return res.json({ user: req.user });
}

module.exports = {
    login,
    me,
};
