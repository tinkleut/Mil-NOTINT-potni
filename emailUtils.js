const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@(?=[^\s@]{2,}\.[^\s@]{2,}$)[^\s@]+\.[^\s@]+$/;

function normalizeEmailAddress(value) {
    if (typeof value !== "string") return null;

    const email = value.trim();
    return EMAIL_ADDRESS_PATTERN.test(email) ? email : null;
}

module.exports = { normalizeEmailAddress };
