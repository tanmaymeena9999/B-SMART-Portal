const {
    createUser,
    deleteUser,
    listUsers,
    updateUser,
} = require('../services/userStore');

async function getCredentials(req, res, next) {
    try {
        const users = await listUsers();
        return res.json({ users });
    } catch (error) {
        return next(error);
    }
}

async function addCredential(req, res, next) {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Name, email, password, and role are required.' });
        }

        const user = await createUser(req.body);
        return res.status(201).json({ user });
    } catch (error) {
        return next(error);
    }
}

async function editCredential(req, res, next) {
    try {
        const user = await updateUser(req.params.id, req.body);
        return res.json({ user });
    } catch (error) {
        return next(error);
    }
}

async function removeCredential(req, res, next) {
    try {
        await deleteUser(req.params.id);
        return res.status(204).send();
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    addCredential,
    editCredential,
    getCredentials,
    removeCredential,
};
