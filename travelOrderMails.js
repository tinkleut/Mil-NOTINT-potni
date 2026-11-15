const { sendMail } = require("./mailer");

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function travelerName(traveler) {
    return [traveler?.ime, traveler?.priimek].filter(Boolean).join(" ");
}

// Convert the configured comma-separated admin addresses into individual recipients.
function adminRecipients() {
    return (process.env.ADMIN_EMAIL || "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
}

// Prefer the authenticated actor's details when identifying who made a change.
function actorLabel(actor, traveler) {
    const user = actor || traveler;
    const name = travelerName(user) || "Uporabnik";
    return user?.email ? `${name} (${user.email})` : name;
}

function formatChanges(changes = []) {
    const formatValue = (value) => value === null || value === undefined || value === ""
        ? "(prazno)"
        : String(value);
    const text = changes.map(({ label, oldValue, newValue }) =>
        `- ${label}: "${formatValue(oldValue)}" → "${formatValue(newValue)}"`
    ).join("\n");
    const html = `<ul>${changes.map(({ label, oldValue, newValue }) =>
        `<li><b>${escapeHtml(label)}</b>: "${escapeHtml(formatValue(oldValue))}" → "${escapeHtml(formatValue(newValue))}"</li>`
    ).join("")}</ul>`;

    return { text, html };
}

// Convert an order object into an HTML list.
function orderSummaryHtml(order = {}) {
    // Turn each [key, value] pair into one <li> row.
    const rows = Object.entries(order).map(([label, value]) => {
        // Stringify objects/arrays so they display as text.
        // null is excluded because typeof null === "object".
        const formattedValue = value !== null && typeof value === "object"
            ? JSON.stringify(value)
            : value;
        // Escape both label and value to prevent XSS.
        return `<li><b>${escapeHtml(label)}</b>: ${escapeHtml(formattedValue)}</li>`;
    });
    // Wrap rows in <ul>, or return an empty string if there are none.
    return rows.length ? `<ul>${rows.join("")}</ul>` : "";
}

// Validate recipients and forward optional reply-to information to the mailer.
async function safeSend({ to, subject, text, html, replyTo } = {}) {
    if (!to || (Array.isArray(to) && !to.length)) return false;

    try {
        await sendMail({ to, subject, text, html, replyTo });
        return true;
    } catch (error) {
        console.error(`Napaka pri pošiljanju e-pošte (${subject}):`, error);
        return false;
    }
}

// Shared helper that sends an email notice to the traveler about an order event.
// Used by orderCreatedByAdmin, orderApproved, orderDisapproved and more
async function sendTravelerNotice({ displayId, traveler, subject, text }) {
    // subject and text are functions that build the message from the order ID.
    // Each caller passes its own wording; this helper only handles the sending.
    // traveler?.email avoids an error if traveler is missing.
    const sent = await safeSend({
        to: traveler?.email,
        subject: subject(displayId),
        text: text(displayId),
    });
    // Wrap the result so callers can merge it with other recipients' results.
    return { traveler: sent };
}


async function orderCreatedByAdmin({ displayId, traveler }) {
    return sendTravelerNotice({
        displayId,
        traveler,
        subject: (id) => `Potni nalog ${id} je ustvarjen`,
        text: (id) => `Admin je za vas ustvaril potni nalog ${id}.`,
    });
}

// From admin side.
async function orderApproved({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Potni nalog ${id} je odobren`,
            text: (id) => `Vaš potni nalog ${id} je bil odobren.`,
        });
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderDisapproved({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Potni nalog ${id} je zavrnjen`,
            text: (id) => `Vaš potni nalog ${id} je bil zavrnjen.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderDeleted({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Potni nalog ${id} je bil izbrisan`,
            text: (id) => `Vaš potni nalog ${id} je bil izbrisan s strani admina.`,
        });
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Potni nalog ${displayId} je bil izbrisan`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je izbrisal potni nalog ${displayId}.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderUpdated({ displayId, traveler, actor, changedBy, changes = [] }) {
    const formattedChanges = formatChanges(changes);

    if (changedBy === "admin") {
        const sent = await safeSend({
            to: traveler?.email,
            subject: `Potni nalog ${displayId} je bil posodobljen`,
            text: `Vaš potni nalog ${displayId} je bil posodobljen s strani admina.\n\nSpremembe:\n${formattedChanges.text}`,
            html: `<p>Vaš potni nalog <b>${escapeHtml(displayId)}</b> je bil posodobljen s strani admina.</p><p><b>Spremembe:</b></p>${formattedChanges.html}`,
        });

        return { traveler: sent };
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Potni nalog ${displayId} je bil posodobljen`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je posodobil potni nalog ${displayId}.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderPaid({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Potni nalog ${id} je bil izplačan`,
            text: (id) => `Vaš potni nalog ${id} je bil izplačan.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function obracunUpdated({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Obračun potnega naloga ${id} je bil posodobljen`,
            text: (id) => `Vaš obračun potnega naloga ${id} je bil posodobljen s strani admina.`,
        });
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Obračun potnega naloga ${displayId} je bil posodobljen`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je posodobil obračun potnega naloga ${displayId}.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderCompleted({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Potni nalog ${id} je bil zaključen in izplačan`,
            text: (id) => `Potni nalog ${id} je bil zaključen s strani admina ter uspešno izplačan.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function orderStatusChanged({ displayId, traveler, fromStatus, toStatus, isMonthly = false }) {
    const orderType = isMonthly ? "Mesečni potni nalog" : "Potni nalog";
    const sent = await safeSend({
        to: traveler?.email,
        subject: `${orderType} ${displayId} ima nov status`,
        text: `Status vašega ${orderType.toLowerCase()} ${displayId} se je samodejno spremenil iz "${fromStatus}" v "${toStatus}" zaradi datumov potovanja.`,
    });

    return { traveler: sent };
}

async function monthlyOrderCreatedByAdmin({ displayId, traveler }) {
    return sendTravelerNotice({
        displayId,
        traveler,
        subject: (id) => `Mesečni potni nalog ${id} je ustvarjen`,
        text: (id) => `Admin je za vas ustvaril mesečni potni nalog ${id}.`,
    });
}

async function monthlyOrderCreated({ displayId, traveler, actor, order }) {
    const fullname = actorLabel(actor, traveler);
    // Send the submission notice to all admins and set the employee as the reply address.
    const admin = await safeSend({
        to: adminRecipients(),
        replyTo: actor?.email,
        subject: `Nov mesečni potni nalog ${displayId}: ${fullname}`,
        text: `${fullname} je oddal mesečni potni nalog ${displayId}.`,
        html: `<p><b>${escapeHtml(fullname)}</b> je oddal nov mesečni potni nalog <b>${escapeHtml(displayId)}</b>.</p>${orderSummaryHtml(order)}`,
    });
    const employee = await safeSend({
        to: traveler?.email,
        subject: `Mesečni potni nalog ${displayId} je prejet.`,
        text: `Mesečni potni nalog ${displayId} je bil oddan in čaka na odobritev.`,
    });
    return { admin, traveler: employee };
}

async function monthlyOrderApproved({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Mesečni potni nalog ${id} je odobren`,
            text: (id) => `Vaš mesečni potni nalog ${id} je bil odobren.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyOrderDisapproved({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Mesečni potni nalog ${id} je zavrnjen`,
            text: (id) => `Vaš mesečni potni nalog ${id} je bil zavrnjen.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyOrderDeleted({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Mesečni potni nalog ${id} je bil izbrisan`,
            text: (id) => `Vaš mesečni potni nalog ${id} je bil izbrisan s strani admina.`,
        });
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Mesečni potni nalog ${displayId} je bil izbrisan`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je izbrisal mesečni potni nalog ${displayId}.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyOrderUpdated({ displayId, traveler, actor, changedBy, changes = [] }) {
    const formattedChanges = formatChanges(changes);

    if (changedBy === "admin") {
        const sent = await safeSend({
            to: traveler?.email,
            subject: `Mesečni potni nalog ${displayId} je bil posodobljen`,
            text: `Vaš mesečni potni nalog ${displayId} je bil posodobljen s strani admina.\n\nSpremembe:\n${formattedChanges.text}`,
            html: `<p>Vaš mesečni potni nalog <b>${escapeHtml(displayId)}</b> je bil posodobljen s strani admina.</p><p><b>Spremembe:</b></p>${formattedChanges.html}`,
        });

        return { traveler: sent };
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Mesečni potni nalog ${displayId} je bil posodobljen`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je posodobil mesečni potni nalog ${displayId}.\n\nSpremembe:\n${formattedChanges.text}`,
            html: `<p>Zaposleni <b>${escapeHtml(actorLabel(actor, traveler))}</b> je posodobil mesečni potni nalog <b>${escapeHtml(displayId)}</b>.</p><p><b>Spremembe:</b></p>${formattedChanges.html}`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyOrderPaid({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Mesečni potni nalog ${id} je bil izplačan`,
            text: (id) => `Vaš mesečni potni nalog ${id} je bil izplačan.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyObracunUpdated({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Obračun mesečnega potnega naloga ${id} je bil posodobljen`,
            text: (id) => `Vaš obračun mesečnega potnega naloga ${id} je bil posodobljen s strani admina.`,
        });
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Obračun mesečnega potnega naloga ${displayId} je bil posodobljen`,
            text: `Zaposleni ${actorLabel(actor, traveler)} je posodobil obračun mesečnega potnega naloga ${displayId}.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function monthlyOrderCompleted({ displayId, traveler, actor, changedBy }) {
    if (changedBy === "admin") {
        return sendTravelerNotice({
            displayId,
            traveler,
            subject: (id) => `Mesečni potni nalog ${id} je bil zaključen in izplačan`,
            text: (id) => `Mesečni potni nalog ${id} je bil zaključen s strani admina in uspešno izplačan.`,
        });
    }
    throw new Error(`Neznan changedBy: ${changedBy}`);
}

async function userInfoChanged({ traveler, actor, changedBy, changes = [] }) {
    const fullname = travelerName(traveler);
    if (changedBy === "admin") {
        const formattedChanges = formatChanges(changes);
        const changeDetails = changes.length
            ? `\n\nSpremembe:\n${formattedChanges.text}`
            : "";

        return {
            traveler: await safeSend({
                to: traveler?.email,
                subject: `Posodobljeni podatki ${fullname}`,
                text: `Admin je posodobil vaše osebne podatke.${changeDetails}`,
            }),
        };
    }

    if (changedBy === "user") {
        // Notify every admin and let them reply directly to the employee who acted.
        const sent = await safeSend({
            to: adminRecipients(),
            replyTo: actor?.email,
            subject: `Posodobljeni podatki uporabnika ${fullname}`,
            text: `Uporabnik ${actorLabel(actor, traveler)} je posodobil svoje osebne podatke.`,
        });

        return { admin: sent };
    }

    throw new Error(`Neznan changedBy: ${changedBy}`);
}


async function orderCreated({ displayId, traveler, actor, order }) {
    const fullname = actorLabel(actor, traveler);
    const message = `${fullname} je oddal potni nalog ${displayId}.`;
    // Send the submission notice to all admins and set the employee as the reply address.
    const admin = await safeSend({
        to: adminRecipients(),
        replyTo: actor?.email,
        subject: `Nov potni nalog ${displayId}: ${fullname}`,
        text: message,
        html: `<p><b>${escapeHtml(fullname)}</b> je oddal nov potni nalog <b>${escapeHtml(displayId)}</b>.</p>${orderSummaryHtml(order)}`,
    });
    const employee = await safeSend({
        to: traveler?.email,
        subject: `Potni nalog ${displayId} je prejet.`,
        text: `Potni nalog ${displayId} je bil oddan in čaka na odobritev.`,
    });
    return { admin, traveler: employee };
}

module.exports = {
    orderCreated,
    orderCreatedByAdmin,
    orderApproved,
    orderDisapproved,
    orderDeleted,
    orderUpdated,
    orderPaid,
    obracunUpdated,
    orderCompleted,
    orderStatusChanged,
    monthlyOrderCreatedByAdmin,
    monthlyOrderCreated,
    monthlyOrderApproved,
    monthlyOrderDisapproved,
    monthlyOrderDeleted,
    monthlyOrderUpdated,
    monthlyOrderPaid,
    monthlyObracunUpdated,
    monthlyOrderCompleted,
    userInfoChanged,
};
