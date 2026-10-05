const Database = require('better-sqlite3');
const path = require('path');

/*
=========================================================
DATABASE
=========================================================
*/

const dbPath = path.join(__dirname, '..', '..', 'potniNalogiDatabase.db');
const db = new Database(dbPath);


console.log('Connected to the database:', dbPath);

db.exec(`
    CREATE TABLE IF NOT EXISTS mesecni_obracuni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        leto INTEGER NOT NULL,
        mesec INTEGER NOT NULL,
        skupno_dnevnice REAL NOT NULL DEFAULT 0,
        skupno_kilometrina REAL NOT NULL DEFAULT 0,
        skupno_racuni REAL NOT NULL DEFAULT 0,
        skupni_stroski REAL NOT NULL DEFAULT 0,
        datum_ustvarjanja DATETIME DEFAULT CURRENT_TIMESTAMP,
        datum_spremembe DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, leto, mesec),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS mesecni_obracun_vrstice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mesecni_obracun_id INTEGER NOT NULL,
        potni_nalog_id INTEGER NOT NULL,
        obracun_id INTEGER NOT NULL,
        dnevnice REAL NOT NULL DEFAULT 0,
        kilometrina REAL NOT NULL DEFAULT 0,
        racuni REAL NOT NULL DEFAULT 0,
        skupaj REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (mesecni_obracun_id) REFERENCES mesecni_obracuni(id) ON DELETE CASCADE,
        FOREIGN KEY (potni_nalog_id) REFERENCES potni_nalogi(id) ON DELETE CASCADE,
        FOREIGN KEY (obracun_id) REFERENCES obracun(id) ON DELETE CASCADE,
        UNIQUE (mesecni_obracun_id, potni_nalog_id)
    );
`);


/*
=========================================================
FOREIGN KEYS
=========================================================
*/

db.pragma('foreign_keys = ON');


/*
=========================================================
USERS
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        ime TEXT NOT NULL,
        priimek TEXT NOT NULL,
        prebivalisce TEXT NOT NULL,

        username TEXT NOT NULL UNIQUE,
        geslo TEXT NOT NULL DEFAULT 'NotPassword1.',

        delovno_mesto TEXT NOT NULL,

        role TEXT NOT NULL DEFAULT 'zaposleni',

        status TEXT NOT NULL DEFAULT 'active',

        registerska TEXT,
        vin TEXT
    );
`);


/*
=========================================================
POTNI NALOGI
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS potni_nalogi (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        display_id TEXT UNIQUE,

        user_id INTEGER NOT NULL,
        drzava_prihoda_id INTEGER NOT NULL,

        lokacija_odhoda TEXT NOT NULL,
        lokacija_prihoda TEXT NOT NULL,

        datum_odhoda TEXT NOT NULL,
        datum_prihoda TEXT NOT NULL,

        namen TEXT NOT NULL,
        vrsta_projekta TEXT NOT NULL,

        vozilo TEXT NOT NULL,
        registerska TEXT,
        vin TEXT,
        drugo_vozilo TEXT,

        prenocisce TEXT,

        placilo_predujema TEXT,

        opombe TEXT,

        mesecni INTEGER NOT NULL DEFAULT 0,

        datum_izdaje DATETIME DEFAULT CURRENT_TIMESTAMP,

        status TEXT NOT NULL DEFAULT 'Pending'
            CHECK (
                status IN (
                    'Pending',
                    'Approved',
                    'Disapproved',
                    'Completed',
                    'Active',
                    'Not paid'
                )
            ),

        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON UPDATE CASCADE,

        FOREIGN KEY (drzava_prihoda_id)
            REFERENCES drzave(id)
            ON UPDATE CASCADE

    );
`);

const travelOrderColumns = db.prepare("PRAGMA table_info(potni_nalogi)").all().map(column => column.name);
if (!travelOrderColumns.includes("mesecni")) {
    db.exec("ALTER TABLE potni_nalogi ADD COLUMN mesecni INTEGER NOT NULL DEFAULT 0");
}


/*
=========================================================
DRZAVE
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS drzave (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        naziv TEXT NOT NULL UNIQUE,
        valuta TEXT NOT NULL
    );
`);



/*
=========================================================
DNEVNICE
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS dnevnice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        drzava_id INTEGER NOT NULL UNIQUE,

        dnevnica14 REAL NOT NULL,
        dnevnica8 REAL NOT NULL,
        dnevnica6 REAL NOT NULL,

        FOREIGN KEY (drzava_id)
            REFERENCES drzave(id)
            ON UPDATE CASCADE
    );
`);


/*
=========================================================
OBRAČUN - GLAVNA TABELA
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS obracun (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        potni_nalog_id INTEGER NOT NULL UNIQUE,

        cas_prihoda_v_tujino TEXT,
        cas_odhoda_v_slovenijo TEXT,

        skupni_stroski REAL NOT NULL DEFAULT 0,
        placilo_zaposlenemu REAL NOT NULL DEFAULT 0,

        datum_ustvarjanja DATETIME DEFAULT CURRENT_TIMESTAMP,
        datum_spremembe DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (potni_nalog_id)
            REFERENCES potni_nalogi(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );
`);


/*
=========================================================
OBRAČUN DNEVNICE - VRSTICE (VEČ PO OBRAČUNU)
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS obracun_dnevnice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        obracun_id INTEGER NOT NULL,

        datum TEXT NOT NULL,
        zagotovljeni_obroki TEXT,
        dnevnica_ure INTEGER NOT NULL DEFAULT 14,
        dnevnica REAL NOT NULL DEFAULT 0,

        FOREIGN KEY (obracun_id)
            REFERENCES obracun(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );
`);


/*
=========================================================
OBRAČUN KILOMETRINE - VRSTICE (NAPREJ + NAZAJ)
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS obracun_kilometrine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        obracun_id INTEGER NOT NULL,

        smer TEXT NOT NULL,
        datum TEXT,
        lokacija_odhoda TEXT NOT NULL,
        lokacija_prihoda TEXT NOT NULL,

        kilometri REAL NOT NULL DEFAULT 0,
        cena_na_km REAL NOT NULL DEFAULT 0.43,
        obracun REAL NOT NULL DEFAULT 0,

        FOREIGN KEY (obracun_id)
            REFERENCES obracun(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS potni_nalog_datoteke (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        potni_nalog_id INTEGER NOT NULL,
        originalno_ime TEXT NOT NULL,
        mime_type TEXT,
        velikost INTEGER NOT NULL DEFAULT 0,
        vsebina BLOB NOT NULL,
        FOREIGN KEY (potni_nalog_id)
            REFERENCES potni_nalogi(id)
            ON DELETE CASCADE
    );
`);


/*
=========================================================
OBRAČUN RAČUNI - VRSTICE (STROŠKI, RAČUNI)
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS obracun_racuni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        obracun_id INTEGER NOT NULL,

        podjetje TEXT,
        opis_stroska TEXT,
        znesek REAL NOT NULL DEFAULT 0,

        FOREIGN KEY (obracun_id)
            REFERENCES obracun(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );
`);


/*
=========================================================
OBRAČUN DATOTEKE - PRIPONKE (RAČUNI, DOKAZILA)
=========================================================
*/

db.exec(`
    CREATE TABLE IF NOT EXISTS obracun_datoteke (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        racun_id INTEGER NOT NULL,

        originalno_ime TEXT NOT NULL,
        ime_datoteke TEXT NOT NULL,
        pot_datoteke TEXT NOT NULL,

        mime_type TEXT,
        velikost INTEGER,
        vsebina BLOB,

        FOREIGN KEY (racun_id)
            REFERENCES obracun_racuni(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS mesecni_obracun_datoteke (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        obracun_id INTEGER NOT NULL,
        originalno_ime TEXT NOT NULL,
        mime_type TEXT,
        velikost INTEGER NOT NULL DEFAULT 0,
        vsebina BLOB NOT NULL,
        FOREIGN KEY (obracun_id)
            REFERENCES obracun(id)
            ON DELETE CASCADE
    );
`);

db.prepare("INSERT OR IGNORE INTO drzave (naziv, valuta) VALUES (?, ?)").run("Slovenija", "EUR");

const attachmentColumns = db.prepare("PRAGMA table_info(obracun_datoteke)").all().map(column => column.name);
if (attachmentColumns.length > 0 && !attachmentColumns.includes("vsebina")) {
    db.exec("ALTER TABLE obracun_datoteke ADD COLUMN vsebina BLOB");
}

const dailyAllowanceColumns = db.prepare("PRAGMA table_info(obracun_dnevnice)").all().map(column => column.name);
if (dailyAllowanceColumns.length > 0 && !dailyAllowanceColumns.includes("dnevnica_ure")) {
    db.exec("ALTER TABLE obracun_dnevnice ADD COLUMN dnevnica_ure INTEGER NOT NULL DEFAULT 14");
}

const mileageColumns = db.prepare("PRAGMA table_info(obracun_kilometrine)").all().map(column => column.name);
if (mileageColumns.length > 0 && !mileageColumns.includes("datum")) {
    db.exec("ALTER TABLE obracun_kilometrine ADD COLUMN datum TEXT");
}

const missingDisplayIds = db.prepare("SELECT id, datum_izdaje FROM potni_nalogi WHERE display_id IS NULL ORDER BY id").all();
const updateDisplayId = db.prepare("UPDATE potni_nalogi SET display_id = ? WHERE id = ?");
const yearlyCounters = new Map();
missingDisplayIds.forEach(order => {
    const year = new Date(order.datum_izdaje || Date.now()).getFullYear();
    const count = (yearlyCounters.get(year) || 0) + 1;
    yearlyCounters.set(year, count);
    updateDisplayId.run(`${year}-${String(count).padStart(3, "0")}`, order.id);
});

db.prepare(`
    CREATE TABLE IF NOT EXISTS potni_nalog_stevilcenje (
        leto INTEGER PRIMARY KEY,
        naslednja_stevilka INTEGER NOT NULL
    )
`).run();

const existingYearIds = db.prepare("SELECT display_id FROM potni_nalogi WHERE display_id IS NOT NULL").all();
const highestByYear = new Map();
existingYearIds.forEach(({ display_id }) => {
    const match = /^(\d{4})-(\d+)$/.exec(display_id);
    if (!match) return;
    const year = Number(match[1]);
    const number = Number(match[2]);
    highestByYear.set(year, Math.max(highestByYear.get(year) || 0, number));
});

const seedCounter = db.prepare("INSERT OR IGNORE INTO potni_nalog_stevilcenje (leto, naslednja_stevilka) VALUES (?, ?)");
highestByYear.forEach((highest, year) => seedCounter.run(year, highest + 1));

function nextTravelOrderDisplayId() {
    const year = new Date().getFullYear();
    return db.transaction(() => {
        const existing = db.prepare(`
            SELECT naslednja_stevilka
            FROM potni_nalog_stevilcenje
            WHERE leto = ?
        `).get(year);
        const number = existing?.naslednja_stevilka || 1;
        if (existing) {
            db.prepare("UPDATE potni_nalog_stevilcenje SET naslednja_stevilka = ? WHERE leto = ?")
                .run(number + 1, year);
        } else {
            db.prepare("INSERT INTO potni_nalog_stevilcenje (leto, naslednja_stevilka) VALUES (?, ?)")
                .run(year, number + 1);
        }
        return `${year}-${String(number).padStart(3, "0")}`;
    })();
}


/*
=========================================================
DATABASE READY
=========================================================
*/

console.log('Database initialization complete.');


db.exec(`
    INSERT OR IGNORE INTO users
    (ime, priimek, delovno_mesto, username, geslo, prebivalisce, role, status, registerska, vin)
    VALUES
    ('Boris', 'Gašperin', 'Operativni direktor', 'borisG', 'NotPassword1.', 'Hruševo 152,1356  Dobrova', 'admin', 'Active', 'LJ08-EDN', 'TMBEK9PJ2P4014939'),

    ('Hana', 'Zupančič', 'Pravnik', 'hanaZ', 'NotPassword1.', 'Celovška cesta 147,1000  Ljubljan', 'zaposleni', 'Active', 'nima', 'nima'),

    ('Iztok', 'Škof', 'Strokovnjak za področje', 'iztokS', 'NotPassword1.', 'Vzajemna 24,1000  Ljubljana', 'zaposleni', 'Active', 'LJ 65-PMV', 'W0VERHNP2MJ522025'),

    ('Mateja', 'Ivanc', 'Vodja prodaje', 'matejaI', 'NotPassword1.', 'Golo brdo 195,1215  Medvode', 'zaposleni', 'Active', 'Lj 42-DEV', 'TSMJYBD2S00C04949'),

    ('Sašo', 'Radić', 'Strokovnjak za področje', 'sasoR', 'NotPassword1.', 'Jakčeva ulica 8,1000  Ljubljana', 'zaposleni', 'Active', 'LJ 27-CRZ', 'TMBER6NW8M3092541'),

    ('Simon', 'Filipič', 'Strokovnjak za področje', 'simonF', 'NotPassword1.', 'Štatenberg 83,2321  Makole', 'zaposleni', 'Active', 'MB 21-UTL', 'WVWZZZ3CZHE202661'),

    ('Vito', 'Ferlan', 'Vodilni inženir', 'vitoF', 'NotPassword1.', 'Kunaverjeva ulica 4,1000  Ljubljana', 'zaposleni', 'Active', 'LJ DZU-98', 'JMBLNCX3A9U002756'),

    ('Žiga', 'Zupančič', 'Inženir programske opreme', 'zigaZ', 'NotPassword1.', 'Zaloška 92A,1000  Ljubljana', 'zaposleni', 'Active', 'nima', 'nima'),

    ('Nina', 'Minov', 'Vodja kadrovske službe', 'ninaM', 'NotPassword1.', 'Nazorjeva ulica 10, 4000 Kranj', 'admin', 'Active', 'LJ 064-NB', 'JMZKFGW7600623958')
 `);



/*
=========================================================
PODATKI O DRŽAVAH IN DNEVNICAH
=========================================================
*/

const dnevnice = [
    ["Albanija", "€", 48.00, 36.00, 12.00],
    ["Andora", "€", 48.00, 36.00, 12.00],
    ["Armenija", "€", 48.00, 36.00, 12.00],
    ["Avstralija", "$", 72.00, 54.00, 18.00],
    ["Avstrija", "€", 66.00, 49.50, 16.50],
    ["Azerbajdžan", "€", 48.00, 36.00, 12.00],
    ["Belgija", "€", 76.00, 57.00, 19.00],
    ["Belorusija", "€", 48.00, 36.00, 12.00],
    ["Bolgarija", "€", 48.00, 36.00, 12.00],
    ["Bosna in Hercegovina", "€", 48.00, 36.00, 12.00],
    ["Ciper", "€", 48.00, 36.00, 12.00],
    ["Češka", "€", 48.00, 36.00, 12.00],
    ["Črna gora", "€", 48.00, 36.00, 12.00],
    ["Danska", "€", 66.00, 49.50, 16.50],
    ["Estonija", "€", 48.00, 36.00, 12.00],
    ["Finska", "€", 66.00, 49.50, 16.50],
    ["Francija", "€", 66.00, 49.50, 16.50],
    ["Grčija", "€", 48.00, 36.00, 12.00],
    ["Gruzija", "€", 48.00, 36.00, 12.00],
    ["Hrvaška", "€", 48.00, 36.00, 12.00],
    ["Irska", "€", 66.00, 49.50, 16.50],
    ["Islandija", "€", 66.00, 49.50, 16.50],
    ["Italija", "€", 66.00, 49.50, 16.50],
    ["Japonska", "$", 120.00, 90.00, 30.00],
    ["Kanada", "$", 72.00, 54.00, 18.00],
    ["Kitajska", "$", 53.00, 39.75, 13.25],
    ["Kitajska (Hongkong)", "$", 84.00, 63.00, 21.00],
    ["Kitajska (Peking, Šanghaj)", "$", 108.00, 81.00, 27.00],
    ["Kosovo", "€", 48.00, 36.00, 12.00],
    ["Latvija", "€", 48.00, 36.00, 12.00],
    ["Lihtenštajn", "€", 66.00, 49.50, 16.50],
    ["Litva", "€", 48.00, 36.00, 12.00],
    ["Luksemburg", "€", 66.00, 49.50, 16.50],
    ["Madžarska", "€", 48.00, 36.00, 12.00],
    ["Malta", "€", 48.00, 36.00, 12.00],
    ["Moldavija", "€", 48.00, 36.00, 12.00],
    ["Monako", "€", 66.00, 49.50, 16.50],
    ["Nemčija", "€", 66.00, 49.50, 16.50],
    ["Nizozemska", "€", 66.00, 49.50, 16.50],
    ["Norveška", "€", 66.00, 49.50, 16.50],
    ["Nova Zelandija", "$", 72.00, 54.00, 18.00],
    ["Poljska", "€", 48.00, 36.00, 12.00],
    ["Portugalska", "€", 66.00, 49.50, 16.50],
    ["Romunija", "€", 48.00, 36.00, 12.00],
    ["Rusija", "€", 48.00, 36.00, 12.00],
    ["Rusija (Moskva, Sankt Petersburg)", "€", 96.00, 72.00, 24.00],
    ["San Marino", "€", 48.00, 36.00, 12.00],
    ["Severna Makedonija", "€", 48.00, 36.00, 12.00],
    ["Slovaška", "€", 48.00, 36.00, 12.00],
    ["Srbija", "€", 48.00, 36.00, 12.00],
    ["Španija", "€", 66.00, 49.50, 16.50],
    ["Švedska", "€", 66.00, 49.50, 16.50],
    ["Švica", "€", 66.00, 49.50, 16.50],
    ["Turčija", "€", 48.00, 36.00, 12.00],
    ["Ukrajina", "€", 48.00, 36.00, 12.00],
    ["Vatikan", "€", 66.00, 49.50, 16.50],
    ["Združene države Amerike", "$", 72.00, 54.00, 18.00],
    ["Združeno kraljestvo Velike Britanije in Severne Irske", "€", 66.00, 49.50, 16.50],
    ["Druge države", "€", 60.00, 45.00, 15.00]
];



/*
=========================================================
VSTAVLJANJE PODATKOV
=========================================================
*/

const insertDrzava = db.prepare(`
    INSERT OR IGNORE INTO drzave (
        naziv,
        valuta
    )
    VALUES (?, ?)
`);

const insertDnevnica = db.prepare(`
    INSERT OR REPLACE INTO dnevnice (
        drzava_id,
        dnevnica14,
        dnevnica8,
        dnevnica6
    )
    VALUES (
        (SELECT id FROM drzave WHERE naziv = ?),
        ?,
        ?,
        ?
    )
`);

db.exec("BEGIN TRANSACTION");

try {
    for (const [
        naziv,
        valuta,
        dnevnica14,
        dnevnica8,
        dnevnica6
    ] of dnevnice) {

        insertDrzava.run(
            naziv,
            valuta
        );

        insertDnevnica.run(
            naziv,
            dnevnica14,
            dnevnica8,
            dnevnica6
        );
    }

    db.exec("COMMIT");

} catch (error) {
    db.exec("ROLLBACK");
    throw error;
}



module.exports = { db, nextTravelOrderDisplayId };