const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema(
    {
        reportKey: {
            type: String,
            trim: true,
            unique: true,
            sparse: true,
        },
        dealerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        dealerName: {
            type: String,
            required: true,
        },
        distributorCode: {
            type: String,
            default: '',
            trim: true,
            index: true,
        },
        dealerCode: {
            type: String,
            default: '',
            trim: true,
            index: true,
        },
        countryCode: {
            type: String,
            default: '',
            trim: true,
            index: true,
        },
        reportType: {
            type: String,
            enum: ['retail_service_activity', 'additional_kpi', 'vin_retention'],
            required: true,
        },
        reportMonth: {
            type: String,
            required: true,
            match: /^\d{4}-(0[1-9]|1[0-2])$/,
        },
        fileName: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
        },
        mimeType: {
            type: String,
            default: '',
        },
        parsedWorkbook: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        formData: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        source: {
            type: String,
            enum: ['excel', 'manual'],
            default: 'excel',
        },
        changes: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
        uploads: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
        status: {
            type: String,
            default: 'uploaded',
        },
        reviewComments: {
            type: String,
            default: '',
        },
        reviewHistory: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.objectId = ret._id.toString();
                ret.id = ret.reportKey || ret.objectId;
                if (ret.dealerId) {
                    ret.dealerId = ret.dealerId.toString();
                }
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    }
);

reportSchema.index(
    {
        dealerId: 1,
        reportType: 1,
        reportMonth: 1,
    }
);

reportSchema.index(
    {
        dealerCode: 1,
        reportType: 1,
        reportMonth: 1,
    }
);

reportSchema.index(
    {
        distributorCode: 1,
        reportType: 1,
        reportMonth: 1,
    }
);

reportSchema.index(
    {
        countryCode: 1,
        reportMonth: 1,
    }
);

module.exports = mongoose.model('Report', reportSchema);
