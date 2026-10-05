const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const db = new Database("./potniNalogiDatabase.db");

const users = db
    .prepare("SELECT id, geslo FROM users")
    .all();

const updatePassword = db.prepare(`
    UPDATE users
    SET geslo = ?
    WHERE id = ?
`);

for (const user of users) {
    if (!user.geslo.startsWith("$2")) {
        const hash = bcrypt.hashSync(user.geslo, 10);

        updatePassword.run(hash, user.id);

        console.log(`User ${user.id}: password hashed`);
    } else {
        console.log(`User ${user.id}: already hashed`);
    }
}


db.close();

console.log("All passwords have been hashed.");
