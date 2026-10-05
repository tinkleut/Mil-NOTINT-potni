const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const db = new Database("./potniNalogiDatabase.db");

async function createUser() {
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
            prebivalisce,
            username,
            geslo,
            delovno_mesto,
            role,
            registerska,
            vin
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        ime,
        priimek,
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

createUser();
