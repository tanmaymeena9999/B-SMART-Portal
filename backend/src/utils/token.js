const crypto = require('crypto');

const DEFAULT_EXPIRES_IN_SECONDS = 8 * 60 * 60;

function base64UrlEncode(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function base64UrlDecode(value) {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function getSecret() {
    return process.env.JWT_SECRET || 'bsmart-local-dev-secret';
}

function sign(payload, expiresInSeconds = DEFAULT_EXPIRES_IN_SECONDS) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const body = {
        ...payload,
        iat: now,
        exp: now + expiresInSeconds,
    };
    const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(body)}`;
    const signature = crypto
        .createHmac('sha256', getSecret())
        .update(unsignedToken)
        .digest('base64url');

    return `${unsignedToken}.${signature}`;
}

function verify(token) {
    const [encodedHeader, encodedPayload, signature] = token.split('.');

    if (!encodedHeader || !encodedPayload || !signature) {
        return null;
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
        .createHmac('sha256', getSecret())
        .update(unsignedToken)
        .digest('base64url');

    const signatureBuffer = Buffer.from(signature);
    const expectedSignatureBuffer = Buffer.from(expectedSignature);

    if (
        signatureBuffer.length !== expectedSignatureBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
    ) {
        return null;
    }

    const payload = base64UrlDecode(encodedPayload);
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
        return null;
    }

    return payload;
}

module.exports = {
    sign,
    verify,
};
