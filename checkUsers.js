const Database = require("better-sqlite3");

const db = new Database("./potniNalogiDatabase.db");

const users = db
    .prepare("SELECT id, username, geslo FROM users")
    .all();

console.log(users);

db.close();
