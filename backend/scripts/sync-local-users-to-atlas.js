require('dotenv').config();
const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/bsmart';
const ATLAS_URI = process.env.MONGO_URI;

async function main() {
    if (!ATLAS_URI) {
        throw new Error('MONGO_URI is required in backend/.env');
    }

    const local = await mongoose.createConnection(LOCAL_URI).asPromise();
    const atlas = await mongoose.createConnection(ATLAS_URI).asPromise();
    const localUsers = await local.db.collection('users').find({}).toArray();
    const atlasUsers = atlas.db.collection('users');

    for (const user of localUsers) {
        const { _id, __v, createdAt, ...userWithoutId } = user;

        await atlasUsers.updateOne(
            { email: user.email },
            {
                $set: {
                    ...userWithoutId,
                    updatedAt: new Date(),
                },
                $setOnInsert: {
                    createdAt: user.createdAt || new Date(),
                },
            },
            { upsert: true }
        );
    }

    console.log(`Synced ${localUsers.length} local users to Atlas.`);
    await local.close();
    await atlas.close();
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
