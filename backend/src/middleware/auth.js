const { verify } = require('../utils/token');
const { findUserById, sanitizeUser } = require('../services/userStore');

async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = token ? verify(token) : null;

    try {
        if (!payload) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        const user = await findUserById(payload.sub);

        if (!user || user.active === false) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        req.user = sanitizeUser(user);
        return next();
    } catch (error) {
        return next(error);
    }
}

function requireRole(...roles) {
    return function roleMiddleware(req, res, next) {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'You do not have access to this action.' });
        }

        return next();
    };
}

module.exports = {
    requireAuth,
    requireRole,
};
