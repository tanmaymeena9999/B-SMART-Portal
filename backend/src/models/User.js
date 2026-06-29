const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ['admin', 'country_manager', 'dealer'],
            required: true,
        },
        dealerCode: {
            type: String,
            default: '',
            trim: true,
        },
        countryCode: {
            type: String,
            default: '',
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id.toString();
                delete ret._id;
                delete ret.__v;
                delete ret.passwordHash;
                return ret;
            },
        },
    }
);

module.exports = mongoose.model('User', userSchema);
