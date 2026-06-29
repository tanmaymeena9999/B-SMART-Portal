const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/bsmart';

async function connectDatabase() {
    const uri = process.env.MONGO_URI || DEFAULT_MONGO_URI;

    await mongoose.connect(uri, {
        serverSelectionTimeoutMS: Number(process.env.MONGO_TIMEOUT_MS || 5000),
    });
    await dropLegacyUniqueReportIndex();

    return {
        status: 'connected',
        uri,
    };
}

async function dropLegacyUniqueReportIndex() {
    try {
        await mongoose.connection.collection('reports').dropIndex('dealerId_1_reportType_1_reportMonth_1');
    } catch (error) {
        if (!['IndexNotFound', 'NamespaceNotFound'].includes(error.codeName)) {
            throw error;
        }
    }
}

module.exports = {
    connectDatabase,
};
