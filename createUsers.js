const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const { normalizeEmailAddress } = require("./emailUtils");

const db = new Database("./potniNalogiDatabase.db");

async function createUser() {
    const email = normalizeEmailAddress(process.argv[2]);
    if (!email) {
        throw new Error("Uporaba: node createUsers.js <veljaven e-poštni naslov>");
    }

    const ime = "Janez";
    const priimek = "Novak";
    const prebivalisce = "Ljubljana";
    const username = "Janez";
    const geslo = "1234";
    const delovno_mesto = "HR";
    const role = "admin";
    const registerska = null;
    const vin = null;

    // Hash password
    const hashedPassword = await bcrypt.hash(geslo, 10);

    // Insert user
    const stmt = db.prepare(`
        INSERT INTO users (
            ime,
            priimek,
            email,
            prebivalisce,
            username,
            geslo,
            delovno_mesto,
            role,
            registerska,
            vin
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        ime,
        priimek,
        email,
        prebivalisce,
        username,
        hashedPassword,
        delovno_mesto,
        role,
        registerska,
        vin
    );

    console.log("User created!");
    console.log("Username:", username);
    console.log("Password:", geslo);
    console.log("Hash:", hashedPassword);

    db.close();
}

createUser()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => db.close());
