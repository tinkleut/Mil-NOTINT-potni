// SERVER SIDE



// IMPORT REQUIRED LIBRARIES
// Download and import all necessary packages for server functionality.
const multer = require('multer');
const express = require("express");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cron = require('node-cron');
// A library for creating, reading, and manipulating ZIP files.
const JSZip = require("jszip");
//Libraries for converting between XML and JavaScript objects.
const { xml2js, js2xml } = require("xml-js");

// INITIALIZE EXPRESS APPLICATION
// Create a variable storing the Express function used for building web applications.
const app = express();

// INITIALIZE DATABASE CONNECTION
// Import database instance and ID generator function from database module.
const { db, nextTravelOrderDisplayId } = require("./private/JS/potniNalogDatabase");

// CONFIGURE FILE UPLOAD HANDLING
// Set multer to store files in memory with size and quantity limits.
// Use memory storage instead of disk storage for temporary file handling.
const upload = multer({
    
    // Store uploaded files in RAM instead of writing to disk.
    storage: multer.memoryStorage(), // Store files in buffer (RAM).
    // Set maximum of 10 files per request and 10MB per file.
    limits: { 
        // Maximum number of files allowed in a single upload request.
        files: 10, 
        // Maximum file size in bytes (30 * 1024 * 1024 = 30 MB).
        fileSize: 30 * 1024 * 1024 
    }
});


// FUNCTION TO SHOW MASSAGES WHEN TRAVEL ORDER, OBCARUN, MONTHLY TRAVEL ORDER OR MONTHYL OBRACUN IS CREATED, APPROVED, DISAPPROVED OR UPDATED


// FUNCTION TO SAVE TRAVEL ORDER ATTACHMENT FILES
function saveTravelOrderAttachments(files, orderId) {
    // Exit if no files provided.
    if (!Array.isArray(files) || files.length === 0) return;

    // Prepare SQL statement for inserting attachments.
    const insertAttachment = db.prepare(`
        INSERT INTO potni_nalog_datoteke
            (potni_nalog_id,
            originalno_ime,
            mime_type,
            velikost,
            vsebina)
        VALUES (?, ?, ?, ?, ?)
    `);

    // Insert each file into the database with original filename and content.
    files.forEach(file => {
        // Check if file has content (buffer exists).
        if (file.buffer) {
            // Execute SQL insert with file data and associate it to the travel order.
            insertAttachment.run(
                orderId, 
                file.originalname, 
                file.mimetype, 
                file.size, 
                file.buffer);
        }
    });
}

// FUNCTION TO VALIDATE TRAVEL ORDER INPUT DATA
function validateTravelOrderInput(data) {
    // Define required fields that must be filled in.
    const required = ["namen", "vrsta_projekta", "lokacija_odhoda", "lokacija_prihoda", "datum_odhoda", "datum_prihoda", "vozilo"];
    
    // Check that all required fields are non-empty.
    if (required.some(field => !String(data[field] || "").trim())) return "Prosim izpolnite vsa obvezna polja.";
    
    // Validate vehicle type is one of the allowed options.
    if (!["car", "other"].includes(data.vozilo)) return "Izberite veljavno prevozno sredstvo.";
    
    // If vehicle is a car, verify registration plate and VIN are provided.
    if (data.vozilo === "car" && (!String(data.registerska || "").trim() || !String(data.vin || "").trim())) return "Za avto sta obvezni registrska tablica in VIN številka.";
    
    // If vehicle is other type, verify description is provided.
    if (data.vozilo === "other" && !String(data.drugo_vozilo || "").trim()) return "Vnesite drugo prevozno sredstvo.";
    
    // Validate dates: arrival must be after departure.
    const departure = new Date(data.datum_odhoda);
    const arrival = new Date(data.datum_prihoda);
    if (Number.isNaN(departure.getTime()) || Number.isNaN(arrival.getTime()) || departure >= arrival) return "Datum in ura prihoda morata biti poznejša od odhoda.";
    
    // Return null if all validations pass.
    return null;
}

// FUNCTION TO SAVE RECEIPT ATTACHMENT FILES
function saveReceiptAttachments(files, receiptIds) {
    // Exit if no files provided.
    if (!Array.isArray(files) || files.length === 0) return;

    // Prepare SQL statement for inserting receipt attachments.
    const insertAttachment = db.prepare(`
        INSERT INTO obracun_datoteke
            (racun_id, 
            originalno_ime, 
            ime_datoteke, 
            pot_datoteke, 
            mime_type, 
            velikost, 
            vsebina)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Initialize fallback index to track position when field name doesn't contain index.
    let fallbackIndex = 0;

    // Process each uploaded file and associate with correct receipt.
    files.forEach(file => {
        // Extract receipt index from field name (e.g., "racun_priponka[0]" -> 0).
        const match = String(file.fieldname || "").match(/\[(\d+)\]/);
        // If field name has index, use it; otherwise find next available receipt ID starting from fallbackIndex.
        const receiptIndex = match ? Number(match[1]) : receiptIds.findIndex((id, index) => id && index >= fallbackIndex);
        // Get the actual receipt ID using the determined index.
        const receiptId = receiptIds[receiptIndex];

        // Skip if receipt ID or file buffer is missing.
        if (!receiptId || !file.buffer) return;

        fallbackIndex = receiptIndex + 1;

        // Insert file into database with receipt association.
        insertAttachment.run(
            receiptId,
            file.originalname,
            file.originalname,
            "database",
            file.mimetype,
            file.size,
            file.buffer
        );
    });
}

// FUNCTION TO RETRIEVE RECEIPT ATTACHMENTS FROM DATABASE
function captureReceiptAttachments(obracunId) {
    // Query database for all attachments linked to receipts in this billing record.
    return db.prepare(`
        SELECT r.id AS racun_id, d.originalno_ime, d.ime_datoteke, d.pot_datoteke,
               d.mime_type, d.velikost, d.vsebina
        FROM obracun_racuni r
        JOIN obracun_datoteke d ON d.racun_id = r.id
        WHERE r.obracun_id = ?
        ORDER BY r.id, d.id
    `).all(obracunId);
}

// FUNCTION TO RESTORE RECEIPT ATTACHMENTS WITH NEW RECEIPT IDS -- IDK IF A REAL FUNCTION IN THE APP YET...
function restoreReceiptAttachments(attachments, receiptIds) {
    // Exit if no attachments to restore.
    if (!attachments.length) return;

    // Map old receipt IDs to their positions.

    // Extract unique receipt IDs from attachments using Set to remove duplicates.
    const oldReceiptIds = [...new Set(attachments.map(file => file.racun_id))];

    // Create a Map that connects each old receipt ID to its position index.
    const receiptIndexById = new Map(oldReceiptIds.map((receiptId, index) => [receiptId, index]));

    // Filter out empty/null receipt IDs and keep only valid ones.
    const newReceiptIds = receiptIds.filter(Boolean);
    
    // Prepare SQL statement for inserting attachments with new receipt IDs.
    const insertAttachment = db.prepare(`
        INSERT INTO obracun_datoteke
            (racun_id, 
            originalno_ime, 
            ime_datoteke, 
            pot_datoteke, 
            mime_type, 
            velikost, 
            vsebina)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Re-insert each attachment with the corresponding new receipt ID.
    attachments.forEach(file => {
        // Look up the position index of the old receipt ID using the Map.
        const index = receiptIndexById.get(file.racun_id);
        // Get the new receipt ID at that same position from the new receipts array.
        const newReceiptId = newReceiptIds[index];
        if (newReceiptId) {
            insertAttachment.run(
                newReceiptId,
                file.originalno_ime,
                file.ime_datoteke,
                file.pot_datoteke,
                file.mime_type,
                file.velikost,
                file.vsebina
            );
        }
    });
}

// DEFINE SERVER PORT
// Port on which the localhost will run the website.
const PORT = 3000;

// CONFIGURE EXPRESS SESSION MANAGEMENT
// Set up session handling with secure cookie settings.
const sessionSecret = process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex");
app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        secure: false || process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 1000 // Session expires after 1 hour of inactivity.
    }
}));

// ROOT PATH ROUTE
app.get("/", (req, res) => {
    res.redirect("/login");
});

// CONFIGURE EXPRESS MIDDLEWARE
// Enable JSON request body parsing and static file serving.
app.use(express.json());
app.use("/CSS", express.static("public/CSS"));
app.use("/JS", express.static("public/JS"));
app.use("/adminJS", express.static("private/JS"));

// LOGIN PROTECTION MIDDLEWARE
// Redirect unauthenticated users back to login page.
function requireLogin(req, res, next) {

    if (!req.session.userId) {
        return res.redirect("/login");
    }

    if (req.session.role !== "zaposleni") {
        return res.status(403).send("Access denied.");
    }

    next();
}

// Allow employees and admins on travel-order endpoints that enforce order ownership.
function requireTravelOrderSession(req, res, next) {
    if (!req.session.userId) return res.redirect("/login");
    if (!["zaposleni", "admin"].includes(req.session.role)) return res.status(403).send("Access denied.");
    next();
}

// ADMIN PROTECTION MIDDLEWARE
// Redirect non-admin users to login page and deny access to non-admins.
function requireAdmin(req, res, next) {
    // Check if user is authenticated.
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    // Check if user has admin role.
    if (req.session.role !== "admin") {
        return res.status(403).send("Access denied.");
    }

    next();
}

// PUBLIC PAGE ROUTES

// LOGIN PAGE ROUTE
app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/public/HTML/login.html");
});

// ADMIN PAGE ROUTES (PROTECTED)

// ADMIN DASHBOARD
app.get("/admin", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/admin.html");
})

// CREATE NEW TRAVEL ORDER PAGE
app.get("/admin/novPotniNalog", requireAdmin, (req, res) => {
   res.sendFile(__dirname + "/private/HTML/novPotniNalog.html") 
});

// CREATE A NEW MONTHLY TRAVEL ORDER PAGE
app.get("/admin/novMesecniPotniNalog", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/novMesecniPotniNalog.html");
});

// VIEW ALL TRAVEL ORDERS PAGE
app.get("/admin/vsiNalogi", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/vsiNalogi.html")
});

// EDIT TRAVEL ORDER PAGE
app.get("/admin/urediPotniNalog", requireAdmin, (req, res) => {
    const order = db.prepare("SELECT mesecni FROM potni_nalogi WHERE id = ?").get(req.query.id);
    const page = Number(order?.mesecni) === 1
        ? "/private/HTML/urediMesecniPotniNalog.html"
        : "/private/HTML/urediPotniNalog.html";
    res.sendFile(__dirname + page);
});

// EDIT MONTHLY TRAVEL ORDER PAGE
app.get("/admin/urediMesecniPotniNalog", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/urediMesecniPotniNalog.html");
});

// VIEW ALL MONTHLY TRAVEL ORDERS PAGE
app.get("/admin/vsiMesecniPotniNalogi", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/vsiMesecniPotniNalogi.html");
});

// PAGE FOR MONTHLY TRAVEL ORDER OBRACUN
app.get("/admin/mesecniObracun", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/mesecniObracun.html");
});

// EIDT MONTHLY TRAVEL OBRACUN PAGE
app.get("/admin/urediMesecniObracun", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/urediMesecniObracun.html");
});

// VIEW PENDING TRAVEL ORDERS PAGE
app.get("/admin/pending", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/pending.html")
});

// VIEW APPROVED TRAVEL ORDERS PAGE
app.get("/admin/approved", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/approved.html")
});

// VIEW DISAPPROVED TRAVEL ORDERS PAGE
app.get("/admin/disapproved", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/disapproved.html")
});

// VIEW ACTIVE TRAVEL ORDERS PAGE
app.get("/admin/active", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/active.html")
});

// VIEW UNPAID TRAVEL ORDERS PAGE
app.get("/admin/paid", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/paid.html")
});

// VIEW COMPLETED TRAVEL ORDERS PAGE
app.get("/admin/closed", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/closed.html")
});

// BILLING CALCULATION PAGE
app.get("/admin/obracun", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/obracun.html")
});

// VIEW BILLING DISPLAY PAGE
app.get("/admin/prikazObracuna", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/prikazObracuna.html")
});

// ADMIN SETTINGS PAGE
app.get("/admin/settings", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/settings.html")
});

// MANAGE USERS PAGE
app.get("/admin/users", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/users.html")
});

// MANAGE DAILY ALLOWANCE RATES PAGE
app.get("/admin/dnevnice", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/dnevnice.html")
});

// EDIT COMPLETED TRAVEL ORDER PAGE
app.get("/admin/urediKoncaniPotniNalog", requireAdmin, (req, res) => {
    res.sendFile(__dirname + "/private/HTML/urediKoncaniPotniNalog.html")
});

// USER PAGE ROUTES (PROTECTED)

// USER HOME PAGE
app.get("/index", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/index.html");
});

// USER'S TRAVEL ORDERS PAGE
app.get("/mojiMesecniPotniNalogi", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/mojiMesecniPotniNalogi.html");
});

// USER'S TRAVEL ORDERS PAGE
app.get("/mojiNalogi", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/mojiNalogi.html");
});

// INDEX PAGE FOR CREATING TRAVEL ORDERS
app.get("/index", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/index.html");
});

// MONTHLY TRAVEL ORDERS PAGE
app.get("/mesecniPotniNalogi", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/mesecniPotniNalogi.html");
});

// CHANGE PASSWORD PAGE
app.get("/changePassword", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/changePassword.html");
});

// EDIT TRAVEL ORDER PAGE
app.get("/urediNalog", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/urediNalog.html");
});

// EDIT MONTHLY TRAVEL ORDER PAGE
app.get("/urediMesecniPotniNalog", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/urediMesecniPotniNalog.html");
});

// USER BILLING PAGE
app.get("/obracunUser", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/obracunUser.html");
});

// USER MONTHLY TRAVEL-ORDER CALCULATION PAGE
app.get("/mesecniObracunUser", requireLogin, (req, res) => {
    res.sendFile(__dirname + "/public/HTML/mesecniObracunUser.html");
});

// STATIC FILES ROUTES
app.use("/logo.png", express.static("./logo.png"));
app.use(express.static("public"));

// LOGIN API ENDPOINT
// Process user login request with username and password validation.
app.post("/login", async (req, res) => {

    // Extract username and password from request body.
    const { username, password } = req.body;

    // Query database to find user by username.
    const user = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username);

    // Return error if user not found in database.
    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Username or password is incorrect."
        });
    }

    // Compare provided password with hashed password in database.
    const passwordCorrect = await bcrypt.compare(
        password,
        user.geslo
    );


    // Return error if password does not match.
    if (!passwordCorrect) {
        return res.status(401).json({
            success: false,
            message: "Username or password is incorrect."
        });
    }

    // Store user information in session for authenticated requests.
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    // Return different response based on user role (admin or regular user).
    if (user.role === "admin") {
        return res.json({
            success: true,
            message: "Admin login successful",
            admin: true
        })
    }

    return res.json({
        success: true,
        message: "Login successful!",
        admin: false
    });
});

// LOGOUT API ENDPOINT
// Destroy user session and log them out.
app.post("/logout", (req, res) => {

    // Destroy the current session.
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false
            });
        } else {
            res.json({
                success: true
            });
        }
    });
});

// CHANGE PASSWORD API ENDPOINT
// Allow authenticated users to change their password.
app.post("/changePassword", requireLogin, (req, res) => {

    // Extract username and new passwords from request body.
    const {username, password, Apassword} = req.body;

    // Validate that all required fields are provided.
    if (!username || !password || !Apassword) {
        return res.status(400).json({
            success: false,
            message: "Izpolnite vsa polja."
        });
    }

    // Verify that both password fields match.
    if (password !== Apassword) {
        return res.status(400).json({
            success: false,
            message: "Gesli se ne ujemata."
        });
    } 

    // Enforce minimum password length requirement.
    if (password.length < 14) {
        return res.status(400).json({
            success: false,
            message: "Geslo mora imeti najmanj 14 znakov."
        })
    }

    // Query database to find user by username.
    const user = db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username);

    // Return error if username not found.
    if (!user) {
        return res.status(400).json({
            success: false,
            message: "Uporabniško ime ne obstaja."
        })
    }

    // Ensure user can only change their own password.
    if (user.id !== req.session.userId) {
        return res.status(403).json({
            success: false,
            message: "Spremenite lahko samo svoje geslo."
        })
    }

    try {

        // Hash the new password or use provided hash if already hashed.
        let hashedPassword;

        if (!password.startsWith("$2")) {
            hashedPassword = bcrypt.hashSync(password, 10);
        } else {
            hashedPassword = password;
        }

        // Prepare SQL statement to update user password.
        const updatePassword = db.prepare(`
            UPDATE users
            SET geslo = ?
            WHERE id = ?
        `);

        // Execute password update in database.
        updatePassword.run(hashedPassword, user.id);
        
        // Return success response to client.
        res.json({
            success: true,
            message: "Geslo je bilo uspešno spremenjeno!"
        });
    } catch (error) {
        // Log error and return error response if password change fails.
        console.error("Napaka pri spremembi gesla:", error);
        res.status(500).json({
            success: false,
            message: "Napaka pri spremembi gesla"
            });
        }
});


// GET USERS NAME USING API, USED FOR AUTOFILL
app.get("/api/user_info", requireLogin, (req, res) => {

    try {

        const user = db
            .prepare(`
                SELECT 
                    id,
                    username,
                    ime,
                    priimek,
                    prebivalisce,
                    delovno_mesto,
                    registerska,
                    vin
                FROM users
                WHERE id = ?
            `)
            .get(req.session.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Uporabnik ni bil najden."
            });
        }

        res.json({
            username: user.username,
            ime: user.ime,
            priimek: user.priimek,
            prebivalisce: user.prebivalisce,
            delovno_mesto: user.delovno_mesto,
            registerska: user.registerska,
            vin: user.vin
        });
    } catch (error) {
        console.error("Napaka pri pridobivanju podatkov uporabnika:", error);

        res.status(500).json({
            success: false,
            message: "Napaka pri pridobivanju podatkov uporabnika."
        });
    }
});


// GET USERS NAME USING API, USED FOR AUTOFILL IN ADMIN, match uname to id
app.get("/api/user_info_admin", requireAdmin, (req, res) => {
    try {

        const { employee_id } = req.query;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: "Employee ID je obvezen!"
            });
        }

        const userId = parseInt(employee_id, 10);

        const user = db
            .prepare(`
                SELECT 
                    id,
                    username,
                    ime,
                    priimek,
                    prebivalisce,
                    delovno_mesto,
                    registerska,
                    vin
                FROM users
                WHERE id = ?
            `)
            .get(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Uporabnik ni bil najden."
            });
        }

        res.json({
            username: user.username,
            ime: user.ime,
            priimek: user.priimek,
            prebivalisce: user.prebivalisce,
            delovno_mesto: user.delovno_mesto,
            registerska: user.registerska,
            vin: user.vin
        });

    } catch (error) {
        console.error("FULL ERROR:", error);
        res.status(500).json({
            success: false,
            message: "Napaka pri pridobivanju podatkov uporabnika: " + error.message
        });
    }
});


// GET INFO OF ALL EMPLOYEES FROM DATABASE -- ADMIN
app.get("/api/employees", requireAdmin, (req, res) => {

    try { 

        const employees = db
            .prepare(`
                SELECT
                    id,
                    username,
                    ime,
                    priimek
                FROM users
                ORDER BY priimek, ime    
                `).all();


        res.json(employees);

    } catch (error) {

        console.error("Napaka pri pridobivanju zaposlenih:", error);

        res.status(500).json({
            success: false,
            message: "Napaka pri pridobivanju zaposlenih."
        });
    }
});


// CREATE A TRAVEL ORDER API

app.post("/api/travel_order", requireTravelOrderSession, upload.array("potni_nalog_datoteke", 10), (req, res) => { // Accept up to 10 files from the potni_nalog_datoteke form field.

    try {

        const {
            ime,
            priimek,
            prebivalisce,
            delovno_mesto,
            employee_id,
            namen,
            vrsta_projekta,
            lokacija_odhoda,
            lokacija_prihoda,
            datum_odhoda,
            datum_prihoda,
            vozilo,
            registerska,
            vin,
            drugo_vozilo,
            prenocisce,
            placilo_predujema,
            opombe,
            mesecni
        } = req.body;

        const validationError = validateTravelOrderInput(req.body);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        // We find the country of arrival.
        const drzava = db.prepare(`
            SELECT id
            FROM drzave
            WHERE ? LIKE '%' || naziv || '%'
        `).get(lokacija_prihoda);

        // If we don't find the country.
        if (!drzava) {

            return res.status(400).json({
                success: false,
                message: "Države iz lokacije prihoda ni mogoče najti v seznamu držav."
            });
        }

        let userId;

        if (req.session.role === "admin") {
            userId = Number.parseInt(employee_id, 10);

            if (!Number.isInteger(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "Izberite zaposlenega, ki je dejansko opravil pot."
                });
            }
        } else {
            userId = req.session.userId;
        }

        const traveler = db.prepare(`
            SELECT id, 
                ime, 
                priimek, 
                prebivalisce, 
                delovno_mesto, 
                registerska, 
                vin
            FROM users
            WHERE id = ?
        `).get(userId);

        if (!traveler) {
            return res.status(400).json({
                success: false,
                message: "Izbrani potnik ne obstaja."
            });
        }

        const stmt = db.prepare(`
            INSERT INTO potni_nalogi (
                display_id,
                user_id, 
                drzava_prihoda_id,
                namen, 
                vrsta_projekta, 
                lokacija_odhoda, 
                lokacija_prihoda,
                datum_odhoda, 
                datum_prihoda, 
                vozilo, 
                registerska, 
                vin, 
                drugo_vozilo,
                prenocisce,
                placilo_predujema, 
                opombe,
                mesecni,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            nextTravelOrderDisplayId(),
            userId,
            drzava.id,  
            namen,                   
            vrsta_projekta,          
            lokacija_odhoda,         
            lokacija_prihoda,      
            datum_odhoda,            
            datum_prihoda,           
            vozilo,                  
            vozilo === "car" ? (registerska || traveler.registerska || null) : null,
            vozilo === "car" ? (vin || traveler.vin || null) : null,
            drugo_vozilo || null,            
            prenocisce,      
            placilo_predujema, 
            opombe || null,          
            Number(mesecni) === 1 ? 1 : 0,
            'Pending'                
        );

        saveTravelOrderAttachments(req.files, result.lastInsertRowid);

        res.json({
            success: true,
            message: "Potni nalog je bil uspešno ustvarjen!"
        });
    } catch (error) {
        console.error("Napaka pri shranjevanju:", error);

        res.status(500).json({
            success: false,
            message: "Napaka pri shranjevanju potnega naloga: " + error.message
        });
    }
});


// GET INFO FOR DISPLAYING THE TRAVEL ORDER
app.get("/api/my_travel_orders", requireLogin, async (req, res) => {

    try {

        const userId = req.session.userId;

        // COALESCE -- If sum is NULL (no records), show 0 instead. Used for callculating all expenses for dnevnica, kilometrina and priponke.
        const stmt = db.prepare(
            `
            SELECT 
            potni_nalogi.id,
            potni_nalogi.display_id,
            potni_nalogi.lokacija_odhoda,
            potni_nalogi.lokacija_prihoda,
            potni_nalogi.datum_odhoda,
            potni_nalogi.datum_prihoda,
            potni_nalogi.namen,
            potni_nalogi.vrsta_projekta,
            potni_nalogi.vozilo,
            potni_nalogi.registerska,
            potni_nalogi.vin,
            potni_nalogi.drugo_vozilo,
            potni_nalogi.prenocisce,
            potni_nalogi.placilo_predujema,
            potni_nalogi.opombe,
            potni_nalogi.status,
            potni_nalogi.mesecni,
            o.id AS obracun_id,
            o.skupni_stroski,
            COALESCE((SELECT SUM(od.dnevnica) FROM obracun_dnevnice od WHERE od.obracun_id = o.id), 0) AS dnevnice,
            COALESCE((SELECT SUM(ok.obracun) FROM obracun_kilometrine ok WHERE ok.obracun_id = o.id), 0) AS kilometrina,
            COALESCE((SELECT SUM(orr.znesek) FROM obracun_racuni orr WHERE orr.obracun_id = o.id), 0) AS racuni
            FROM potni_nalogi
            LEFT JOIN obracun o ON o.potni_nalog_id = potni_nalogi.id
            WHERE potni_nalogi.user_id = ?
            `,
            [userId]
        );

        const orders = stmt.all(userId);
    
        res.json(orders)

    } catch (error) {
        console.error("Napaka pri pridobivanju potnih nalogov:", error);

        res.status(500).json({
            error: "Napaka pri dobivanju potnih nalogov..."
        });
    }
});

// GET USER MONTHLY CALCULATIONS
app.get("/api/mesecni_obracuni", requireLogin, (req, res) => {
    try {
        const monthlyCalculations = db.prepare(`
            SELECT id, 
                leto, 
                mesec, 
                skupno_dnevnice, 
                skupno_kilometrina,
                skupno_racuni, 
                skupni_stroski, 
                datum_spremembe
            FROM mesecni_obracuni
            WHERE user_id = ?
            ORDER BY leto DESC, mesec DESC
        `).all(req.session.userId);

        res.json(monthlyCalculations);
    } catch (error) {
        console.error("Napaka pri pridobivanju mesečnih obračunov:", error);
        res.status(500).json({ error: "Napaka pri pridobivanju mesečnih obračunov." });
    }
});

// GET USER MONTHLY CALCULATION DETAILS
app.get("/api/mesecni_obracun/:id", requireLogin, (req, res) => {
    try {
        const monthlyCalculation = db.prepare(`
            SELECT * FROM mesecni_obracuni
            WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!monthlyCalculation) {
            return res.status(404).json({ error: "Mesečni obračun ni bil najden." });
        }

        const rows = db.prepare(`
            SELECT v.potni_nalog_id, v.dnevnice, v.kilometrina, v.racuni,
                   v.skupaj, pn.display_id, pn.datum_odhoda, pn.datum_prihoda,
                   pn.lokacija_prihoda
            FROM mesecni_obracun_vrstice v
            JOIN potni_nalogi pn ON pn.id = v.potni_nalog_id
            WHERE v.mesecni_obracun_id = ?
            ORDER BY pn.datum_odhoda, pn.id
        `).all(monthlyCalculation.id);

        res.json({ monthlyCalculation, rows });
    } catch (error) {
        console.error("Napaka pri pridobivanju mesečnega obračuna:", error);
        res.status(500).json({ error: "Napaka pri pridobivanju mesečnega obračuna." });
    }
});

// SAVE OR UPDATE USER MONTHLY CALCULATION OBRACUN
app.post("/api/mesecni_obracun/save", requireLogin, (req, res) => {
    try {
        // Convert year from request body to number.
        const year = Number(req.body.leto);
        // Convert month from request body to number.
        const month = Number(req.body.mesec);
        // Extract monthly travel order IDs to create billing summary from, remove duplicates and invalid values.  
        const orderIds = [
            // Start: convert to array if needed
            ...(Array.isArray(req.body.potni_nalog_ids)
                ? req.body.potni_nalog_ids           // Already an array? Use it
                : [req.body.potni_nalog_ids])        // Single value? Wrap in array [value]
            // Convert each element to number
            .map(Number)
            // Keep only valid integers
            .filter(Number.isInteger)
        ];

        // Check if year is valid integer and between 2000 and now, and month is valid (1-12).
        if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
            // Return error if validation fails.
            return res.status(400).json({ error: "Izberite veljaven mesec." });
        }

        // Verify at least one travel order was selected.
        if (orderIds.length === 0) {
            return res.status(400).json({ error: "Izberite vsaj en obračun potnega naloga." });
        }


        // Create SQL placeholders for IN clause (e.g., "?, ?, ?" for 3 IDs).
        const placeholders = orderIds.map(() => "?").join(", ");
        // Fetch all daily expense data from the selected monthly travel orders.
        const rows = db.prepare(`
            SELECT pn.id AS potni_nalog_id, o.id AS obracun_id,
                   COALESCE(SUM(od.dnevnica), 0) AS dnevnice,
                   COALESCE((SELECT SUM(ok.obracun) FROM obracun_kilometrine ok WHERE ok.obracun_id = o.id), 0) AS kilometrina,
                   COALESCE((SELECT SUM(orr.znesek) FROM obracun_racuni orr WHERE orr.obracun_id = o.id), 0) AS racuni,
                   o.skupni_stroski AS skupaj
            FROM potni_nalogi pn
            JOIN obracun o ON o.potni_nalog_id = pn.id
            LEFT JOIN obracun_dnevnice od ON od.obracun_id = o.id
            WHERE pn.user_id = ? AND pn.mesecni = 1 AND pn.id IN (${placeholders})
            GROUP BY pn.id, o.id
            ORDER BY pn.datum_odhoda, pn.id
        `).all(req.session.userId, ...orderIds);

        // Verify all requested orders exist and belong to the logged-in user.
        if (rows.length !== orderIds.length) {
            return res.status(400).json({ error: "Nekateri izbrani obračuni niso vaši ali še niso shranjeni." });
        }

        // Execute all database operations as a single transaction.
        const saveMonthlyCalculation = db.transaction(() => {
            // Check if monthly billing for this month already exists.
            let monthlyCalculation = db.prepare(`
                SELECT id FROM mesecni_obracuni
                WHERE user_id = ? AND leto = ? AND mesec = ?
            `).get(req.session.userId, year, month);

            // If updating, delete old daily rows to replace with new data.
            if (monthlyCalculation) {
                db.prepare("DELETE FROM mesecni_obracun_vrstice WHERE mesecni_obracun_id = ?").run(monthlyCalculation.id);
            } else {
                // If creating new, insert monthly billing header record.
                const result = db.prepare(`
                    INSERT INTO mesecni_obracuni (user_id, leto, mesec)
                    VALUES (?, ?, ?)
                `).run(req.session.userId, year, month);
                monthlyCalculation = { id: result.lastInsertRowid };
            }

            // Prepare statement for inserting daily expense rows.
            const insertRow = db.prepare(`
                INSERT INTO mesecni_obracun_vrstice
                    (mesecni_obracun_id, potni_nalog_id, obracun_id, dnevnice, kilometrina, racuni, skupaj)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            // Initialize total accumulators for all expense categories.
            let dailyAllowances = 0;
            let mileage = 0;
            let receipts = 0;
            let total = 0;

            // Insert each daily entry from the travel orders and calculate running totals.
            rows.forEach(row => {
                // Add this day's allowances to running total.
                dailyAllowances += Number(row.dnevnice) || 0;
                // Add this day's mileage cost to running total.
                mileage += Number(row.kilometrina) || 0;
                // Add this day's receipts cost to running total.
                receipts += Number(row.racuni) || 0;
                // Add this day's total expenses to running total.
                total += Number(row.skupaj) || 0;
                // Insert this day's row into database.
                insertRow.run(
                    monthlyCalculation.id, 
                    row.potni_nalog_id, 
                    row.obracun_id,
                    row.dnevnice, 
                    row.kilometrina, 
                    row.racuni, 
                    row.skupaj);
            });

            // Update monthly billing header with calculated totals.
            db.prepare(`
                UPDATE mesecni_obracuni
                SET skupno_dnevnice = ?, skupno_kilometrina = ?, skupno_racuni = ?,
                    skupni_stroski = ?, datum_spremembe = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(dailyAllowances, mileage, receipts, total, monthlyCalculation.id);

            // Return summary of monthly billing for client response.
            return { id: monthlyCalculation.id, dailyAllowances, mileage, receipts, total };
        });

        // Send successful response with monthly billing summary.
        res.json({ success: true, monthlyCalculation: saveMonthlyCalculation() });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju mesečnega obračuna:", error);
        // Send error response to client.
        res.status(500).json({ error: "Napaka pri shranjevanju mesečnega obračuna." });
    }
});


// RETRIEVE TRAVEL ORDER WITH PERMISSION CHECK
// Fetch a travel order and verify the user has permission to access it.
function getTravelOrderForSession(orderId, req) {
    // Query database for travel order by ID.
    const order = db.prepare("SELECT id, user_id FROM potni_nalogi WHERE id = ?").get(orderId);
    // Return null if travel order doesn't exist.
    if (!order) return null;
    // Allow access only if user is admin or owns this travel order.
    if (req.session.role !== "admin" && order.user_id !== req.session.userId) return null;
    // Return the travel order if all checks pass.
    return order;
}

// RETRIEVE FILES ATTACHED TO A TRAVEL ORDER
// Fetch all attachment files for a specific travel order with permission verification.
app.get("/api/travel_order/:orderId/files", requireTravelOrderSession, (req, res) => {
    // Fetch travel order and verify user has permission to access it.
    const order = getTravelOrderForSession(req.params.orderId, req);
    // Return error if travel order doesn't exist or user lacks permission.
    if (!order) return res.status(404).json({ error: "Potni nalog ni bil najden." });

    // Query database for all files attached to this travel order.
    const files = db.prepare(`
        SELECT id, originalno_ime, mime_type, velikost
        FROM potni_nalog_datoteke
        WHERE potni_nalog_id = ?
        ORDER BY id
    `).all(order.id);

    // Return list of files as JSON response.
    res.json(files);
});


// DOWNLOAD OR VIEW A SINGLE FILE FROM TRAVEL ORDER
// Fetch and serve a specific attachment file with proper MIME type and filename.
app.get("/api/travel_order/:orderId/files/:fileId", requireTravelOrderSession, (req, res) => {
    // Fetch travel order and verify user has permission to access it.
    const order = getTravelOrderForSession(req.params.orderId, req);
    // Return error if travel order doesn't exist or user lacks permission.
    if (!order) return res.status(404).send("Potni nalog ni bil najden.");

    // Query database for the specific file and verify it belongs to this travel order.
    const file = db.prepare(`
        SELECT originalno_ime, mime_type, vsebina
        FROM potni_nalog_datoteke
        WHERE id = ? AND potni_nalog_id = ?
    `).get(req.params.fileId, order.id);

    // Return error if file doesn't exist or doesn't belong to this travel order.
    if (!file) return res.status(404).send("Datoteka ni bila najdena.");

    // Set Content-Type header to file's MIME type, default to binary if not specified.
    // This tells the browser what type of file it is (PDF, image, text, etc.).
    res.setHeader("Content-Type", file.mime_type || "application/octet-stream");

    // Set filename for download and instruct browser to display file inline instead of forcing download.
    // Remove all quotes from filename to prevent header injection security vulnerabilities.
    res.setHeader("Content-Disposition", `inline; filename="${file.originalno_ime.replace(/"/g, "")}"`);

    // Send the file content (binary data) to the client for display or download.
    res.send(file.vsebina);

});


// DELETE A FILE FROM TRAVEL ORDER
// Remove a specific attachment file from a travel order with permission verification.
app.delete("/api/travel_order/:orderId/files/:fileId", requireTravelOrderSession, (req, res) => {
    // Fetch travel order and verify user has permission to access it.
    const order = getTravelOrderForSession(req.params.orderId, req);
    // Return error if travel order doesn't exist or user lacks permission.
    if (!order) return res.status(404).json({ error: "Potni nalog ni bil najden." });

    // Delete the file from database, verifying it belongs to this travel order.
    const result = db.prepare(`
        DELETE FROM potni_nalog_datoteke
        WHERE id = ? AND potni_nalog_id = ?
    `).run(req.params.fileId, order.id);

    // Return error if file wasn't found or doesn't belong to this travel order.
    if (result.changes === 0) return res.status(404).json({ error: "Datoteka ni bila najdena." });
    // Send success response to client.
    res.json({ success: true });
});


// UPLOAD FILES TO TRAVEL ORDER
// Add new attachment files to a specific travel order with permission verification.
app.post("/api/travel_order/:orderId/files", requireTravelOrderSession, upload.array("potni_nalog_datoteke", 10), (req, res) => {
    // Fetch travel order and verify user has permission to access it.
    const order = getTravelOrderForSession(req.params.orderId, req);
    // Return error if travel order doesn't exist or user lacks permission.

    if (!order) return res.status(404).json({ success: false, message: "Potni nalog ni bil najden." });

    // Save all uploaded files to database and associate with this travel order.
    saveTravelOrderAttachments(req.files, order.id);
    
    // Send success response to client.
    res.json({ success: true, message: "Priloge so bile uspešno dodane." });
});

// GET ALL USERS TRAVEL ORDERS
app.get("/api/admin/all_travel_orders", requireAdmin, async (req, res) => {

    try {

        const stmt = db.prepare(
            `
            SELECT 
                potni_nalogi.id, 
                potni_nalogi.display_id,
                potni_nalogi.user_id,
                potni_nalogi.lokacija_odhoda,
                potni_nalogi.lokacija_prihoda,
                potni_nalogi.datum_odhoda,
                potni_nalogi.datum_prihoda,
                potni_nalogi.namen, 
                potni_nalogi.vrsta_projekta,
                potni_nalogi.vozilo,
                potni_nalogi.registerska,
                potni_nalogi.vin,
                potni_nalogi.prenocisce,
                potni_nalogi.placilo_predujema,
                potni_nalogi.opombe,
                potni_nalogi.mesecni,
                potni_nalogi.datum_izdaje,
                potni_nalogi.status,
                users.ime,
                users.priimek,
                users.delovno_mesto
            FROM potni_nalogi
            JOIN users ON potni_nalogi.user_id = users.id
            ORDER BY potni_nalogi.datum_odhoda DESC
            `
        );

        const orders = stmt.all();

        res.json(orders)

    } catch (error) {
        console.error("Napaka pri pridobivanju potnih nalogov:", error);

        res.status(500).json({
            error: "Napaka pri dobivanju potnih nalogov..."
        });
    }
});


// DELETE TRAVEL ORDER
app.delete("/api/delete_travel_order/:orderId", requireLogin, async (req, res) => {

    const { orderId } = req.params;
    const userId = req.session.userId;

    try {

        // First check if order exists.
        const order = db.prepare("SELECT * FROM potni_nalogi WHERE id = ? AND user_id = ?")
            .get(orderId, userId);

        if (!order) {
            return res.status(404).json({ 
                error: "Potni nalog ni bil najden" 
            });
        }

        // Delete the order.
        const stmt = db.prepare("DELETE FROM potni_nalogi WHERE id = ? AND user_id = ?");
        const result = stmt.run(orderId, userId);

        res.json({ success: true, message: "Potni nalog je bil izbrisan" });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({ error: error.message });
    }
});


// DELETE TRAVEL ORDER FROM ADMIN
app.delete("/api/admin/delete_travel_order/:orderId", requireAdmin, async (req, res) => {

    const { orderId } = req.params;

    try {
        
        // First check if order exists.
        const order = db.prepare("SELECT * FROM potni_nalogi WHERE id = ?")
            .get(orderId);

        if (!order) {
            return res.status(404).json({ 
                error: "Potni nalog ni bil najden" 
            });
        }

        // Delete the order.
        const result = db.prepare(`
            DELETE FROM potni_nalogi 
            WHERE id = ?
            `).run(orderId);

        res.json({ success: true, message: "Potni nalog je bil izbrisan" });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({ error: error.message });
    }
});


// GET INFO FOR DISPLAYING THE TRAVEL ORDER WE WANT TO EDIT
app.get("/api/edit_travel_order/:orderId", requireLogin, async (req, res) => {

    try {

        const orderId = req.params.orderId;

        const edit_order = db.prepare(`
            SELECT 
                u.*,
                pn.*
            FROM potni_nalogi pn
            JOIN users u ON u.id = pn.user_id
            WHERE pn.id = ? AND pn.user_id = ?
        `).get(orderId, req.session.userId);

            if (!edit_order) {
                return res.status(404).json({
                    success: false,
                    message: "Potni nalog ni bil najden."
                });
            }

            res.json({
                username: edit_order.username,
                ime: edit_order.ime,
                priimek: edit_order.priimek,
                prebivalisce: edit_order.prebivalisce,
                delovno_mesto: edit_order.delovno_mesto,
                registerska: edit_order.registerska,
                vin: edit_order.vin,
                drugo_vozilo: edit_order.drugo_vozilo,
                namen: edit_order.namen,
                vrsta_projekta: edit_order.vrsta_projekta,
                lokacija_odhoda: edit_order.lokacija_odhoda,
                lokacija_prihoda: edit_order.lokacija_prihoda,
                datum_odhoda: edit_order.datum_odhoda,
                datum_prihoda: edit_order.datum_prihoda,
                prenocisce: edit_order.prenocisce,
                placilo_predujema: edit_order.placilo_predujema,
                opombe: edit_order.opombe,
                vozilo: edit_order.vozilo,
                mesecni: edit_order.mesecni,
                display_id: edit_order.display_id
            });

    } catch (error) {
        console.error("Napaka pri pridobivanju podatkov:", error);

        res.status(500).json({
            success: false,
            message: "Napaka pri pridobivanju podatkov."
        });
    }
})


// UPDATE INFO IN DATABASE AND STORE UPDATED TRAVEL ORDER
// Modify an existing travel order with validation and special handling for monthly orders.
app.put("/api/edit_travel_order/:orderId", requireLogin, async (req, res) => {

    try {

        // Extract travel order ID from URL parameters.
        const orderId = req.params.orderId;

        // Destructure all travel order fields from request body.
        let {
            lokacija_odhoda,
            lokacija_prihoda,
            datum_odhoda,
            datum_prihoda,
            namen,
            vrsta_projekta,
            vozilo,
            registerska,
            vin,
            drugo_vozilo,
            prenocisce,
            placilo_predujema,
            opombe
        } = req.body;

        // Fetch existing travel order to check ownership and type.
        const existingOrder = db.prepare(`
            SELECT mesecni, lokacija_odhoda, lokacija_prihoda, datum_odhoda
            FROM potni_nalogi
            WHERE id = ? AND user_id = ?
        `).get(orderId, req.session.userId);

        // Return error if travel order doesn't exist or user doesn't own it.
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: "Potni nalog ni bil najden." });
        }

        // Special handling for monthly travel orders: lock departure/arrival locations and extend arrival to month end.
        if (Number(existingOrder.mesecni) === 1) {

            // Keep original locations unchanged for monthly orders.
            lokacija_odhoda = existingOrder.lokacija_odhoda;
            lokacija_prihoda = existingOrder.lokacija_prihoda;

            // Parse departure date from request.
            const departureDate = new Date(`${String(datum_odhoda).slice(0, 10)}T00:00:00`);

            // Calculate last day of the month.
            const lastDay = new Date(departureDate.getFullYear(), departureDate.getMonth() + 1, 0);

            // Helper function to pad single digits with leading zero.
            const pad = value => String(value).padStart(2, "0");

            // Set arrival date to last day of month at 23:59.
            datum_prihoda = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}T23:59`;
        }

        // Validate all input fields before updating database.
        const validationError = validateTravelOrderInput({
            ...req.body,
            lokacija_odhoda,
            lokacija_prihoda,
            datum_odhoda,
            datum_prihoda
        });
        // Return error if validation fails.
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        // Prepare SQL update statement with all travel order fields.
        const updated_order = db.prepare(`
            UPDATE potni_nalogi 
            SET
                lokacija_odhoda = ?,
                lokacija_prihoda = ?,
                datum_odhoda = ?,
                datum_prihoda = ?,
                namen = ?,
                vrsta_projekta = ?,
                vozilo = ?,
                registerska = ?,
                vin = ?,
                drugo_vozilo = ?,
                prenocisce = ?,
                placilo_predujema = ?,
                opombe = ?,
                datum_izdaje = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? 
            `);

        // Execute update with all provided values, converting empty strings to null.
        updated_order.run(
            lokacija_odhoda,
            lokacija_prihoda,
            datum_odhoda,
            datum_prihoda,
            namen,
            vrsta_projekta,
            vozilo,
            registerska || null,
            vin || null,
            drugo_vozilo || null,
            prenocisce,
            placilo_predujema,
            opombe || null,
            orderId,
            req.session.userId
        );

        // Send success response to client.
        res.json({
            success: true,
            message: "Potni nalog je bil uspešno ustvarjen!"
        });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju:", error);

        // Send error response with error details.
        res.status(500).json({
            success: false,
            message: "Napaka pri shranjevanju potnega naloga: " + error.message
        });
    }
});


// SAVE OBRACUN DATA TO DATABASE 
app.get("/api/dnevnica/:drzavaId", (req, res) => {
    try {
        const { drzavaId } = req.params;

        const result = db.prepare(`
            SELECT
                drzave.id AS drzava_id,
                drzave.naziv,
                drzave.valuta,
                dnevnice.dnevnica14,
                dnevnice.dnevnica8,
                dnevnice.dnevnica6
            FROM dnevnice
            INNER JOIN drzave
                ON dnevnice.drzava_id = drzave.id
            WHERE drzave.id = ?
        `).get(drzavaId);

        if (!result) {
            return res.status(404).json({
                error: "Dnevnica za to državo ni najdena"
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Napaka pri pridobivanju dnevnice:", error);

        res.status(500).json({
            error: "Napaka pri pridobivanju dnevnice"
        });
    }
});



// GET INFO FOR AUTOFILL IN OBRACUN
app.get("/api/obracun_info/:id", requireLogin, (req, res) => {
    const { id } = req.params;

    try {
        const stmt = db.prepare(`
            SELECT 
                id,
                display_id,
                drzava_prihoda_id,
                datum_odhoda,
                datum_prihoda,
                lokacija_odhoda,
                lokacija_prihoda
            FROM potni_nalogi
            WHERE id = ?
        `).get(id)

        if (!stmt) {
            return res.status(404).json({
                error: "Potni nalog ni najden."
            });
        }

        res.json(stmt);

    } catch (error) {
        console.error("Napaka pri pridobivanju podatkov:", error);

        res.status(500).json({
            error: "Napaka na strežniku."
        });
    }
})


// GET MONTHLY CALCULATION DATA FOR ONE USER TRAVEL ORDER
// Fetch a monthly travel order with its mileage entries and attached files for display.
app.get("/api/mesecni_obracun/data/:id", requireLogin, (req, res) => {
    try {
        // Fetch monthly travel order details with associated billing record.
        const order = db.prepare(`
            SELECT pn.id, pn.display_id, pn.datum_odhoda, pn.datum_prihoda,
                   pn.lokacija_odhoda, pn.lokacija_prihoda, pn.mesecni,
                   o.id AS obracun_id, o.skupni_stroski, o.placilo_zaposlenemu
            FROM potni_nalogi pn
            LEFT JOIN obracun o ON o.potni_nalog_id = pn.id
            WHERE pn.id = ? AND pn.user_id = ? AND pn.mesecni = 1
        `).get(req.params.id, req.session.userId);

        // Return error if travel order doesn't exist or user doesn't own it.
        if (!order) return res.status(404).json({ error: "Mesečni potni nalog ni bil najden." });

        // Fetch all mileage entries for this billing record if it exists.
        const kilometrine = order.obracun_id
            ? db.prepare(`
                  SELECT id, datum, lokacija_odhoda AS relacija, kilometri,
                      cena_na_km AS kilometrina, obracun AS znesek
                FROM obracun_kilometrine
                WHERE obracun_id = ?
                ORDER BY datum, id
            `).all(order.obracun_id)
            : [];
        // Fetch all attached files for this billing record if it exists.
        const files = order.obracun_id
            ? db.prepare(`
                SELECT id, originalno_ime, mime_type, velikost
                FROM mesecni_obracun_datoteke
                WHERE obracun_id = ?
                ORDER BY id
            `).all(order.obracun_id)
            : [];

        // Send travel order data, mileage entries, and files to client.
        res.json({ order, kilometrine, files });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri pridobivanju mesečnega obračuna:", error);
        // Send error response to client.
        res.status(500).json({ error: "Napaka pri pridobivanju mesečnega obračuna." });
    }
});


// SAVE MONTHLY MILEAGE CALCULATION
// Create or update mileage entries and attached files for a monthly travel order billing record.
app.post("/api/mesecni_obracun/save/:id", requireLogin, upload.any(), (req, res) => {
    try {
        // Fetch monthly travel order to verify ownership and get basic details.
        const order = db.prepare(`
            SELECT id, lokacija_odhoda, datum_odhoda, datum_prihoda
            FROM potni_nalogi
            WHERE id = ? AND user_id = ? AND mesecni = 1
        `).get(req.params.id, req.session.userId);

        // Return error if travel order doesn't exist or user doesn't own it.
        if (!order) return res.status(404).json({ error: "Mesečni potni nalog ni bil najden." });

        // Check if billing record exists for this travel order.
        let obracun = db.prepare("SELECT id FROM obracun WHERE potni_nalog_id = ?").get(order.id);

        // Create new billing record if it doesn't exist.
        if (!obracun) {
            const result = db.prepare(`
                INSERT INTO obracun (potni_nalog_id, skupni_stroski, placilo_zaposlenemu)
                VALUES (?, 0, 0)
            `).run(order.id);
            obracun = { id: result.lastInsertRowid };
        }

        // Convert form data to arrays, handling both single and multiple values.
        // If user entered one day, wrap it in array; if multiple days, use array as is.
        const dates = Array.isArray(req.body.monthlyDate) ? req.body.monthlyDate : [req.body.monthlyDate];

        // Convert location data to array, using either relation or location field.
        const locations = Array.isArray(req.body.monthlyRelation || req.body.monthlyLocation)
            ? (req.body.monthlyRelation || req.body.monthlyLocation)
            : [req.body.monthlyRelation || req.body.monthlyLocation];

        // Convert kilometers to array for consistent looping.
        const kilometers = Array.isArray(req.body.monthlyKilometers) ? req.body.monthlyKilometers : [req.body.monthlyKilometers];

        // Convert mileage rates to array for consistent looping.
        const rates = Array.isArray(req.body.monthlyRate) ? req.body.monthlyRate : [req.body.monthlyRate];
        
        // Convert calculated amounts to array for consistent looping.
        const amounts = Array.isArray(req.body.monthlyAmount) ? req.body.monthlyAmount : [req.body.monthlyAmount];
        
        // Execute all database operations as a single transaction.
        const saveMonthly = db.transaction(() => {

            // Delete old mileage entries to replace with new data.
            db.prepare("DELETE FROM obracun_kilometrine WHERE obracun_id = ?").run(obracun.id);

            // Prepare statement for inserting new mileage entries.
            const insertMileage = db.prepare(`
                INSERT INTO obracun_kilometrine
                    (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, datum, kilometri, cena_na_km, obracun)
                VALUES (?, 'dan', ?, ?, ?, ?, ?, ?)
            `);

            // Initialize total amount accumulator.
            let total = 0;

            // Process each daily mileage entry.
            dates.forEach((date, index) => {
                // Convert kilometers to number, default to 0 if missing.
                const km = Number(kilometers[index] || 0);
                // Convert rate to number, default to 0.43 if missing.
                const rate = Number(rates[index] || 0.43);
                // Calculate amount or use provided value.
                const amount = Number(amounts[index] || (km * rate));
                // Skip empty rows with no date, location, or kilometers.
                if (!date && !locations[index] && km <= 0) return;

                // Insert mileage entry into database.
                // Run prepared statement with all daily mileage data.
                insertMileage.run(
                    // Billing record ID to associate this mileage entry with.
                    obracun.id,
                    // Departure location from the locations array, use empty string if not provided.
                    locations[index] || "",
                    // Arrival location left empty as it's not used for daily monthly entries.
                    "",
                    // Date of travel, use order's departure date if not provided.
                    date || order.datum_odhoda.slice(0, 10),
                    // Number of kilometers traveled.
                    km,
                    // Rate per kilometer (default 0.43 if not provided).
                    rate,
                    // Total amount calculated for this day.
                    amount
                );
                // Add this entry's amount to running total.
                total += amount;
            });

            // Delete old file attachments to replace with new ones.
            db.prepare("DELETE FROM mesecni_obracun_datoteke WHERE obracun_id = ?").run(obracun.id);

            // Prepare statement for inserting new file attachments.
            const insertFile = db.prepare(`
                INSERT INTO mesecni_obracun_datoteke (obracun_id, originalno_ime, mime_type, velikost, vsebina)
                VALUES (?, ?, ?, ?, ?)
            `);

            // Insert each uploaded file into database.
            (req.files || []).forEach(file => {
                // Skip files without content buffer.
                if (file.buffer) insertFile.run(obracun.id, file.originalname, file.mimetype, file.size, file.buffer);
            });

            // Update billing record with calculated total and timestamps.
            db.prepare(`
                UPDATE obracun
                SET skupni_stroski = ?, placilo_zaposlenemu = ?, datum_spremembe = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(total, total, obracun.id);

            // Return total amount for response.
            return total;
        });

        // Send success response with calculated total rounded to 2 decimal places.
        res.json({ success: true, skupaj: saveMonthly().toFixed(2) });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju mesečnega obračuna:", error);
        // Send error response with error details.
        res.status(500).json({ success: false, error: error.message });
    }
});


// GET ADMIN VIEW OF MONTHLY BILLING SUMMARY
// Fetch complete monthly billing data including employee info for admin review and approval.
app.get("/api/admin/mesecni_obracun/data/:id", requireAdmin, (req, res) => {
    try {
        // Fetch monthly billing record with employee details and expense totals.
        const order = db.prepare(`
            SELECT pn.id, pn.display_id, pn.datum_odhoda, pn.datum_prihoda,
                   pn.lokacija_odhoda, pn.lokacija_prihoda, pn.mesecni,
                   pn.status, pn.namen, pn.placilo_predujema,
                   u.ime, u.priimek, u.prebivalisce, u.delovno_mesto,
                   o.id AS obracun_id, o.skupni_stroski, o.placilo_zaposlenemu
            FROM potni_nalogi pn
            JOIN users u ON u.id = pn.user_id
            LEFT JOIN obracun o ON o.potni_nalog_id = pn.id
            WHERE pn.id = ? AND pn.mesecni = 1
        `).get(req.params.id);

        // Return error if monthly billing doesn't exist.
        if (!order) return res.status(404).json({ error: "Mesečni potni nalog ni bil najden." });

        // Fetch all daily mileage entries for this billing if it exists.
        const rows = order.obracun_id ? db.prepare(`
            SELECT id, datum, lokacija_odhoda AS relacija, kilometri,
                   cena_na_km AS kilometrina, obracun AS znesek
            FROM obracun_kilometrine
            WHERE obracun_id = ?
            ORDER BY datum, id
        `).all(order.obracun_id) : [];

        // Fetch all expense receipt files attached to this billing if it exists.
        const files = order.obracun_id ? db.prepare(`
            SELECT id, originalno_ime, mime_type, velikost
            FROM mesecni_obracun_datoteke
            WHERE obracun_id = ?
            ORDER BY id
        `).all(order.obracun_id) : [];

        // Send complete monthly billing data, daily entries, and files to admin.
        res.json({ order, rows, files });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri pridobivanju admin mesečnega obračuna:", error);
        // Send error response to client.
        res.status(500).json({ error: "Napaka pri pridobivanju mesečnega obračuna." });
    }
});


// DELETE FILE FROM MONTHLY BILLING
// Remove a specific expense receipt file from a monthly billing record with permission verification.
app.delete("/api/mesecni_obracun/:orderId/files/:fileId", requireLogin, (req, res) => {
    // Fetch monthly travel order with billing record ID and verify ownership.
    const order = db.prepare(`
        SELECT pn.id, pn.user_id, o.id AS obracun_id
        FROM potni_nalogi pn
        LEFT JOIN obracun o ON o.potni_nalog_id = pn.id
        WHERE pn.id = ? AND pn.mesecni = 1
    `).get(req.params.orderId);

    // Return error if travel order doesn't exist or user lacks permission (must be admin or owner).
    if (!order || (req.session.role !== "admin" && order.user_id !== req.session.userId)) {
        return res.status(404).json({ error: "Mesečni potni nalog ni bil najden." });
    }

    // Delete the file from database, verifying it belongs to this billing record.
    const result = db.prepare(`
        DELETE FROM mesecni_obracun_datoteke
        WHERE id = ? AND obracun_id = ?
    `).run(req.params.fileId, order.obracun_id);

    // Return error if file wasn't found or doesn't belong to this billing record.
    if (result.changes === 0) return res.status(404).json({ error: "Datoteka ni bila najdena." });

    // Send success response to client.
    res.json({ success: true });
});


// SAVE OR UPDATE MONTHLY BILLING AS ADMIN
// Create or update monthly billing with mileage entries, employee payment, and attached files as admin.
app.post("/api/admin/mesecni_obracun/save/:id", requireAdmin, upload.any(), (req, res) => {
    try {
        // Fetch monthly travel order to verify it exists.
        const order = db.prepare(`
            SELECT id, datum_odhoda
            FROM potni_nalogi
            WHERE id = ? AND mesecni = 1
        `).get(req.params.id);

        // Return error if monthly travel order doesn't exist.
        if (!order) return res.status(404).json({ error: "Mesečni potni nalog ni bil najden." });

        // Helper function to convert single values to arrays for consistent processing.
        const toArray = value => Array.isArray(value) ? value : [value];

        // Convert form data to arrays for processing daily entries.
        const dates = toArray(req.body.monthlyDate);
        const relations = toArray(req.body.monthlyRelation);
        const kilometers = toArray(req.body.monthlyKilometers);
        const rates = toArray(req.body.monthlyRate);

        // Convert employee payment amount to number.
        const employeePayment = Number(req.body.placilo_zaposlenemu);

        // Determine maximum number of rows based on longest array.
        const rowCount = Math.max(dates.length, relations.length, kilometers.length, rates.length);

        // Validate that monthly billing doesn't exceed 31 days.
        if (rowCount > 31) return res.status(400).json({ error: "Mesečni obračun lahko vsebuje največ 31 vrstic." });

        // Initialize array to store validated daily entries.
        const rows = [];

        // Process each row and validate all required fields.
        for (let index = 0; index < rowCount; index += 1) {
            // Extract and trim values from arrays.
            const date = String(dates[index] || "").trim();
            const relation = String(relations[index] || "").trim();
            const kilometersValue = String(kilometers[index] || "").trim();
            const rateValue = String(rates[index] || "").trim();

            // Check if row is completely empty.
            const isEmpty = !date && !relation && !kilometersValue && !rateValue;

            // Skip empty rows.
            if (isEmpty) continue;

            // Convert kilometers and rate to numbers.
            const km = Number(kilometersValue);
            const rate = Number(rateValue);

            // Validate all required fields are present and valid numbers.
            if (!date || !relation || !Number.isFinite(km) || km < 0 || !Number.isFinite(rate) || rate < 0) {
                return res.status(400).json({ error: "Vsaka izpolnjena vrstica mora vsebovati datum, relacijo, kilometre in kilometrino." });
            }

            // Add validated row to array with calculated amount.
            rows.push({ date, relation, kilometers: km, rate, amount: km * rate }); 
        }

        // Calculate total expenses by summing all daily amounts.
        const total = rows.reduce((sum, row) => sum + row.amount, 0);

        // Validate employee payment is valid number and doesn't exceed total.
        if (!Number.isFinite(employeePayment) || employeePayment < 0 || employeePayment > total) {
            return res.status(400).json({ error: "Plačilo zaposlenemu ne sme biti večje od skupnih stroškov." });
        }

        // Check if billing record exists for this travel order.
        let obracun = db.prepare("SELECT id FROM obracun WHERE potni_nalog_id = ?").get(order.id);

        // Execute all database operations as single transaction.
        const saveMonthly = db.transaction(() => {
            // Create new billing record if it doesn't exist.
            if (!obracun) {
                const result = db.prepare(`
                    INSERT INTO obracun (potni_nalog_id, skupni_stroski, placilo_zaposlenemu)
                    VALUES (?, 0, 0)
                `).run(order.id);
                obracun = { id: result.lastInsertRowid };
            }

            // Delete old mileage entries to replace with new data.
            db.prepare("DELETE FROM obracun_kilometrine WHERE obracun_id = ?").run(obracun.id);

            // Prepare statement for inserting new mileage entries.
            const insertMileage = db.prepare(`
                INSERT INTO obracun_kilometrine
                    (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, datum, kilometri, cena_na_km, obracun)
                VALUES (?, 'dan', ?, '', ?, ?, ?, ?)
            `);

            // Insert each validated daily mileage entry into database.
            rows.forEach(row => {
                insertMileage.run(
                    obracun.id, 
                    row.relation, 
                    row.date, 
                    row.kilometers, 
                    row.rate, 
                    row.amount);
            });

            // Delete old file attachments to replace with new ones.
            db.prepare("DELETE FROM mesecni_obracun_datoteke WHERE obracun_id = ?").run(obracun.id);

            // Prepare statement for inserting new file attachments.
            const insertFile = db.prepare(`
                INSERT INTO mesecni_obracun_datoteke
                    (obracun_id, originalno_ime, mime_type, velikost, vsebina)
                VALUES (?, ?, ?, ?, ?)
            `);

            // Insert each uploaded file into database.
            (req.files || []).forEach(file => {
                // Skip files without content buffer.
                if (file.buffer) insertFile.run(obracun.id, file.originalname, file.mimetype, file.size, file.buffer);
            });

            // Update billing record with total expenses and employee payment.
            db.prepare(`
                UPDATE obracun
                SET skupni_stroski = ?, placilo_zaposlenemu = ?, datum_spremembe = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(total, employeePayment, obracun.id);

            // Return total amount for response.
            return total;
        });

        // Send success response with total amount and number of daily entries.
        res.json({ success: true, skupaj: saveMonthly().toFixed(2), rows: rows.length });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju admin mesečnega obračuna:", error);
        // Send error response with error details.
        res.status(500).json({ success: false, error: error.message });
    }
});


// GET ALL OBRACUN DATA
app.get("/api/obracun/:id", requireLogin, (req, res) => {
    try {
        const potni_nalog_id = req.params.id;

        const obracun = db.prepare(`
            SELECT * FROM obracun WHERE potni_nalog_id = ?
        `).get(potni_nalog_id);

        if (!obracun) {
            return res.json({ exists: false });
        }

        // Dnevnices
        const dnevnice = db.prepare(`
            SELECT datum, zagotovljeni_obroki, dnevnica_ure, dnevnica
            FROM obracun_dnevnice 
            WHERE obracun_id = ?
            ORDER BY datum
        `).all(obracun.id);

        // Kilometrina
        const kilometrine = db.prepare(`
            SELECT smer, kilometri, obracun 
            FROM obracun_kilometrine 
            WHERE obracun_id = ?
        `).all(obracun.id);

        // Računi
        const racuni = db.prepare(`
            SELECT id, podjetje, opis_stroska, znesek 
            FROM obracun_racuni 
            WHERE obracun_id = ?
        `).all(obracun.id);

        racuni.forEach(racun => {
            racun.priponke = db.prepare(`
                SELECT id, originalno_ime, mime_type, velikost
                FROM obracun_datoteke
                WHERE racun_id = ?
                ORDER BY id
            `).all(racun.id);
        });

        res.json({
            exists: true,
            obracun: obracun,
            dnevnice: dnevnice,
            kilometrine: kilometrine,
            racuni: racuni
        });

    } catch (error) {
        console.error("Napaka pri pridobivanju obračuna:", error);
        res.status(500).json({ error: error.message });
    }
});


// SAVE OBRACUN DATA TO DATABASE 2
// Create or update billing record with daily allowances, mileage, and receipts for a travel order.
app.post("/api/obracun/save/:id", requireLogin,  upload.any(), (req, res) => {
    try {
        // Extract travel order ID from URL parameters.
        const potni_nalog_id = req.params.id;

        // Extract employee payment amount from request body.
        const placilo_zaposlenemu = req.body.placilo_zaposlenemu;

        // Extract departure and arrival dates from request body.
        const datum_odhoda = req.body.datum_odhoda;
        const datum_prihoda = req.body.datum_prihoda;

        // Use mileage-specific locations if provided, otherwise use general locations.
        let lokacija_odhoda = req.body.lokacija_odhoda_km || req.body.lokacija_odhoda;
        let lokacija_prihoda = req.body.lokacija_prihoda_km || req.body.lokacija_prihoda;

        // If locations not provided, fetch them from the travel order.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            const potniNalog = db.prepare(`
                SELECT lokacija_odhoda, lokacija_prihoda 
                FROM potni_nalogi 
                WHERE id = ?
            `).get(potni_nalog_id);

            // Use travel order locations as fallback.
            if (potniNalog) {
                lokacija_odhoda = lokacija_odhoda || potniNalog.lokacija_odhoda;
                lokacija_prihoda = lokacija_prihoda || potniNalog.lokacija_prihoda;
            }
        }

        // Return error if departure or arrival location is missing.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            return res.status(400).json({
                success: false,
                error: "Lokacija odhoda in prihoda so obvezne!"
            });
        }

        // STEP 1: Check if billing record exists, create if not.
        let obracun = db.prepare(`
            SELECT id FROM obracun WHERE potni_nalog_id = ?
        `).get(potni_nalog_id);

        let obracun_id;

        // Create new billing record if it doesn't exist.
        if (!obracun) {
            db.prepare(`
                INSERT INTO obracun (potni_nalog_id, skupni_stroski, placilo_zaposlenemu)
                VALUES (?, ?, ?)
            `).run(potni_nalog_id, 0, 0);

            // Fetch the newly created billing record.
            obracun = db.prepare(`
                SELECT id FROM obracun WHERE potni_nalog_id = ?
            `).get(potni_nalog_id);
        }

        // Store billing record ID for use throughout function.
        obracun_id = obracun.id;

        // STEP 2: Save daily allowances.
        // Convert form data to arrays for consistent processing.
        const travelDates = Array.isArray(req.body.travelDate) ? req.body.travelDate : [req.body.travelDate];
        const providedMeals = Array.isArray(req.body.providedMeals) ? req.body.providedMeals : [req.body.providedMeals];
        const dailyAllowances = Array.isArray(req.body.dailyAllowance) ? req.body.dailyAllowance : [req.body.dailyAllowance];
        const dailyAllowanceHours = Array.isArray(req.body.dnevnicaUre) ? req.body.dnevnicaUre : [req.body.dnevnicaUre];

        // Initialize total daily allowances accumulator.
        let skupnoDnevnice = 0;

        // Delete old daily allowance entries.
        db.prepare(`DELETE FROM obracun_dnevnice WHERE obracun_id = ?`).run(obracun_id);

        // Insert new daily allowance entries for each travel date.
        travelDates.forEach((date, index) => {

            // Convert daily allowance to number.
            const dnevnica = parseFloat(dailyAllowances[index] || 0);

            // Get provided meals information.
            const obroki = providedMeals[index] || '';

            // Validate hours are one of allowed values (6, 8, 14), default to 14.
            const ure = ["6", "8", "14"].includes(String(dailyAllowanceHours[index]))
                ? Number(dailyAllowanceHours[index])
                : 14;

            // Add this day's allowance to running total.
            skupnoDnevnice += dnevnica;

            // Insert daily allowance entry into database.
            db.prepare(`
                INSERT INTO obracun_dnevnice (obracun_id, datum, zagotovljeni_obroki, dnevnica_ure, dnevnica)
                VALUES (?, ?, ?, ?, ?)
            `).run(obracun_id, date, obroki, ure, dnevnica);
        });

        // STEP 3: Save mileage reimbursement.
        // Convert mileage values to numbers.
        const kilometri_naprej = parseFloat(req.body.kilometri_naprej || 0);
        const kilometri_nazaj = parseFloat(req.body.kilometri_nazaj || 0);
        const obracun_kilometrine_naprej = parseFloat(req.body.obracun_kilometrine_naprej || 0);
        const obracun_kilometrine_nazaj = parseFloat(req.body.obracun_kilometrine_nazaj || 0);

        // Calculate total mileage reimbursement.
        let skupnoKilometrina = obracun_kilometrine_naprej + obracun_kilometrine_nazaj;

        // Delete old mileage entries.
        db.prepare(`DELETE FROM obracun_kilometrine WHERE obracun_id = ?`).run(obracun_id);

        // Insert outbound trip mileage if kilometers exist.
        if (kilometri_naprej > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'naprej',
                lokacija_odhoda,
                lokacija_prihoda,
                kilometri_naprej,
                0.43,
                obracun_kilometrine_naprej
            );
        }

        // Insert return trip mileage if kilometers exist.
        if (kilometri_nazaj > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'nazaj',
                lokacija_prihoda,
                lokacija_odhoda,
                kilometri_nazaj,
                0.43,
                obracun_kilometrine_nazaj
            );
        }

        // STEP 4: Save receipts and attachments.
        // Convert receipt data to arrays for consistent processing.
        const racuniPodjetja = Array.isArray(req.body.racun_podjetje) ? req.body.racun_podjetje : [req.body.racun_podjetje];
        const opisStroska = Array.isArray(req.body.opis_stroska) ? req.body.opis_stroska : [req.body.opis_stroska];
        const racuniZneski = Array.isArray(req.body.znesek_racuna) ? req.body.znesek_racuna : [req.body.znesek_racuna];

        // Initialize receipt total accumulator and receipt ID storage.
        let skupnoRacuni = 0;
        const receiptIds = [];
        // Capture existing receipt attachments before deleting old receipts.
        const previousAttachments = captureReceiptAttachments(obracun_id);

        // Delete old receipt entries.
        db.prepare(`DELETE FROM obracun_racuni WHERE obracun_id = ?`).run(obracun_id);

        // Insert new receipt entries for each receipt amount.
        racuniZneski.forEach((znesek, index) => {

            // Only insert if receipt has a valid positive amount.
            if (znesek && parseFloat(znesek) > 0) {

                // Convert receipt amount to number.
                const amount = parseFloat(znesek);

                // Add this receipt to running total.
                skupnoRacuni += amount;

                // Insert receipt into database and store its new ID.
                const receiptResult = db.prepare(`
                    INSERT INTO obracun_racuni (obracun_id, podjetje, opis_stroska, znesek)
                    VALUES (?, ?, ?, ?)
                `).run(
                    obracun_id,
                    racuniPodjetja[index] || '',
                    opisStroska[index] || '',
                    amount
                );
                receiptIds[index] = receiptResult.lastInsertRowid;
            }
        });

        // Save new receipt file attachments to the database.
        saveReceiptAttachments(req.files, receiptIds);
        // Restore previous attachments with new receipt IDs for updated receipts.
        restoreReceiptAttachments(previousAttachments, receiptIds);

        // STEP 5: Calculate total expenses.
        const skupni_stroski = skupnoDnevnice + skupnoKilometrina + skupnoRacuni;

        // STEP 6: Update billing record with totals and timestamps.
        db.prepare(`
            UPDATE obracun 
            SET 
                skupni_stroski = ?,
                placilo_zaposlenemu = ?,
                datum_spremembe = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(skupni_stroski, placilo_zaposlenemu, obracun_id);

        // Send success response with billing summary.
        res.json({
            success: true,
            obracun_id: obracun_id,
            povzetek: {
                dnevnice: skupnoDnevnice.toFixed(2),
                kilometrina: skupnoKilometrina.toFixed(2),
                racuni: skupnoRacuni.toFixed(2),
                skupaj: skupni_stroski.toFixed(2)
            }
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju obračuna:", error);
        // Send error response with error details.
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET INFO FOR DISPLAYING THE TRAVEL ORDER WE WANT TO EDIT IN ADMIN PAGE
app.get("/api/admin/edit_travel_order/:orderId", requireAdmin, async (req, res) => {

    try {

        const orderId = req.params.orderId;

        const stmt = db.prepare(`
            SELECT 
                potni_nalogi.*,
                users.ime,
                users.priimek,
                users.delovno_mesto,
                users.prebivalisce
            FROM potni_nalogi
            JOIN users ON potni_nalogi.user_id = users.id
            WHERE potni_nalogi.id = ?
        `);

            const order = stmt.get(orderId);

        if (!order) {
            return res.status(404).json({ error: "Potni nalog ni bil najden." });
        }

        res.json(order);

    } catch (error) {
        console.error("Napaka:", error);
        res.status(500).json({ error: "Napaka " });
    }
});


// UPDATING THE DATA IN TRAVEL FORM BUT FOR ADMIN
app.put("/api/admin/edit_travel_order/:id", requireAdmin, async (req, res) => {

    try {

        const orderId = req.params.id;
        const {
            namen, 
            vrsta_projekta, 
            lokacija_odhoda, 
            lokacija_prihoda, 
            datum_odhoda, 
            datum_prihoda, 
            registerska, 
            vin, 
            prenocisce, 
            placilo_predujema, 
            opombe,
            datum_izdaje,
            status 
        } = req.body;
        const vozilo = req.body.vozilo ?? req.body.vehicle;
        const drugo_vozilo = req.body.drugo_vozilo ?? req.body.other_vehicle;

        // Spread operator: combine request body with potentially modified vehicle fields.
        // This validates all travel order input data before saving to database.
        const validationError = validateTravelOrderInput({ ...req.body, vozilo, drugo_vozilo });

        // Return error response if any validation checks fail.
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        if (!vozilo) {
            return res.status(400).json({
                success: false,
                error: "Prevozno sredstvo je obvezno."
            });
        }

        const stmt = db.prepare(`
            UPDATE potni_nalogi
            SET               
                lokacija_odhoda = ?,
                lokacija_prihoda = ?,
                datum_odhoda = ?,
                datum_prihoda = ?,
                namen = ?,
                vrsta_projekta = ?,
                vozilo = ?,
                registerska = ?,
                vin = ?,
                drugo_vozilo = ?,
                prenocisce = ?,
                placilo_predujema = ?,
                opombe = ?,
                datum_izdaje = ?,
                status = ?   
            WHERE id = ?
        `);

        stmt.run(          
            lokacija_odhoda, 
            lokacija_prihoda, 
            datum_odhoda, 
            datum_prihoda,
            namen, 
            vrsta_projekta, 
            vozilo, 
            vozilo === "car" ? (registerska || null) : null,
            vozilo === "car" ? (vin || null) : null,
            drugo_vozilo,
            prenocisce, 
            placilo_predujema, 
            opombe, 
            datum_izdaje,
            status,
            orderId
        );

        res.json({ success: true, message: "Potni nalog je bil uspešno posodobljen!" });

    } catch (error) {
        console.error("Napaka:", error);
        res.status(500).json({ success: false, error: "Napaka pri ažuriranju" });
    }
});


// CHANGE STATUS FROM PENDING OR DISAPPROVED TO APPROVED 
app.post("/api/admin/all_travel_orders/:id/approve", requireAdmin, async (req, res) => {

    const { id } = req.params;

    try {

        const order = db.prepare(`
            SELECT *
            FROM potni_nalogi
            WHERE id = ?
        `).get(id);

        if (!order) {
            return res.status(404).json({
                error: "Travel order not found..."
            });
        }

        if (order.status !== "Pending" && order.status !== "Disapproved") {
            return res.status(400).json({
                error: "Travel order status is not pending or disapproved"
            });
        }

        db.prepare(`
            UPDATE potni_nalogi
            SET status = ?
            WHERE id = ?
        `).run("Approved", id);

        return res.json({
            message: "Travel order approved",
            status: "Approved"
        });

    } catch (error) {
        console.error("Approve error:", error);

        return res.status(500).json({
            error: "Server error..."
        });
    }
});


// CHANGE STATUS FROM PENDING OR APPROVED OR ACTIVE TO DISAPPROVED
app.post("/api/admin/all_travel_orders/:id/disapprove", requireAdmin, async (req, res) => {

    const { id } = req.params;

    try {

        const orders = db.prepare(`
            SELECT *
            FROM potni_nalogi
            WHERE id = ?
        `).all(id);

        if (orders.length === 0) {
            return res.status(404).json({
                error: "Travel order not found..."
            });
        }

        const order = orders[0];

        // Allow both pending and approved orders to be disapproved
        if (order.status !== "Pending" && order.status !== "Approved" && order.status !== "Active") {
            return res.status(400).json({
                error: "Travel order status cannot be disapproved"
            });
        }

        db.prepare(`
            UPDATE potni_nalogi
            SET status = ?
            WHERE id = ?
        `).run("Disapproved", id);

        res.json({
            message: "Travel order disapproved",
            id: id,
            status: "Disapproved"
        });

    } catch (error) {
        console.error("Disapprove Error", error);

        res.status(500).json({
            error: "Server error..."
        });
    }
});


// EXTRACT ALL TEXT FROM AN XML ELEMENT AND ITS CHILDREN
// Go through an XML element and collect all the text inside it, including nested text.
function templateText(element) {
    // Stop if the element is empty or doesn't have any children inside.
    if (!element || !element.elements) return "";

    // Go through each child element one by one.
    return element.elements

        // For each child: if it's just text, take the text; if it's another element, call this function again to get its text.
        .map(child => child.type === "text" ? child.text : templateText(child))

        // Combine all the text pieces together into one string with nothing between them.
        .join("");
}


// CREATE AN XML ELEMENT OBJECT
// Build a structured object that represents an XML element with name, children, and optional attributes.
function templateElement(name, elements = [], attributes) {

    // Create a new object with element type, name, and list of child elements.
    const element = { type: "element", name, elements };

    // If attributes were provided, add them to the element object.
    if (attributes) element.attributes = attributes;

    // Return the completed element object.
    return element;
}


// CREATE A WORD DOCUMENT TEXT ELEMENT
// Build an XML element for displaying text in a Word document with proper formatting.
function templateTextElement(value) {
    
    // Create a word text element ("w:t") with the provided text value.
    return templateElement("w:t", [

        // Add the actual text content as a child, converting value to string (empty if null/undefined).
        { type: "text", text: String(value ?? "") }
    ], { "xml:space": "preserve" });
}


// CLONE XML ELEMENT OBJECT DEEPLY
// Create a complete independent copy of an XML element object, without changing the original.
function cloneTemplateElement(element) {
    // If element exists, serialize to JSON string then parse back to create deep clone; otherwise return undefined.
    return element ? JSON.parse(JSON.stringify(element)) : undefined;
}


// FIND FIRST TEXT RUN PROPERTIES IN WORD DOCUMENT ELEMENT
// Recursively search for the first text run and return its formatting properties.
function firstTextRunProperties(container) {

    // Return undefined if container is empty or has no child elements.
    if (!container?.elements) return undefined;

    // Loop through each child element in the container.
    for (const child of container.elements) {

        // Check if this child is a text run ("w:r") containing actual text ("w:t").
        if (child.name === "w:r" && child.elements?.some(element => element.name === "w:t")) {

            // Find and return a deep clone of the text run properties ("w:rPr") if it exists.
            return cloneTemplateElement(child.elements.find(element => element.name === "w:rPr"));
        }

        // Recursively search deeper in nested elements if this isn't a text run.
        const nested = firstTextRunProperties(child);

        // If properties found in nested elements, return them immediately.
        if (nested) return nested;
    }

    // Return undefined if no text run properties found anywhere.
    return undefined;
}


// CHECK IF TEXT RUN CONTAINS IMAGES OR SHAPES
// Search text run for embedded drawings, pictures, or objects.
function runHasDrawing(run) {

    // Convert entire run object to JSON string for searching.
    const raw = JSON.stringify(run);

    // Return true if string contains any drawing, picture, or object tags.
    return raw.includes("\"w:drawing\"") || raw.includes("\"w:pict\"") || raw.includes("\"w:object\"");
}


// CREATE A FORMATTED TEXT RUN FOR WORD DOCUMENT
// Build a text run element with optional formatting properties applied.
function templateRun(value, properties) {

    // Initialize empty array to hold run child elements.
    const elements = [];

    // If formatting properties provided, add a clone of them first.
    if (properties) elements.push(cloneTemplateElement(properties));

    // Add the actual text content as a child element.
    elements.push(templateTextElement(value));

    // Return completed text run element with name "w:r".
    return templateElement("w:r", elements);
}


// NORMALIZE TEMPLATE TEXT BY CORRECTING COMMON SPELLING AND FORMATTING MISTAKES
// Recursively search through document elements and fix known text errors and typos.
function normalizeTemplateText(element) {

    // Return early if element is empty or has no child elements.
    if (!element?.elements) return;

    // Define mapping of incorrect text to corrected text.
    const corrections = {
        "Datumodhoda": "Datum odhoda",
        "Datumprihoda": "Datum prihoda",
        "Zagotovljeniobroki": "Zagotovljeni obroki",
        "Obračunkilometrine": "Obračun kilometrine",
        "Začetnalokacija": "Začetna lokacija",
        "Končnalokacija": "Končna lokacija",
        "Obračun/znesek": "Obračun / znesek",
        "Priloženiračuni": "Priloženi računi",
        "Opisstroška": "Opis stroška",
        "potnikzaposlen": "potnik zaposlen",
        "Po nalogu:DIREKTORJA": "Po nalogu: DIREKTORJA",
        "Številkapotneganaloga": "Številka potnega naloga",
        "Imeinpriimekzaposlenega": "Ime in priimek zaposlenega",
        "SKUPAJVSISTROŠKI": "SKUPAJ VSI STROŠKI",
        "Zaizplačilozaposlenemu": "Za izplačilo zaposlenemu",
        "CelotnaSlovenija": "Celotna Slovenija",
        "Datum, uraodhoda": "Datum, ura odhoda",
        "Datum, uraprihoda": "Datum, ura prihoda",
        "z svojo osebno": "s svojo osebno",
        "vsem dokazili": "vsemi dokazili",
        "Business trip approval for": "Business trip approval for",
        "Departure Dare": "Departure Date",
        "Adress": "Address",
        "Amount Payable toEmployee": "Amount Payable to Employee",
        "Daily Allowance Calculation": "Daily Allowance Calculation",
        "Provided Meals": "Provided Meals",
        "Starting location": "Starting Location",
        "Destination location": "Destination Location",
        "No. of kilometers": "No. of Kilometers",
        "Calculation/Amount": "Calculation / Amount",
        "Attached Invoices": "Attached Invoices",
        "MERGEFIELD DM ": ""
    };

    // Loop through each child element in the container.
    element.elements.forEach(child => {

        // If child is a text node, correct all known misspellings in it.
        if (child.type === "text") {

            // Loop through each correction pair (wrong text, correct text).
            Object.entries(corrections).forEach(([wrong, correct]) => {

                // Replace all occurrences of wrong text with correct text.
                child.text = child.text.replaceAll(wrong, correct);
            });
        } else {
            // If child is an element (not text), recurse deeper to fix nested text.
            normalizeTemplateText(child);
        }
    });
}


// ESCAPE SPECIAL REGEX CHARACTERS IN TEMPLATE TOKEN
// Convert template token to string and escape special characters for safe regex use.
function escapeTemplateToken(token) {

    // Convert token to string and replace all regex special characters with escaped versions.
    return String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// NORMALIZE TEMPLATE PARAGRAPH TEXT BY CORRECTING LABELS AND SPACING
// Recursively search through paragraphs and fix common formatting and spelling issues while preserving field markers.
function normalizeTemplateParagraphs(element) {

    // Return early if element is empty or has no child elements.
    if (!element?.elements) return;

    // Loop through each child element in the container.
    element.elements.forEach(child => {

        // Check if this child is a paragraph element.
        if (child.name === "w:p") {

            // Extract all text content from the paragraph.
            const rawText = templateText(child);

            // Remove all whitespace and colons to create compact version for pattern matching.
            const compactText = rawText.replace(/[\s:]+/g, "");

            // Define mapping of incorrectly formatted text to corrected text with proper spacing and colons.
            const corrections = {
                "Začetna-končnalokacija": "Začetna-končna lokacija",
                "Datum,uraodhoda": "Datum, ura odhoda:",
                "Datum,uraprihoda": "Datum, ura prihoda:",
                Datumodhoda: "Datum odhoda:",
                Datumprihoda: "Datum prihoda:",
                Zagotovljeniobroki: "Zagotovljeni obroki:",
                Obračunkilometrine: "Obračun kilometrine:",
                Začetnalokacija: "Začetna lokacija:",
                Končnalokacija: "Končna lokacija:",
                Priloženiračuni: "Priloženi računi:",
                Opisstroška: "Opis stroška:",
                ImePriimekzaposlenega: "Ime Priimek zaposlenega:",
                Imeinpriimekzaposlenega: "Ime in priimek zaposlenega:",
                Imeinpriimekzaposleni: "Ime in priimek zaposleni:",
                SKUPAJVSISTROŠKI: "SKUPAJ VSI STROŠKI:",
                Zaizplačilozaposlenemu: "Za izplačilo zaposlenemu:"
            };

            // Find the first correction that matches the compact text.
            const correction = Object.entries(corrections)
                .find(([wrong]) => compactText.includes(wrong));

            // If a matching correction found, update paragraph with corrected text and field markers.
            if (correction) {

                // Extract all field markers (text between « and ») to preserve them.
                const fieldMarkers = [...rawText.matchAll(/«([^»]+)»/g)]
                    .map(match => `«${match[1]}»`);

                // Set paragraph text to corrected label followed by preserved field markers, separated by spaces.
                setTemplateParagraphText(child, [correction[1], ...fieldMarkers].join(" "));
            }
        } else {
            // If child is not a paragraph, recurse deeper to check nested elements.
            normalizeTemplateParagraphs(child);
        }
    });
}


// FIND FIRST PARAGRAPH MATCHING A CONDITION
// Recursively search through document elements and return the first paragraph that matches the predicate function.
function findTemplateParagraphDeep(element, predicate) {

    // Return undefined if element is empty or has no child elements.
    if (!element?.elements) return undefined;

    // Loop through each child element in the container.
    for (const child of element.elements) {

        // Check if this child is a paragraph and matches the predicate condition.
        if (child.name === "w:p" && predicate(child)) return child;

        // Recursively search deeper in nested elements for matching paragraph.
        const found = findTemplateParagraphDeep(child, predicate);

        // If matching paragraph found in nested elements, return it immediately.
        if (found) return found;
    }

    // Return undefined if no matching paragraph found anywhere.
    return undefined;
}


// REMOVE TEMPLATE FIELD MARKERS AND CODES FROM DOCUMENT
// Recursively strip out field codes, merge fields, and field markers while preserving document structure.
function removeTemplateMarkers(element) {

    // Return early if element is empty or has no child elements.
    if (!element?.elements) return;

    // Filter child elements, removing some and cleaning others.
    element.elements = element.elements.filter(child => {

        // Check if this child is a text run.
        if (child.name === "w:r") {

            // Get all pieces/children of this text run.
            const pieces = child.elements || [];

            // Check if run contains field code markers (instrText or fldChar).
            const hasFieldCode = pieces.some(item => item.name === "w:instrText" || item.name === "w:fldChar");

            // Check if run contains actual visible text.
            const hasVisibleText = pieces.some(item => item.name === "w:t");

            // Remove this run entirely if it has field code but no visible text and no images.
            if (hasFieldCode && !hasVisibleText && !runHasDrawing(child)) return false;

            // If run has field code, remove the field code markers but keep visible text.
            if (hasFieldCode) {
                child.elements = pieces.filter(item => item.name !== "w:instrText" && item.name !== "w:fldChar");
            }
        }

        // If this child is text, clean up template markers within the text.
        if (child.type === "text") {

            // Remove MERGEFIELD commands (e.g., "MERGEFIELD UserName").
            child.text = String(child.text || "")
                .replace(/MERGEFIELD\s+\S+/g, "")

                // Remove field markers (e.g., «UserName»).
                .replace(/«[^»]*»/g, "")

                // Replace multiple consecutive spaces with single space.
                .replace(/ {2,}/g, " ");
        } else {
            // If child is an element (not text), recurse deeper to clean nested elements.
            removeTemplateMarkers(child);
        }

        // Keep this element in the document.
        return true;
    });
}


// SET PARAGRAPH TEXT WITH OPTIONAL FORMATTING AND IMAGE PRESERVATION
// Replace paragraph content with new text while preserving formatting properties and embedded images.
function setTemplateParagraphText(paragraph, value, preserveDrawings = true) {

    // Extract paragraph formatting properties (indentation, alignment, spacing, etc.).
    const properties = (paragraph.elements || []).filter(element => element.name === "w:pPr");

    // Extract text runs that contain images/drawings if preservation is enabled.
    const drawings = preserveDrawings
        ? (paragraph.elements || []).filter(element => element.name === "w:r" && runHasDrawing(element))
        : [];

    // Replace paragraph elements with: properties, drawings, and new formatted text run.
    paragraph.elements = [...properties, ...drawings, templateRun(value, firstTextRunProperties(paragraph))];
}


// APPEND TEXT TO END OF PARAGRAPH
// Add new formatted text to the end of an existing paragraph without replacing content.
function appendTemplateParagraphText(paragraph, value) {

    // Ensure paragraph has an elements array.
    paragraph.elements = paragraph.elements || [];

    // Add new text run to the end of paragraph elements.
    paragraph.elements.push(templateRun(value));
}


// FIND PARAGRAPH CONTAINING SPECIFIC TEXT
// Search for first paragraph in document body that contains the target text, ignoring field markers and whitespace.
function findTemplateParagraph(body, text) {

    // Helper function to normalize text for comparison by removing template elements.
    const searchableText = value => String(value || "")

        // Remove MERGEFIELD commands (e.g., "MERGEFIELD UserName").
        .replace(/MERGEFIELD\s+\S+/g, "")

        // Remove field markers (e.g., «UserName»).
        .replace(/«[^»]*»/g, "")

        // Remove underscores and multiple spaces for flexible matching.
        .replace(/[_\s]+/g, "");

    // Normalize the target text for comparison.
    const searchableTarget = searchableText(text);

    // Find first paragraph containing the normalized target text.
    return body.elements.find(element =>
        element.name === "w:p" && searchableText(templateText(element)).includes(searchableTarget)
    );
}


// CENTER ALL TEXT IN TABLE CELL
// Set text alignment to center for all paragraphs within a table cell.
function centerTemplateCell(cell) {

    // Extract all paragraph elements from the cell.
    const paragraphs = (cell.elements || []).filter(element => element.name === "w:p");

    // Loop through each paragraph and apply center alignment.
    paragraphs.forEach(paragraph => {

        // Find existing paragraph properties element.
        let properties = paragraph.elements?.find(element => element.name === "w:pPr");

        // If no properties element exists, create one and add it to the beginning.
        if (!properties) {
            properties = templateElement("w:pPr");
            paragraph.elements = paragraph.elements || [];

            // Insert properties at the start of the paragraph elements.
            paragraph.elements.unshift(properties);
        }

        // Remove any existing alignment settings (w:jc) to avoid conflicts.
        properties.elements = (properties.elements || [])
            .filter(element => element.name !== "w:jc");
             
        // Add center alignment property to the paragraph properties.
        properties.elements.push(templateElement("w:jc", [], { "w:val": "center" }));
    });
}


// REPLACE ALL TEXT IN TABLE CELL
// Remove all paragraphs from cell and insert new paragraph with provided text.
function replaceTemplateCellText(cell, value) {

    // Return early if cell is empty or undefined.
    if (!cell) return;

    // Remove all existing paragraphs from the cell.
    cell.elements = (cell.elements || []).filter(element => element.name !== "w:p");
    
    // Add new paragraph containing the value as a text run.
    cell.elements.push(templateElement("w:p", [templateRun(value)]));
}


// CLEAR ALL TEXT FROM EVERY CELL IN A TABLE ROW
// Replace text in all cells of a row with empty strings.
function clearRowCellText(row) {

    // Get all cells from the row and replace each with empty text.
    templateCells(row).forEach(cell => replaceTemplateCellText(cell, ""));
}


// FILTER DATA ROWS FROM TABLE
// Extract rows between header and end index that have the correct number of cells.
function calculationDataRows(rows, headerIndex, endIndex, cellCount) {

    // Slice rows starting after the header (skip 2 rows), filter by cell count, and return valid data rows.
    return rows.slice(headerIndex + 2, endIndex).filter(row => templateCells(row).length === cellCount);
}


// EXPAND TABLE DATA ROWS TO MATCH NEEDED COUNT
// Duplicate and insert empty rows into table until reaching the required number of data rows.
function expandTemplateDataRows(table, dataRows, neededCount, beforeRow) {

    // Return early if no data rows exist, beforeRow not found, or already have enough rows.
    if (!dataRows.length || !beforeRow || neededCount <= dataRows.length) return dataRows;

    // Use the last data row as template for new rows to copy formatting.
    const templateRow = dataRows[dataRows.length - 1];

    // Keep duplicating rows until we reach the needed count.
    while (dataRows.length < neededCount) {

        // Create a deep clone of the template row with all formatting preserved.
        const newRow = cloneTemplateRow(templateRow);

        // Clear all text from cells in the new row so it's ready for data.
        clearRowCellText(newRow);

        // Find the index position of the beforeRow in the table.
        const insertAt = table.elements.indexOf(beforeRow);

        // Break if beforeRow not found in table.
        if (insertAt < 0) break;

        // Insert the new empty row before the beforeRow at the correct position.
        table.elements.splice(insertAt, 0, newRow);

        // Add the new row to our data rows array for tracking.
        dataRows.push(newRow);
    }

    // Return the expanded array of data rows.
    return dataRows;
}


// PARSE DATE FROM VARIOUS FORMATS
// Convert different date formats (string, Date object, ISO) into standardized Date object.
function parseTemplateDate(value) {

    // Return null if value is empty, null, or undefined.
    if (!value) return null;

    // If value is already a Date object, validate it and return (or null if invalid).
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    // Convert value to string and trim whitespace.
    const text = String(value).trim();

    // Check if text matches simple date format: YYYY-MM-DD (e.g., "2026-09-24").
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {

        // Split date into components and convert to numbers.
        const [year, month, day] = text.split("-").map(Number);

        // Create and return Date object (month is 0-indexed so subtract 1).
        return new Date(year, month - 1, day);
    }

    // Check if text matches date-time format: YYYY-MM-DD HH:MM:SS (e.g., "2026-09-24 14:30:45").
    const localDateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);

    // Verify this is local time (not UTC/timezone indicated by Z or ±HH:MM).
    if (localDateTime && !/Z|[+-]\d{2}:\d{2}$/.test(text)) {

        // Create and return Date object with all components.
        return new Date(
            Number(localDateTime[1]),                    // year
            Number(localDateTime[2]) - 1,               // month (0-indexed)
            Number(localDateTime[3]),                   // day
            Number(localDateTime[4]),                   // hours
            Number(localDateTime[5]),                   // minutes
            Number(localDateTime[6] || 0)              // seconds (default 0)
        );
    }

    // Attempt to parse as generic date string (ISO format, etc.).
    const parsed = new Date(text);return Number.isNaN(parsed.getTime()) ? null : parsed;
}


// FORMAT DATE FOR DISPLAY IN DOCUMENT
// Convert date to formatted string in Slovenian locale, optionally including time.
function templateDate(value, withTime = false) {

    // Parse the input value into a Date object.
    const parsed = parseTemplateDate(value);

    // Return empty string if date parsing failed or value was invalid.
    if (!parsed) return "";

    // If withTime is true, format with date and time; otherwise format date only.
    return withTime
        ? parsed.toLocaleString("sl-SI")      // Format: "24. 9. 2026, 14:30:45"
        : parsed.toLocaleDateString("sl-SI"); // Format: "24. 9. 2026"
}


// FORMAT DATE FOR USE IN FILENAME
// Convert date to ISO format string (YYYY-MM-DD) suitable for filenames.
function textDateForFile(value) {

    // Parse the input value into a Date object.
    const parsed = parseTemplateDate(value);

    // Return default text if date parsing failed or value was invalid.
    if (!parsed) return "datum";

    // Extract year from date.
    const year = parsed.getFullYear();

    // Extract month (add 1 because getMonth is 0-indexed) and pad with leading zero.
    const month = String(parsed.getMonth() + 1).padStart(2, "0");

    // Extract day and pad with leading zero.

    const day = String(parsed.getDate()).padStart(2, "0");

    // Return formatted date string suitable for filenames.
    return `${year}-${month}-${day}`;
}


// APPEND PARAGRAPH WITH TEXT TO TABLE CELL
// Add a new paragraph containing text to the end of a cell.
function appendTemplateCellText(cell, value) {

    // Ensure cell has an elements array.
    cell.elements = cell.elements || [];

    // Add new paragraph with text run to the cell.
    cell.elements.push(templateElement("w:p", [templateRun(value)]));
}


// GET ALL TABLE ROWS
// Extract and return all row elements from a table.
function templateRows(table) {
    return (table.elements || []).filter(element => element.name === "w:tr");
}


// GET ALL CELLS IN TABLE ROW
// Extract and return all cell elements from a row.
function templateCells(row) {
    return (row.elements || []).filter(element => element.name === "w:tc");
}


// GET ROW TEXT WITHOUT WHITESPACE
// Extract all text from row and remove spaces for comparison purposes.
function rowText(row) {
    return templateText(row).replace(/\s+/g, "");
}


// FIND ROW INDEX BY TEXT CONTENT
// Search for first row containing the specified text (ignoring whitespace).
function findTemplateRow(rows, text) {
    return rows.findIndex(row => rowText(row).includes(text));
}


// DEEP CLONE TABLE ROW
// Create complete independent copy of a row with all formatting preserved.
function cloneTemplateRow(row) {
    return JSON.parse(JSON.stringify(row));
}


// FORMAT NUMBER AS CURRENCY
// Convert number to formatted string with EUR currency symbol and 2 decimal places.
function templateMoney(value) {
    return `${Number(value || 0).toFixed(2)} EUR`;
}


// FORMAT ADVANCE PAYMENT INFORMATION FOR DISPLAY
// Parse advance payment response and format as human-readable text in English or Slovenian.
function formatAdvancePayment(value, english = false) {

    // Convert value to string and remove leading/trailing whitespace.
    const answer = String(value || "").trim();

    // Check if answer starts with "da" (Slovenian) or "yes" (English).
    const isYes = /^(da|yes)\b/i.test(answer);

    // Set label based on language preference.
    const label = english ? "Advance Payment" : "Plačilo predujema";

    // If answer is not yes, return no response in appropriate language.
    if (!isYes) return `${label}: ${english ? "NO" : "NE"}`;

    // Extract amount from the answer by removing yes/da prefix and labels.
    const amount = answer

        // Remove "da" or "yes" and optional punctuation at the start.
        .replace(/^(da|yes)\s*[,;:]?\s*/i, "")

        // Remove Slovenian "v znesku:" label.
        .replace(/^v\s+znesku\s*:?\s*/i, "")

        // Remove English "amount:" label.
        .replace(/^amount\s*:?\s*/i, "")

        // Remove underscores (often used as placeholders in templates).
        .replace(/_+/g, "")

        // Remove any remaining whitespace.
        .trim();

    // Set yes label based on language preference.
    const yes = english ? "YES" : "DA";

    // Return formatted response with yes and optional amount in appropriate language.
    return `${label}: ${yes}${amount ? `${english ? ", amount: " : ", v znesku: "}${amount}` : ""}`;
}


// CREATE TRAVEL ORDER DOCUMENT FROM TEMPLATE
// Generate complete Word document with travel order details, calculations, and employee information.
async function createTravelOrderDocument(templateFile, order, obracun, dnevnice, kilometrine, racuni, english = false) {

    // Load template Word document from file system.
    const templatePath = `${__dirname}/${templateFile}`;
    const zip = await JSZip.loadAsync(require("fs").readFileSync(templatePath));

    // Extract XML content from Word document (Word files are ZIP archives).
    const documentXml = await zip.file("word/document.xml").async("string");

    // Parse XML string into JavaScript object structure.
    const document = xml2js(documentXml, { compact: false });

    // Find root document element.
    const root = document.elements.find(element => element.name === "w:document");

    // Find document body containing all content.
    const body = root.elements.find(element => element.name === "w:body");
    
    // Normalize text in document (fix spacing and spelling).
    normalizeTemplateText(document);
    normalizeTemplateParagraphs(document);

    // Extract all tables from document body.
    const tables = body.elements.filter(element => element.name === "w:tbl");

    // Helper function to convert values to strings safely.
    const text = value => value === null || value === undefined || value === "" ? "" : String(value);

    // Construct full name from first and last name.
    const fullName = `${text(order.ime)} ${text(order.priimek)}`.trim();

    // Determine vehicle type (car or other).
    const isCar = order.vozilo === "car";
    const vehicle = isCar ? "Avto" : text(order.drugo_vozilo);

    // Format advance payment information based on language.
    const advanceText = formatAdvancePayment(order.placilo_predujema, english);

    // FILL FIRST TABLE: Travel order header with number and date.
    const firstRows = templateRows(tables[0]);
    const orderNumber = order.display_id || order.id;
    const issueDate = templateDate(order.datum_izdaje || new Date());
    replaceTravelOrderTemplateTokens(body, order, issueDate);
    replaceTemplateCellText(templateCells(firstRows[0])[0], `Številka potnega naloga: ${orderNumber}`);
    replaceTemplateCellText(templateCells(firstRows[0])[1], `Datum: ${issueDate}`);

    // FILL SECOND TABLE: Employee information.
    const employeeRows = templateRows(tables[1]);
    replaceTemplateCellText(templateCells(employeeRows[0])[0], `Ime in priimek: ${fullName}`);
    replaceTemplateCellText(templateCells(employeeRows[0])[1], `Delovno mesto: ${order.delovno_mesto || ""}`);
    replaceTemplateCellText(templateCells(employeeRows[1])[0], `Prebivališče: ${order.prebivalisce || ""}`);

    // FILL THIRD TABLE: Route information with departure and arrival.
    const routeRows = templateRows(tables[2]);
    replaceTemplateCellText(templateCells(routeRows[1])[0], `${text(order.lokacija_odhoda)} - ${text(order.lokacija_prihoda)}`);
    replaceTemplateCellText(templateCells(routeRows[1])[1], templateDate(order.datum_odhoda));
    replaceTemplateCellText(templateCells(routeRows[1])[2], templateDate(order.datum_prihoda));

    // FILL PURPOSE OF TRIP paragraph.
    const purposeParagraph = findTemplateParagraph(body, english ? "Purposeofthetrip:" : "Namentipoti:");
    if (purposeParagraph) {
        setTemplateParagraphText(purposeParagraph, english
            ? `Purpose of the trip: ${text(order.namen)}`
            : `Namen poti: ${text(order.namen)}`);
    }

    // FILL VEHICLE TYPE paragraph.
    const vehicleParagraph = findTemplateParagraph(body, english ? "Vehicle:" : "VOZILA:");
    if (vehicleParagraph) {
        setTemplateParagraphText(vehicleParagraph, english ? `Vehicle: ${vehicle}` : `VOZILA: ${vehicle}`);
    }

    // FILL VEHICLE REGISTRATION AND VIN paragraph.
    const vehicleDataParagraph = findTemplateParagraph(body, english ? "RegistrationNumber:" : "Zreg.številko:inVINštevilko:");
    if (vehicleDataParagraph) {
        setTemplateParagraphText(
            vehicleDataParagraph,
            isCar
                ? english
                    ? `Registration Number: ${text(order.registerska)} and VIN Number: ${text(order.vin)}`
                    : `Z reg. številko: ${text(order.registerska)} in VIN številko: ${text(order.vin)}`
                : english
                    ? "Registration Number:  and VIN Number:"
                    : "Z reg. številko:  in VIN številko:"
        );
    }

    // FILL OTHER VEHICLE paragraph.
    const otherVehicleParagraph = findTemplateParagraph(body, english ? "Other:" : "Drugo:");
    if (otherVehicleParagraph) {
        setTemplateParagraphText(otherVehicleParagraph, english
            ? `Other: ${vehicle === "Avto" ? "-" : vehicle}`
            : `Drugo prevozno sredstvo: ${vehicle === "Avto" ? "-" : vehicle}`);
    }

    // FILL ADVANCE PAYMENT paragraph.
    const advanceParagraph = findTemplateParagraph(body, english ? "AdvancePayment:" : "Plačilopredujema:");
    if (advanceParagraph) setTemplateParagraphText(advanceParagraph, advanceText, false);

    // FILL CONFIRMATION paragraph with employee name and company.
    const confirmationParagraph = findTemplateParagraphDeep(body, paragraph => {
        const paragraphText = templateText(paragraph);
        return /Potrjujemo,?\s+da\s+je\s+potnik/i.test(paragraphText) &&
            /zaposlen\s+v\s+podjetju/i.test(paragraphText);
    });

    if (confirmationParagraph) {
        setTemplateParagraphText(confirmationParagraph, english
            ? `We confirm that the traveler ${fullName} is employed by MIL SISTEMIKA d.o.o. on the date of issuance of this travel order.`
            : `Potrjujemo, da je potnik ${fullName} zaposlen v podjetju MIL SISTEMIKA d.o.o. na dan izdaje tega potnega naloga.`);
    }

    // FILL CALCULATION TABLE HEADER: Travel order number and date.
    const calculationHeaderRows = templateRows(tables[3]);
    replaceTemplateCellText(templateCells(calculationHeaderRows[0])[0], `Številka potnega naloga: ${orderNumber}`);
    replaceTemplateCellText(templateCells(calculationHeaderRows[0])[1], `Datum: ${templateDate(order.datum_izdaje || obracun.datum_spremembe || new Date())}`);

    // FILL CALCULATION TABLE EMPLOYEE: Employee information in calculation section.
    const calculationEmployeeRows = templateRows(tables[4]);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[0])[0], `Ime in priimek: ${fullName}`);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[0])[1], `Delovno mesto: ${order.delovno_mesto || ""}`);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[1])[0], `Prebivališče: ${order.prebivalisce || ""}`);

    // PREPARE CALCULATION TABLE: Find section headers and set up data rows.
    let calculationTableRows = templateRows(tables[5]);

    // Find row indices for different sections: allowances, mileage, receipts, total.
    const allowanceHeaderIndex = findTemplateRow(calculationTableRows, english ? "No.ofDays" : "Št.DNI");
    let mileageHeaderIndex = findTemplateRow(calculationTableRows, english ? "MileageReimbursementCalculation:" : "Obračunkilometrine:");
    let receiptsHeaderIndex = findTemplateRow(calculationTableRows, english ? "AttachedInvoices:" : "Priloženiračuni:");
    let totalIndex = findTemplateRow(calculationTableRows, english ? "TOTALEXPENSE:" : "SKUPAJVSISTROŠKI:");

    // Fill departure and arrival dates in calculation table.
    replaceTemplateCellText(templateCells(calculationTableRows[0])[1], templateDate(order.datum_odhoda, true));
    replaceTemplateCellText(templateCells(calculationTableRows[1])[1], templateDate(order.datum_prihoda, true));

    // FILL ALLOWANCE ROWS: Daily allowances for each travel day.
    const allowanceRows = calculationTableRows.slice(allowanceHeaderIndex + 1, mileageHeaderIndex);

    // Center align header cells.
    [...templateCells(calculationTableRows[allowanceHeaderIndex])].forEach(centerTemplateCell);
    allowanceRows.forEach(row => templateCells(row).forEach(centerTemplateCell));
    
    // Expand table if more allowance data exists than template rows.
    while (dnevnice.length > allowanceRows.length) {

        // Clone last row as template for new rows.
        const newRow = cloneTemplateRow(allowanceRows[allowanceRows.length - 1]);

        // Find mileage section header to insert before it.
        const mileageHeadingRow = calculationTableRows.find(row => rowText(row).includes(english ? "MileageReimbursementCalculation:" : "Obračunkilometrine:"));
        const mileageHeadingElementIndex = tables[5].elements.indexOf(mileageHeadingRow);

        // Insert new row into table and tracking arrays.
        tables[5].elements.splice(mileageHeadingElementIndex, 0, newRow);
        calculationTableRows.splice(calculationTableRows.indexOf(mileageHeadingRow), 0, newRow);
        allowanceRows.push(newRow);
        // Center align new row cells.
        templateCells(newRow).forEach(centerTemplateCell);
    }
    
    // Refresh row indices after potential table expansion.
    calculationTableRows = templateRows(tables[5]);
    mileageHeaderIndex = findTemplateRow(calculationTableRows, english ? "MileageReimbursementCalculation:" : "Obračunkilometrine:");
    receiptsHeaderIndex = findTemplateRow(calculationTableRows, english ? "AttachedInvoices:" : "Priloženiračuni:");
    totalIndex = findTemplateRow(calculationTableRows, english ? "TOTALEXPENSE:" : "SKUPAJVSISTROŠKI:");
    
    // Fill each allowance row with data.
    dnevnice.forEach((item, index) => {
        const cells = templateCells(allowanceRows[index]);
        replaceTemplateCellText(cells[0], index + 1);                              // Day number
        replaceTemplateCellText(cells[1], templateDate(item.datum));              // Date
        replaceTemplateCellText(cells[2], item.zagotovljeni_obroki || "-");       // Provided meals
        replaceTemplateCellText(cells[3], templateMoney(item.dnevnica));          // Daily allowance amount
    });

    // FILL MILEAGE ROWS: Kilometer reimbursement entries.
    const mileageRows = calculationTableRows.slice(mileageHeaderIndex + 2, receiptsHeaderIndex);
    kilometrine.forEach((item, index) => {

        // Skip if no row available for this entry.
        if (!mileageRows[index]) return;
        const cells = templateCells(mileageRows[index]);
        replaceTemplateCellText(cells[0], item.lokacija_odhoda);                 // Departure location
        replaceTemplateCellText(cells[1], item.lokacija_prihoda);                // Arrival location
        replaceTemplateCellText(cells[2], item.kilometri);                       // Number of kilometers
        replaceTemplateCellText(cells[3], templateMoney(item.obracun));          // Amount
    });

    // FILL RECEIPT ROWS: Expense receipts/invoices.
    const receiptRows = calculationTableRows.slice(receiptsHeaderIndex + 2, totalIndex);
    racuni.forEach((item, index) => {

        // Skip if no row available for this entry.
        if (!receiptRows[index]) return;
        const cells = templateCells(receiptRows[index]);
        replaceTemplateCellText(cells[0], item.podjetje);                        // Company name
        replaceTemplateCellText(cells[1], item.opis_stroska);                    // Expense description
        replaceTemplateCellText(cells[2], templateMoney(item.znesek));           // Amount
    });

    // FILL TOTAL EXPENSE ROW.
    const totalCells = templateCells(calculationTableRows[totalIndex]);
    replaceTemplateCellText(totalCells[1], templateMoney(obracun.skupni_stroski));
    centerTemplateCell(totalCells[1]);

    // FILL EMPLOYEE PAYMENT ROW.
    const paymentRow = calculationTableRows.find(row => rowText(row).includes(english ? "AmountPayabletoEmployee:" : "Zaizplačilozaposlenemu:"));
    if (paymentRow) {
        replaceTemplateCellText(templateCells(paymentRow)[1], templateMoney(obracun.placilo_zaposlenemu));
        centerTemplateCell(templateCells(paymentRow)[1]);
    }

    // Clean up all template markers (field codes, merge fields, etc.).
    removeTemplateMarkers(document);

    // Convert modified XML back to string and save to ZIP.
    zip.file("word/document.xml", js2xml(document, { compact: false, spaces: 0 }));

    // Generate final Word document as binary buffer.
    return zip.generateAsync({ type: "nodebuffer" });
}


// REPLACE TOKEN IN ALL TABLE CELLS
// Search through all tables and replace a specific token with a value in matching cells.
function replaceMonthlyTokenInTables(tables, token, value) {

    // Loop through each table.
    tables.forEach(table => {

        // Loop through each row in the table.
        templateRows(table).forEach(row => {

            // Loop through each cell in the row.
            templateCells(row).forEach(cell => {

                // Extract all text content from the cell.
                const text = templateText(cell);

                // Check if cell text contains the token we're looking for.
                if (text.includes(token)) {

                    // Convert value to string (empty string if null/undefined).
                    const replacement = String(value ?? "");

                    // Replace both bracketed token («token») and plain token.
                    const updatedText = text
                        .replaceAll(`«${token}»`, replacement)
                        .replaceAll(token, replacement);

                    // Replace entire cell text with updated text.
                    replaceTemplateCellText(cell, updatedText);
                }
            });
        });
    });
}


// REPLACE TOKEN IN ELEMENT AND ALL NESTED ELEMENTS
// Recursively search through elements and replace bracketed token with value in text nodes only.
function replaceTemplateTokenInElement(element, token, value) {

    // Return early if element is empty or has no child elements.
    if (!element?.elements) return;

    // Loop through each child element.
    element.elements.forEach(child => {

        // If child is a text node, replace the token in it.
        if (child.type === "text") {

            // Convert value to string (empty string if null/undefined).
            const replacement = String(value ?? "");

            // Replace only bracketed token format («token») to avoid changing visible labels.
            // Only replace explicit field markers, not bare token text.
            child.text = child.text.replaceAll(`«${token}»`, replacement);

        } else {
            // If child is an element (not text), recurse deeper to search nested elements.
            replaceTemplateTokenInElement(child, token, value);
        }
    });
}


// REPLACE ALL TRAVEL ORDER TEMPLATE TOKENS
// Fill all placeholder tokens in document with travel order data.
function replaceTravelOrderTemplateTokens(body, order, issueDate) {

    // Helper function to safely convert values to strings.
    const text = value => value === null || value === undefined ? "" : String(value);

    // Determine if vehicle is a car.
    const isCar = order.vozilo === "car";

    // Set vehicle display name (car or custom vehicle type).
    const vehicle = isCar ? "Avto" : text(order.drugo_vozilo);

    // Define mapping of all template tokens to their values from order data.
    const values = {
        "Potni_nalog_ŠT": order.display_id || order.id,              // Travel order number
        Datum_odhoda: issueDate,                                      // Departure date
        Datum_prihoda: issueDate,                                     // Arrival date
        Ime: order.ime,                                               // First name
        Priimek: order.priimek,                                       // Last name
        DM: order.delovno_mesto,                                      // Work position
        Naslov: order.prebivalisce,                                   // Address
        Lokacija: `${text(order.lokacija_odhoda)} - ${text(order.lokacija_prihoda)}`, // Route
        Kaj: order.namen,                                             // Purpose of trip
        PREVOZ_VOZILO_ali_sopotnik: vehicle,                         // Vehicle or companion
        REG: isCar ? order.registerska : "",                         // Registration plate (if car)
        VIN: isCar ? order.vin : "",                                 // VIN number (if car)
        PREVOZ_DRUGO: isCar ? "-" : vehicle                          // Other vehicle type
    };

    // Loop through each token-value pair and replace in document.
    Object.entries(values).forEach(([token, value]) => replaceTemplateTokenInElement(body, token, value));
}


// CREATE MONTHLY TRAVEL ORDER DOCUMENT
// Generate Word document for monthly travel order with daily mileage entries and calculations.
async function createMonthlyTravelOrderDocument(order, obracun, kilometrine) {

    // Load monthly travel order template from file system.
    const templatePath = `${__dirname}/private/JS/Mesečni potni Nalog_MIL doo_template.docx`;
    const zip = await JSZip.loadAsync(require("fs").readFileSync(templatePath));

    // Extract XML content from Word document (Word files are ZIP archives).
    const documentXml = await zip.file("word/document.xml").async("string");

    // Parse XML string into JavaScript object structure.
    const document = xml2js(documentXml, { compact: false });

    // Find root document element.
    const root = document.elements.find(element => element.name === "w:document");

    // Find document body containing all content.
    const body = root.elements.find(element => element.name === "w:body");
    
    // Normalize text in document (fix spacing and spelling).
    normalizeTemplateText(document);
    normalizeTemplateParagraphs(document);

    // Extract all tables from document body.
    const tables = body.elements.filter(element => element.name === "w:tbl");
    
    // Format all dates for display.
    const departureDate = templateDate(order.datum_odhoda, true);
    const arrivalDate = templateDate(order.datum_prihoda, true);

    // Get travel order number.
    const orderNumber = order.display_id || order.id;

    // Get issue date (creation date or today).
    const issueDate = templateDate(order.datum_izdaje || new Date());

    // Construct full employee name.
    const fullName = `${order.ime || ""} ${order.priimek || ""}`.trim();

    // Determine vehicle type (car or other).
    const isCar = order.vozilo === "car";
    const vehicle = isCar ? "Avto" : order.drugo_vozilo || "";

    // Format advance payment information.
    const advanceText = formatAdvancePayment(order.placilo_predujema);

    // REPLACE ALL GENERIC TOKENS
    replaceTravelOrderTemplateTokens(body, order, issueDate);

    // Override date tokens with formatted versions.
    replaceTemplateTokenInElement(body, "Datum_odhoda", departureDate);
    replaceTemplateTokenInElement(body, "Datum_prihoda", arrivalDate);

    // FILL FIRST TABLE: Travel order header with number and date.
    const firstRows = templateRows(tables[0]);
    replaceTemplateCellText(templateCells(firstRows[0])[0], `Številka potnega naloga: ${orderNumber}`);
    replaceTemplateCellText(templateCells(firstRows[0])[1], `Datum: ${issueDate}`);

    // FILL SECOND TABLE: Employee information.
    const employeeRows = templateRows(tables[1]);
    replaceTemplateCellText(templateCells(employeeRows[0])[0], `Ime in priimek: ${fullName}`);
    replaceTemplateCellText(templateCells(employeeRows[0])[1], `Delovno mesto: ${order.delovno_mesto || ""}`);
    replaceTemplateCellText(templateCells(employeeRows[1])[0], `Prebivališče: ${order.prebivalisce || ""}`);

    // FILL THIRD TABLE: Route information with dates.
    const routeRows = templateRows(tables[2]);
    replaceTemplateCellText(templateCells(routeRows[1])[0], `${order.lokacija_odhoda || ""} - ${order.lokacija_prihoda || ""}`);
    replaceTemplateCellText(templateCells(routeRows[1])[1], templateDate(order.datum_odhoda));
    replaceTemplateCellText(templateCells(routeRows[1])[2], templateDate(order.datum_prihoda));

    // FILL PURPOSE OF TRIP paragraph.
    const purposeParagraph = findTemplateParagraph(body, "Namentipoti:");
    if (purposeParagraph) setTemplateParagraphText(purposeParagraph, `Namen poti: ${order.namen || ""}`);

    // FILL VEHICLE TYPE paragraph.
    const vehicleParagraph = findTemplateParagraph(body, "VOZILA:");
    if (vehicleParagraph) setTemplateParagraphText(vehicleParagraph, `VOZILA: ${vehicle}`);

    // FILL VEHICLE REGISTRATION AND VIN paragraph.
    const vehicleDataParagraph = findTemplateParagraph(body, "Zreg.številko:inVINštevilko:");
    if (vehicleDataParagraph) {
        setTemplateParagraphText(
            vehicleDataParagraph,
            isCar
                ? `Z reg. številko: ${order.registerska || ""} in VIN številko: ${order.vin || ""}`
                : "Z reg. številko:  in VIN številko:"
        );
    }

    // FILL OTHER VEHICLE paragraph.
    const otherVehicleParagraph = findTemplateParagraph(body, "Drugo:");
    if (otherVehicleParagraph) {
        setTemplateParagraphText(otherVehicleParagraph, `Drugo prevozno sredstvo: ${isCar ? "-" : vehicle}`);
    }

    // FILL ADVANCE PAYMENT paragraph.
    const advanceParagraph = findTemplateParagraph(body, "Plačilopredujema:");
    if (advanceParagraph) setTemplateParagraphText(advanceParagraph, advanceText, false);

    // FILL CONFIRMATION paragraph with employee name and company.
    const confirmationParagraph = findTemplateParagraphDeep(body, paragraph => {
        const paragraphText = templateText(paragraph);
        return /Potrjujemo,?\s+da\s+je\s+potnik/i.test(paragraphText) &&
            /zaposlen\s+v\s+podjetju/i.test(paragraphText);
    });
    if (confirmationParagraph) {
        setTemplateParagraphText(
            confirmationParagraph,
            `Potrjujemo, da je potnik ${fullName} zaposlen v podjetju MIL SISTEMIKA d.o.o. na dan izdaje tega potnega naloga.`
        );
    }

    // FILL CALCULATION TABLE HEADER: Travel order number and date.
    const calculationHeaderRows = templateRows(tables[3]);
    replaceTemplateCellText(templateCells(calculationHeaderRows[0])[0], `Številka potnega naloga: ${orderNumber}`);
    replaceTemplateCellText(templateCells(calculationHeaderRows[0])[1], `Datum: ${templateDate(order.datum_izdaje || obracun.datum_spremembe || new Date())}`);

    // FILL CALCULATION TABLE EMPLOYEE: Employee information in calculation section.
    const calculationEmployeeRows = templateRows(tables[4]);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[0])[0], `Ime in priimek: ${fullName}`);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[0])[1], `Delovno mesto: ${order.delovno_mesto || ""}`);
    replaceTemplateCellText(templateCells(calculationEmployeeRows[1])[0], `Prebivališče: ${order.prebivalisce || ""}`);

    // PREPARE CALCULATION TABLE: Find section headers and extract mileage data rows.
    const calculationRows = templateRows(tables[5]);

    // Find row indices for mileage, receipts, and total sections.
    const mileageHeaderIndex = findTemplateRow(calculationRows, "Obračunkilometrine:");
    const receiptsHeaderIndex = findTemplateRow(calculationRows, "Priloženiračuni:");
    const totalIndex = findTemplateRow(calculationRows, "SKUPAJVSISTROŠKI:");

    // Extract rows between mileage header and receipts header.
    const mileageRows = calculationRows.slice(mileageHeaderIndex + 2, receiptsHeaderIndex);

    // FILL MILEAGE ROWS: Daily mileage entries for each day of monthly travel.
    kilometrine.forEach((item, index) => {

        // Skip if no row available for this entry.
        if (!mileageRows[index]) return;
        const cells = templateCells(mileageRows[index]);

        // Fill date of travel.
        replaceTemplateCellText(cells[0], templateDate(item.datum));

        // Fill departure or arrival location (relation/route).
        replaceTemplateCellText(cells[1], item.lokacija_odhoda || item.lokacija_prihoda || "");

        // Fill number of kilometers.
        replaceTemplateCellText(cells[2], item.kilometri);

        // Fill reimbursement amount in EUR.
        replaceTemplateCellText(cells[3], templateMoney(item.obracun));
    });

    // FILL TOTAL EXPENSE ROW.
    const totalCells = templateCells(calculationRows[totalIndex]);
    replaceTemplateCellText(totalCells[1], templateMoney(obracun.skupni_stroski));
    centerTemplateCell(totalCells[1]);
    
    // FILL EMPLOYEE PAYMENT ROW.
    const paymentRow = calculationRows.find(row => rowText(row).includes("Zaizplačilozaposlenemu:"));
    if (paymentRow) {
        replaceTemplateCellText(templateCells(paymentRow)[1], templateMoney(obracun.placilo_zaposlenemu));
        centerTemplateCell(templateCells(paymentRow)[1]);
    }
    
    // Clean up all template markers (field codes, merge fields, etc.).
    removeTemplateMarkers(document);

    // Convert modified XML back to string and save to ZIP.
    zip.file("word/document.xml", js2xml(document, { compact: false, spaces: 0 }));

    // Generate final Word document as binary buffer.
    return zip.generateAsync({ type: "nodebuffer" });
}


// CREATE ARCHIVE WITH TRAVEL ORDER DOCUMENT AND ALL ATTACHMENTS
// Generate ZIP archive containing the travel order document and all expense receipt files.
async function createOrderArchive(orderId) {

    // Fetch complete travel order with employee and country information.
    const order = db.prepare(`
        SELECT potni_nalogi.*, users.ime, users.priimek, users.prebivalisce,
               users.delovno_mesto, drzave.naziv AS drzava, drzave.valuta
        FROM potni_nalogi
        JOIN users ON users.id = potni_nalogi.user_id
        LEFT JOIN drzave ON drzave.id = potni_nalogi.drzava_prihoda_id
        WHERE potni_nalogi.id = ?
    `).get(orderId);

    // Return error if travel order doesn't exist.
    if (!order) throw new Error("Travel order not found...");

    // Fetch billing record for this travel order.
    const obracun = db.prepare("SELECT * FROM obracun WHERE potni_nalog_id = ?").get(orderId);

    // Return error if billing record doesn't exist.
    if (!obracun) throw new Error("Najprej shranite obračun za ta potni nalog.");

    // Fetch all daily allowance entries ordered by date.
    const dnevnice = db.prepare("SELECT datum, zagotovljeni_obroki, dnevnica FROM obracun_dnevnice WHERE obracun_id = ? ORDER BY datum").all(obracun.id);

    // Fetch all mileage entries ordered by sequence.
    const kilometrine = db.prepare("SELECT datum, lokacija_odhoda, lokacija_prihoda, kilometri, obracun FROM obracun_kilometrine WHERE obracun_id = ? ORDER BY id").all(obracun.id);

    // Fetch all receipt entries ordered by sequence.
    const racuni = db.prepare("SELECT id, podjetje, opis_stroska, znesek FROM obracun_racuni WHERE obracun_id = ? ORDER BY id").all(obracun.id);
    
    // Generate appropriate document based on travel order type (monthly or regular).
    const sloveneDocument = order.mesecni
        ? await createMonthlyTravelOrderDocument(order, obracun, kilometrine)
        : await createTravelOrderDocument("private/JS/Potni Nalog_MIL doo_template.docx", order, obracun, dnevnice, kilometrine, racuni);
    
    // Helper function to create safe filename by removing special characters.
    const safeName = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

    // Set file prefix based on travel order type (MPN for monthly, PN for regular).
    const filePrefix = Number(order.mesecni) === 1 ? "MPN" : "PN";

    // Construct base filename from travel order data.
    const baseFileName = `${filePrefix}-${safeName(order.ime)}-${safeName(order.priimek)}-${textDateForFile(order.datum_odhoda)}-${safeName(order.display_id || order.id)}`;
    
    // Create new ZIP archive for storing all files.
    const archive = new JSZip();

    // Add generated travel order document to archive.
    archive.file(`${baseFileName}-SL.docx`, sloveneDocument);
    
    // Fetch all expense receipt attachments for this billing record.
    const attachments = db.prepare(`
        SELECT id, originalno_ime, mime_type, vsebina
        FROM obracun_datoteke
        WHERE racun_id IN (SELECT id FROM obracun_racuni WHERE obracun_id = ?)
        ORDER BY id
    `).all(obracun.id);
    
    // Fetch all monthly billing attachments if they exist.
    const monthlyAttachments = db.prepare(`
        SELECT id, originalno_ime, mime_type, vsebina
        FROM mesecni_obracun_datoteke
        WHERE obracun_id = ?
        ORDER BY id
    `).all(obracun.id);
    
    // Combine both attachment arrays.
    attachments.push(...monthlyAttachments);
    
    // Add each attachment file to archive in "priloge" (attachments) folder.
    attachments.forEach((attachment, index) => {

        // Skip if attachment has no content.
        if (attachment.vsebina) {

            // Add file to archive with sequential numbering.
            archive.file(`priloge/${index + 1}-${attachment.originalno_ime}`, attachment.vsebina);
        }
    });
    
    // Generate archive as binary buffer and return with base filename.
    return { archiveBuffer: await archive.generateAsync({ type: "nodebuffer" }), baseFileName };
}


// CHANGE STATUS FROM NOT PAID TO CLOSED/COMPLETED AND EXPORT THE TEMPLATE
app.post("/api/admin/all_travel_orders/:id/end_order", requireAdmin, async (req, res) => {

    const { id } = req.params;

    try {
        const order = db.prepare("SELECT status FROM potni_nalogi WHERE id = ?").get(id);
        if (!order) return res.status(404).json({ error: "Travel order not found..." });
        if (order.status !== "Not paid") {
            return res.status(400).json({ error: "Travel order status cannot be ended" });
        }
        const { archiveBuffer, baseFileName } = await createOrderArchive(id);

        db.prepare("UPDATE potni_nalogi SET status = ? WHERE id = ?").run("Completed", id);

        // Set response header to indicate file is a ZIP archive.
        res.setHeader("Content-Type", "application/zip");

        // Set header to force download with specified filename instead of displaying in browser.
        res.setHeader("Content-Disposition", `attachment; filename="${baseFileName}.zip"`);

        // Send the ZIP file binary data to the client for download.
        res.send(archiveBuffer);
    } catch (error) {
        console.error("End order Error", error);
        res.status(500).json({ error: "Napaka pri izpolnjevanju Word predloge." });
    }
});


// DOWNLOAD COMPLETED TRAVEL ORDER WITH DOCUMENTS AND ATTACHMENTS
// Generate and download ZIP archive containing travel order document and all expense receipts for completed orders.
app.get("/api/admin/completed_travel_order/:id/documents", requireAdmin, async (req, res) => {
    try {

        // Fetch travel order status from database.
        const order = db.prepare("SELECT status FROM potni_nalogi WHERE id = ?").get(req.params.id);

        // Return error if travel order doesn't exist.
        if (!order) return res.status(404).json({ error: "Travel order not found..." });

        // Return error if travel order status is not "Completed".
        if (order.status !== "Completed") return res.status(400).json({ error: "Samo zaključen nalog lahko ponovno izvozite." });

        // Generate archive with document and all attachments.
        const { archiveBuffer, baseFileName } = await createOrderArchive(req.params.id);

        // Set response header to indicate ZIP file type.
        res.setHeader("Content-Type", "application/zip");

        // Set header to force download with specified filename.
        res.setHeader("Content-Disposition", `attachment; filename="${baseFileName}.zip"`);

        // Send the ZIP archive to client for download.
        res.send(archiveBuffer);

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Completed order export error:", error);
        // Send error response with error details.
        res.status(500).json({ error: `Napaka pri izdelavi Word dokumentov: ${error.message}` });
    }
});


// GET INFO FOR AUTOFILL IN OBRACUN
app.get("/api/admin/obracun_info/:id", requireAdmin, (req, res) => {
    const { id } = req.params;

    try {
        const stmt = db.prepare(`
            SELECT 
                id,
                display_id,
                drzava_prihoda_id,
                datum_odhoda,
                datum_prihoda,
                lokacija_odhoda,
                lokacija_prihoda
            FROM potni_nalogi
            WHERE id = ?
        `).get(id)

        if (!stmt) {
            return res.status(404).json({
                error: "Potni nalog ni najden."
            });
        }

        res.json(stmt);

    } catch (error) {
        console.error("Napaka pri pridobivanju podatkov:", error);

        res.status(500).json({
            error: "Napaka na strežniku."
        });
    }
})


// GET ALL BILLING DATA FOR TRAVEL ORDER
// Fetch complete billing record with all daily allowances, mileage, receipts, and attachments.
app.get("/api/admin/obracun/:id", requireAdmin, (req, res) => {
    try {
        // Extract travel order ID from URL parameters.
        const potni_nalog_id = req.params.id;

        // Fetch main billing record for this travel order.
        const obracun = db.prepare(`
            SELECT * FROM obracun WHERE potni_nalog_id = ?
        `).get(potni_nalog_id);

        // Return response indicating billing doesn't exist if not found.
        if (!obracun) {
            return res.json({ exists: false });
        }

        // Fetch all daily allowance entries ordered by date.
        const dnevnice = db.prepare(`
            SELECT datum, zagotovljeni_obroki, dnevnica_ure, dnevnica 
            FROM obracun_dnevnice 
            WHERE obracun_id = ?
            ORDER BY datum
        `).all(obracun.id);

        // Fetch all mileage reimbursement entries (outbound and return).
        const kilometrine = db.prepare(`
            SELECT smer, kilometri, obracun 
            FROM obracun_kilometrine 
            WHERE obracun_id = ?
        `).all(obracun.id);

        // Fetch all expense receipts/invoices.
        const racuni = db.prepare(`
            SELECT id, podjetje, opis_stroska, znesek 
            FROM obracun_racuni 
            WHERE obracun_id = ?
        `).all(obracun.id);

        // For each receipt, fetch all attached files (photos, PDFs, etc.).
        racuni.forEach(racun => {
            racun.priponke = db.prepare(`
                SELECT id, originalno_ime, mime_type, velikost
                FROM obracun_datoteke
                WHERE racun_id = ?
                ORDER BY id
            `).all(racun.id);
        });

        // Send complete billing data to client.
        res.json({
            exists: true,
            obracun: obracun,
            dnevnice: dnevnice,
            kilometrine: kilometrine,
            racuni: racuni
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri pridobivanju obračuna:", error);
        // Send error response to client.
        res.status(500).json({ error: error.message });
    }
});


// GET BILLING ATTACHMENT FILE AS ADMIN
// Fetch and serve a specific expense receipt file attachment for admin view.
app.get("/api/admin/obracun/file/:fileId", requireAdmin, (req, res) => {
    try {

        // Query database for the file with matching ID.
        const file = db.prepare(`
            SELECT originalno_ime, mime_type, velikost, vsebina
            FROM obracun_datoteke
            WHERE id = ?
        `).get(req.params.fileId);

        // Return error if file doesn't exist or has no content.
        if (!file || !file.vsebina) {
            return res.status(404).json({ error: "Priponka ni bila najdena." });
        }

        // Set Content-Type header to file's MIME type, default to binary if not specified.
        res.setHeader("Content-Type", file.mime_type || "application/octet-stream");

        // Set filename for display, remove quotes to prevent header injection security vulnerabilities.
        res.setHeader("Content-Disposition", `inline; filename="${file.originalno_ime.replace(/"/g, "")}"`);

        // Send the file content (binary data) to the client for viewing or download.
        res.send(file.vsebina);
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri pridobivanju priponke:", error);
        // Send error response to client.
        res.status(500).json({ error: "Napaka pri pridobivanju priponke." });
    }
});


// DELETE BILLING ATTACHMENT FILE AS ADMIN
// Remove a specific expense receipt file attachment from the database.
app.delete("/api/admin/obracun/file/:fileId", requireAdmin, (req, res) => {
    try {
        
        // Delete the file from database by ID.
        const result = db.prepare("DELETE FROM obracun_datoteke WHERE id = ?").run(req.params.fileId);

        // Return error if file doesn't exist or wasn't deleted.
        if (result.changes === 0) {
            return res.status(404).json({ error: "Priponka ni bila najdena." });
        }

        // Send success response to client.
        res.json({ success: true });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri brisanju priponke:", error);
        // Send error response to client.
        res.status(500).json({ error: "Napaka pri brisanju priponke." });
    }
});


// SAVE OBRACUN DATA TO DATABASE 
app.get("/api/admin/dnevnica-rate/:drzavaId", (req, res) => {
    try {
        const { drzavaId } = req.params;

        const result = db.prepare(`
            SELECT
                drzave.id AS drzava_id,
                drzave.naziv,
                drzave.valuta,
                dnevnice.dnevnica14,
                dnevnice.dnevnica8,
                dnevnice.dnevnica6
            FROM dnevnice
            INNER JOIN drzave
                ON dnevnice.drzava_id = drzave.id
            WHERE drzave.id = ?
        `).get(drzavaId);

        if (!result) {
            return res.status(404).json({
                error: "Dnevnica za to državo ni najdena"
            });
        }

        res.json(result);

    } catch (error) {
        console.error("Napaka pri pridobivanju dnevnice:", error);

        res.status(500).json({
            error: "Napaka pri pridobivanju dnevnice"
        });
    }
});


// SAVE OR UPDATE BILLING RECORD AS ADMIN
// Create or update billing with daily allowances, mileage, and receipts for a travel order (admin version).
app.post("/api/admin/obracun/save/:id", requireAdmin,  upload.any(), (req, res) => {
    try {

        // Extract travel order ID from URL parameters.
        const potni_nalog_id = req.params.id;

        // Extract employee payment amount from request body.
        const placilo_zaposlenemu = req.body.placilo_zaposlenemu;

        // Extract departure and arrival dates from request body.
        const datum_odhoda = req.body.datum_odhoda;
        const datum_prihoda = req.body.datum_prihoda;

        // Use mileage-specific locations if provided, otherwise use general locations.
        let lokacija_odhoda = req.body.lokacija_odhoda_km || req.body.lokacija_odhoda;
        let lokacija_prihoda = req.body.lokacija_prihoda_km || req.body.lokacija_prihoda;

        // If locations not provided, fetch them from the travel order.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            const potniNalog = db.prepare(`
                SELECT lokacija_odhoda, lokacija_prihoda 
                FROM potni_nalogi 
                WHERE id = ?
            `).get(potni_nalog_id);

            // Use travel order locations as fallback.
            if (potniNalog) {
                lokacija_odhoda = lokacija_odhoda || potniNalog.lokacija_odhoda;
                lokacija_prihoda = lokacija_prihoda || potniNalog.lokacija_prihoda;
            }
        }

        // Return error if departure or arrival location is missing.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            return res.status(400).json({
                success: false,
                error: "Lokacije odhoda i prihoda su obavezne!"
            });
        }

        // STEP 1: Check if billing record exists, create if not.
        let obracun = db.prepare(`
            SELECT id FROM obracun WHERE potni_nalog_id = ?
        `).get(potni_nalog_id);

        let obracun_id;

        // Create new billing record if it doesn't exist.
        if (!obracun) {
            db.prepare(`
                INSERT INTO obracun (potni_nalog_id, skupni_stroski, placilo_zaposlenemu)
                VALUES (?, ?, ?)
            `).run(potni_nalog_id, 0, 0);

            // Fetch the newly created billing record.
            obracun = db.prepare(`
                SELECT id FROM obracun WHERE potni_nalog_id = ?
            `).get(potni_nalog_id);
        }

        // Store billing record ID for use throughout function.
        obracun_id = obracun.id;

        // STEP 2: Save daily allowances.
        // Convert form data to arrays for consistent processing.
        const travelDates = Array.isArray(req.body.travelDate) ? req.body.travelDate : [req.body.travelDate];
        const providedMeals = Array.isArray(req.body.providedMeals) ? req.body.providedMeals : [req.body.providedMeals];
        const dailyAllowances = Array.isArray(req.body.dailyAllowance) ? req.body.dailyAllowance : [req.body.dailyAllowance];

        // Initialize total daily allowances accumulator.
        let skupnoDnevnice = 0;

        // Delete old daily allowance entries.
        db.prepare(`DELETE FROM obracun_dnevnice WHERE obracun_id = ?`).run(obracun_id);

        // Insert new daily allowance entries for each travel date.
        travelDates.forEach((date, index) => {
            // Convert daily allowance to number.
            const dnevnica = parseFloat(dailyAllowances[index] || 0);
            // Get provided meals information.
            const obroki = providedMeals[index] || '';

            // Add this day's allowance to running total.
            skupnoDnevnice += dnevnica;

            // Insert daily allowance entry into database.
            db.prepare(`
                INSERT INTO obracun_dnevnice (obracun_id, datum, zagotovljeni_obroki, dnevnica)
                VALUES (?, ?, ?, ?)
            `).run(obracun_id, date, obroki, dnevnica);
        });

        // STEP 3: Save mileage reimbursement.
        // Convert mileage values to numbers.
        const kilometri_naprej = parseFloat(req.body.kilometri_naprej || 0);
        const kilometri_nazaj = parseFloat(req.body.kilometri_nazaj || 0);
        const obracun_kilometrine_naprej = parseFloat(req.body.obracun_kilometrine_naprej || 0);
        const obracun_kilometrine_nazaj = parseFloat(req.body.obracun_kilometrine_nazaj || 0);

        // Calculate total mileage reimbursement.
        let skupnoKilometrina = obracun_kilometrine_naprej + obracun_kilometrine_nazaj;

        // Delete old mileage entries.
        db.prepare(`DELETE FROM obracun_kilometrine WHERE obracun_id = ?`).run(obracun_id);

        // Insert outbound trip mileage if kilometers exist.
        if (kilometri_naprej > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'naprej',
                lokacija_odhoda,
                lokacija_prihoda,
                kilometri_naprej,
                0.43,
                obracun_kilometrine_naprej
            );
        }

        // Insert return trip mileage if kilometers exist.
        if (kilometri_nazaj > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'nazaj',
                lokacija_prihoda,
                lokacija_odhoda,
                kilometri_nazaj,
                0.43,
                obracun_kilometrine_nazaj
            );
        }

        // STEP 4: Save receipts and attachments.
        // Convert receipt data to arrays for consistent processing.
        const racuniPodjetja = Array.isArray(req.body.racun_podjetje) ? req.body.racun_podjetje : [req.body.racun_podjetje];
        const opisStroska = Array.isArray(req.body.opis_stroska) ? req.body.opis_stroska : [req.body.opis_stroska];
        const racuniZneski = Array.isArray(req.body.znesek_racuna) ? req.body.znesek_racuna : [req.body.znesek_racuna];

        // Initialize receipt total accumulator and receipt ID storage.
        let skupnoRacuni = 0;
        const receiptIds = [];

        // Capture existing receipt attachments before deleting old receipts.
        const previousAttachments = captureReceiptAttachments(obracun_id);

        // Delete old receipt entries.
        db.prepare(`DELETE FROM obracun_racuni WHERE obracun_id = ?`).run(obracun_id);

        // Insert new receipt entries for each receipt amount.
        racuniZneski.forEach((znesek, index) => {

            // Only insert if receipt has a valid positive amount.
            if (znesek && parseFloat(znesek) > 0) {

                // Convert receipt amount to number.
                const amount = parseFloat(znesek);

                // Add this receipt to running total.
                skupnoRacuni += amount;

                // Insert receipt into database and store its new ID.
                const receiptResult = db.prepare(`
                    INSERT INTO obracun_racuni (obracun_id, podjetje, opis_stroska, znesek)
                    VALUES (?, ?, ?, ?)
                `).run(
                    obracun_id,
                    racuniPodjetja[index] || '',
                    opisStroska[index] || '',
                    amount
                );
                receiptIds[index] = receiptResult.lastInsertRowid;
            }
        });

        // Save new receipt file attachments to the database.
        saveReceiptAttachments(req.files, receiptIds);

        // Restore previous attachments with new receipt IDs for updated receipts.
        restoreReceiptAttachments(previousAttachments, receiptIds);

        // STEP 5: Calculate total expenses.
        const skupni_stroski = skupnoDnevnice + skupnoKilometrina + skupnoRacuni;

        // STEP 6: Update billing record with totals and timestamps.
        db.prepare(`
            UPDATE obracun 
            SET 
                skupni_stroski = ?,
                placilo_zaposlenemu = ?,
                datum_spremembe = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(skupni_stroski, placilo_zaposlenemu, obracun_id);

        // Send success response with billing summary.
        res.json({
            success: true,
            obracun_id: obracun_id,
            povzetek: {
                dnevnice: skupnoDnevnice.toFixed(2),
                kilometrina: skupnoKilometrina.toFixed(2),
                racuni: skupnoRacuni.toFixed(2),
                skupaj: skupni_stroski.toFixed(2)
            }
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri shranjevanju obračuna:", error);
        // Send error response with error details.
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// END BILLING AND MARK TRAVEL ORDER AS COMPLETED
// Finalize billing record with all expenses and change travel order status to completed.
app.post("/api/admin/obracun/end/:id", requireAdmin, upload.any(), (req, res) => {
    try {
        // Extract travel order ID from URL parameters.
        const potni_nalog_id = req.params.id;

        // Extract employee payment amount from request body.
        const placilo_zaposlenemu = req.body.placilo_zaposlenemu;

        // Extract departure and arrival dates from request body.
        const datum_odhoda = req.body.datum_odhoda;
        const datum_prihoda = req.body.datum_prihoda;

        // Use mileage-specific locations if provided, otherwise use general locations.
        let lokacija_odhoda = req.body.lokacija_odhoda_km || req.body.lokacija_odhoda;
        let lokacija_prihoda = req.body.lokacija_prihoda_km || req.body.lokacija_prihoda;

        // If locations not provided, fetch them from the travel order.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            const potniNalog = db.prepare(`
                SELECT lokacija_odhoda, lokacija_prihoda 
                FROM potni_nalogi 
                WHERE id = ?
            `).get(potni_nalog_id);

            // Use travel order locations as fallback.
            if (potniNalog) {
                lokacija_odhoda = lokacija_odhoda || potniNalog.lokacija_odhoda;
                lokacija_prihoda = lokacija_prihoda || potniNalog.lokacija_prihoda;
            }
        }

        // Return error if departure or arrival location is missing.
        if (!lokacija_odhoda || !lokacija_prihoda) {
            return res.status(400).json({
                success: false,
                error: "Lokacije odhoda in prihoda so obvezne!"
            });
        }

        // STEP 1: Check if billing record exists, create if not.
        let obracun = db.prepare(`
            SELECT id FROM obracun WHERE potni_nalog_id = ?
        `).get(potni_nalog_id);

        let obracun_id;

        // Create new billing record if it doesn't exist.
        if (!obracun) {
            db.prepare(`
                INSERT INTO obracun (potni_nalog_id, skupni_stroski, placilo_zaposlenemu)
                VALUES (?, ?, ?)
            `).run(potni_nalog_id, 0, 0);

            // Fetch the newly created billing record.
            obracun = db.prepare(`
                SELECT id FROM obracun WHERE potni_nalog_id = ?
            `).get(potni_nalog_id);
        }

        // Store billing record ID for use throughout function.
        obracun_id = obracun.id;

        // STEP 2: Save daily allowances.
        // Convert form data to arrays for consistent processing.
        const travelDates = Array.isArray(req.body.travelDate) ? req.body.travelDate : [req.body.travelDate];
        const providedMeals = Array.isArray(req.body.providedMeals) ? req.body.providedMeals : [req.body.providedMeals];
        const dailyAllowances = Array.isArray(req.body.dailyAllowance) ? req.body.dailyAllowance : [req.body.dailyAllowance];

        // Initialize total daily allowances accumulator.
        let skupnoDnevnice = 0;

        // Delete old daily allowance entries.
        db.prepare(`DELETE FROM obracun_dnevnice WHERE obracun_id = ?`).run(obracun_id);

        // Insert new daily allowance entries for each travel date.
        travelDates.forEach((date, index) => {
            // Convert daily allowance to number.
            const dnevnica = parseFloat(dailyAllowances[index] || 0);
            // Get provided meals information.
            const obroki = providedMeals[index] || '';

            // Add this day's allowance to running total.
            skupnoDnevnice += dnevnica;

            // Insert daily allowance entry into database.
            db.prepare(`
                INSERT INTO obracun_dnevnice (obracun_id, datum, zagotovljeni_obroki, dnevnica)
                VALUES (?, ?, ?, ?)
            `).run(obracun_id, date, obroki, dnevnica);
        });

        // STEP 3: Save mileage reimbursement.
        // Convert mileage values to numbers.
        const kilometri_naprej = parseFloat(req.body.kilometri_naprej || 0);
        const kilometri_nazaj = parseFloat(req.body.kilometri_nazaj || 0);
        const obracun_kilometrine_naprej = parseFloat(req.body.obracun_kilometrine_naprej || 0);
        const obracun_kilometrine_nazaj = parseFloat(req.body.obracun_kilometrine_nazaj || 0);

        // Calculate total mileage reimbursement.
        let skupnoKilometrina = obracun_kilometrine_naprej + obracun_kilometrine_nazaj;

        // Delete old mileage entries.
        db.prepare(`DELETE FROM obracun_kilometrine WHERE obracun_id = ?`).run(obracun_id);

        // Insert outbound trip mileage if kilometers exist.
        if (kilometri_naprej > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'naprej',
                lokacija_odhoda,
                lokacija_prihoda,
                kilometri_naprej,
                0.43,
                obracun_kilometrine_naprej
            );
        }

        // Insert return trip mileage if kilometers exist.
        if (kilometri_nazaj > 0) {
            db.prepare(`
                INSERT INTO obracun_kilometrine 
                (obracun_id, smer, lokacija_odhoda, lokacija_prihoda, kilometri, cena_na_km, obracun)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                obracun_id,
                'nazaj',
                lokacija_prihoda,
                lokacija_odhoda,
                kilometri_nazaj,
                0.43,
                obracun_kilometrine_nazaj
            );
        }

        // STEP 4: Save receipts and attachments.
        // Convert receipt data to arrays for consistent processing.
        const racuniPodjetja = Array.isArray(req.body.racun_podjetje) ? req.body.racun_podjetje : [req.body.racun_podjetje];
        const opisStroska = Array.isArray(req.body.opis_stroska) ? req.body.opis_stroska : [req.body.opis_stroska];
        const racuniZneski = Array.isArray(req.body.znesek_racuna) ? req.body.znesek_racuna : [req.body.znesek_racuna];

        // Initialize receipt total accumulator and receipt ID storage.
        let skupnoRacuni = 0;
        const receiptIds = [];

        // Capture existing receipt attachments before deleting old receipts.
        const previousAttachments = captureReceiptAttachments(obracun_id);

        // Delete old receipt entries.
        db.prepare(`DELETE FROM obracun_racuni WHERE obracun_id = ?`).run(obracun_id);

        // Insert new receipt entries for each receipt amount.
        racuniZneski.forEach((znesek, index) => {

            // Only insert if receipt has a valid positive amount.
            if (znesek && parseFloat(znesek) > 0) {

                // Convert receipt amount to number.
                const amount = parseFloat(znesek);

                // Add this receipt to running total.
                skupnoRacuni += amount;

                // Insert receipt into database and store its new ID.
                const receiptResult = db.prepare(`
                    INSERT INTO obracun_racuni (obracun_id, podjetje, opis_stroska, znesek)
                    VALUES (?, ?, ?, ?)
                `).run(
                    obracun_id,
                    racuniPodjetja[index] || '',
                    opisStroska[index] || '',
                    amount
                );
                receiptIds[index] = receiptResult.lastInsertRowid;
            }
        });

        // Save new receipt file attachments to the database.
        saveReceiptAttachments(req.files, receiptIds);
        // Restore previous attachments with new receipt IDs for updated receipts.
        restoreReceiptAttachments(previousAttachments, receiptIds);

        // STEP 5: Calculate total expenses.
        const skupni_stroski = skupnoDnevnice + skupnoKilometrina + skupnoRacuni;

        // STEP 6: Update billing record with totals and timestamps.
        db.prepare(`
            UPDATE obracun 
            SET 
                skupni_stroski = ?,
                placilo_zaposlenemu = ?,
                datum_spremembe = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(skupni_stroski, placilo_zaposlenemu, obracun_id);

        // STEP 7: Change travel order status to Completed to finalize the travel order.
        db.prepare(`
            UPDATE potni_nalogi
            SET status = 'Completed'
            WHERE id = ?
        `).run(potni_nalog_id);

        // Send success response with billing summary.
        res.json({
            success: true,
            obracun_id: obracun_id,
            povzetek: {
                dnevnice: skupnoDnevnice.toFixed(2),
                kilometrina: skupnoKilometrina.toFixed(2),
                racuni: skupnoRacuni.toFixed(2),
                skupaj: skupni_stroski.toFixed(2)
            }
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri končanju obračuna:", error);
        // Send error response with error details.
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


// FUNCTION FOR CREATING USERS
// Create a new user account with encrypted password and default vehicle information.
app.post("/api/admin/dodaj_user", requireAdmin, async (req, res) => {
    try {
        // Extract user information from request body.
        const {
            ime,
            priimek,
            prebivalisce,
            username,
            geslo,
            delovno_mesto,
            role,
            registerska,
            vin,
            status
        } = req.body;

        // Initialize variable to store encrypted password.
        let hashedPassword;

        // Check if password is already hashed with bcrypt (starts with $2a, $2b, or $2y).
        const isBcryptHash =
            typeof geslo === "string" &&
            /^\$2[aby]\$\d{2}\$/.test(geslo);

        // Hash password if not already hashed, otherwise use provided hash.
        if (!isBcryptHash) {
            hashedPassword = bcrypt.hashSync(geslo, 10);
        } else {
            hashedPassword = geslo;
        }

        // Prepare SQL insert statement with named parameters.
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (
                ime,
                priimek,
                prebivalisce,
                username,
                geslo,
                delovno_mesto,
                role,
                registerska,
                vin,
                status
            )
            VALUES (
                @ime,
                @priimek,
                @prebivalisce,
                @username,
                @geslo,
                @delovno_mesto,
                @role,
                @registerska,
                @vin,
                @status
            )
        `);

        // Execute insert with all user data.
        const result = insertUser.run({
            ime,
            priimek,
            prebivalisce,
            username,
            geslo: hashedPassword,
            delovno_mesto,
            role,
            registerska,
            vin,
            status
        });

        // Check if user was inserted; 0 changes means username already exists.
        if (result.changes === 0) {
            return res.status(409).json({
                success: false,
                message: "Uporabnik že obstaja."
            });
        }

        // Send success response with new user ID.
        res.status(201).json({
            success: true,
            message: "Uporabnik je bil uspešno dodan.",
            userId: result.lastInsertRowid
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri dodajanju uporabnika:", error);

        // Send error response to client.
        res.status(500).json({
            success: false,
            message: "Napaka pri dodajanju uporabnika."
        });
    }
});


// FUNCTION FOR UPDATING USERS
// Modify an existing user account with encrypted password and vehicle information.
app.post("/api/admin/posodobi_user", requireAdmin, async (req, res) => {
    try {

        // Extract user information and ID from request body.
        const {
            id,
            ime,
            priimek,
            prebivalisce,
            username,
            geslo,
            delovno_mesto,
            role,
            registerska,
            vin,
            status
        } = req.body;

        // Validate that user ID is provided.
        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Manjka ID uporabnika."
            });
        }

        const existingUser = db.prepare("SELECT id, geslo FROM users WHERE id = ?").get(id);
        if (!existingUser) {
            return res.status(404).json({ success: false, message: "Uporabnik ne obstaja." });
        }
        const hashedPassword = geslo
            ? await bcrypt.hash(geslo, 10)
            : existingUser.geslo;

        // Prepare SQL update statement with named parameters.
        // Note: User ID is not changed, only other fields are updated.
        const updateUser = db.prepare(`
            UPDATE users
            SET
                ime = @ime,
                priimek = @priimek,
                prebivalisce = @prebivalisce,
                username = @username,
                geslo = @geslo,
                delovno_mesto = @delovno_mesto,
                role = @role,
                registerska = @registerska,
                vin = @vin,
                status = @status 
            WHERE id = @id
        `);

        // Execute update with all user data.
        const result = updateUser.run({
            id,
            ime,
            priimek,
            prebivalisce,
            username,
            geslo: hashedPassword,
            delovno_mesto,
            role,
            registerska,
            vin,
            status
        });

        // Check if user was updated; 0 changes means user ID doesn't exist.
        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Uporabnik ne obstaja."
            });
        }

        // Send success response with updated user ID.
        res.status(200).json({
            success: true,
            message: "Uporabnik je bil uspešno posodobljen.",
            userId: id
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri posodabljanju uporabnika:", error);

        // Send error response to client.
        res.status(500).json({
            success: false,
            message: "Napaka pri posodabljanju uporabnika."
        });
    }
});


// FUNCTION FOR CREATING NEW DAILY ALLOWANCE
// Add a new country with its daily allowance rates for different hour categories.
app.post("/api/admin/dodaj_dnevnico", requireAdmin, (req, res) => {
    try {

        // Extract daily allowance information from request body.
        const {
            dnevnica_drzava,
            dnevnica_valuta,
            dnevnica_14_celota,
            dnevnica_8_celota,
            dnevnica_6_celota
        } = req.body

        // Clean and validate country name.
        const country = String(dnevnica_drzava || "").trim();

        // Convert currency code to symbol, or use provided value if not recognized.
        const currency = {
            EUR: "€",
            USD: "$",
            GBP: "£"
        }[String(dnevnica_valuta || "").trim()] || String(dnevnica_valuta || "").trim();

        // Convert daily allowance rates to numbers for all hour categories.
        const rates = [dnevnica_14_celota, dnevnica_8_celota, dnevnica_6_celota]
            .map(Number);

        // Validate that all required fields are provided and valid.
        if (!country || !currency || rates.some(rate => !Number.isFinite(rate) || rate < 0)) {
            return res.status(400).json({
                success: false,
                message: "Vnesite državo, valuto in veljavne zneske dnevnice."
            });
        }

        // Check if country already exists in database to prevent duplicates.
        const obstojecaDrzava = db.prepare(`
            SELECT id
            FROM drzave
            WHERE naziv = ?
        `).get(country);

        // Return error if country already exists.
        if (obstojecaDrzava) {
            return res.status(400).json({
                success: false,
                message: "Ta država je že v seznamu držav."
            });
        }

        // STEP 1: Insert new country into database.
        const drzavaStmt = db.prepare(`
            INSERT INTO drzave (
                naziv,
                valuta
            )
            VALUES (?, ?)
        `);

        const drzavaResult = drzavaStmt.run(
            country,
            currency
        );

        // Get the ID of the newly created country.
        const drzava_id = drzavaResult.lastInsertRowid;

        // STEP 2: Insert daily allowance rates for the new country.
        const dnevnicaStmt = db.prepare(`
            INSERT INTO dnevnice (
                drzava_id,
                dnevnica14,
                dnevnica8,
                dnevnica6
            )
            VALUES (?, ?, ?, ?)
        `);

        dnevnicaStmt.run(
            drzava_id,
            rates[0],
            rates[1],
            rates[2]
        );

        // Send success response to client.
        res.json({
            success: true,
            message: "Dnevnica je bila uspešno dodana."
        });

    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri dodajanju dnevnice:", error);

        // Send error response to client.
        res.status(500).json({
            success: false,
            message: "Napaka pri shranjevanju dnevnice."
        });
    }
});


// FUNCTION FOR COUNTING ALL USERS
app.get("/api/admin/count_users", requireAdmin, async (req, res) => {
    try {
        const totalResults = db.prepare(`
            SELECT COUNT(*) AS total 
            FROM users
        `).get();

        const totalAdmins = db.prepare(`
            SELECT COUNT(*) AS admins
            FROM users
            WHERE role = 'admin'
        `).get();

        res.json({
            total: totalResults.total,
            admins: totalAdmins.admins
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Napaka pri štetju uporabnikov"
        });
    }
});


// FUNCTION FOR GETTING ALL USERS INFO -- SETTINGS
app.get("/api/admin/all_user_info", requireAdmin, async (req, res) => {
    try {

        const stmt = db.prepare(`
            SELECT id, ime, priimek, prebivalisce, username, delovno_mesto, role, status, registerska, vin
            FROM users
        `).all();

        res.json(stmt);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Napaki pri dobivanju informacij"
        });
    }
});


// FUNCTION FOR GETTING ALL USERS INFO -- SETTINGS
app.get("/api/admin/all_dnevnice_info", requireAdmin, async (req, res) => {
    try {

       const dnevnice = db.prepare(`
            SELECT
                dnevnice.id,
                drzave.naziv AS drzava,
                drzave.valuta,
                dnevnice.dnevnica14,
                dnevnice.dnevnica8,
                dnevnice.dnevnica6
            FROM dnevnice
            JOIN drzave
                ON dnevnice.drzava_id = drzave.id
        `).all();

        res.json(dnevnice);
        
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Napaki pri dobivanju informacij"
        });
    }
});


// GET DAILY ALLOWANCE BY ID
// Fetch a specific daily allowance record with country and currency information.
app.get("/api/admin/dnevnica/:id", requireAdmin, (req, res) => {

    // Query database for daily allowance and join with country details.
    const data = db.prepare(`
        SELECT dnevnice.id, drzave.naziv AS drzava, drzave.valuta,
               dnevnice.dnevnica14, dnevnice.dnevnica8, dnevnice.dnevnica6
        FROM dnevnice JOIN drzave ON drzave.id = dnevnice.drzava_id
        WHERE dnevnice.id = ?
    `).get(req.params.id);

    // Return error if daily allowance doesn't exist.
    if (!data) return res.status(404).json({ success: false, message: "Dnevnica ni bila najdena." });

    // Send daily allowance data with country info to client.
    res.json(data);
});


// UPDATE DAILY ALLOWANCE BY ID
// Modify an existing daily allowance record with country, currency, and rate information.
app.put("/api/admin/dnevnica/:id", requireAdmin, (req, res) => {

    // Extract daily allowance information from request body.
    const { dnevnica_drzava, dnevnica_valuta, dnevnica_14_celota, dnevnica_8_celota, dnevnica_6_celota } = req.body;

    // Fetch daily allowance to get country ID and verify it exists.
    const dnevnica = db.prepare("SELECT drzava_id FROM dnevnice WHERE id = ?").get(req.params.id);

    // Return error if daily allowance doesn't exist.
    if (!dnevnica) return res.status(404).json({ success: false, message: "Dnevnica ni bila najdena." });
    try {

        // Clean and validate country name.
        const country = String(dnevnica_drzava || "").trim();

        // Convert currency code to symbol, or use provided value if not recognized.
        const currency = {
            EUR: "€",
            USD: "$",
            GBP: "£"
        }[String(dnevnica_valuta || "").trim()] || String(dnevnica_valuta || "").trim();

        // Convert daily allowance rates to numbers for all hour categories.
        const rates = [dnevnica_14_celota, dnevnica_8_celota, dnevnica_6_celota]
            .map(Number);

        // Validate that all required fields are provided and valid.
        if (!country || !currency || rates.some(rate => !Number.isFinite(rate) || rate < 0)) {
            return res.status(400).json({
                success: false,
                message: "Vnesite državo, valuto in veljavne zneske dnevnice."
            });
        }

        // Check if another country with the same name already exists (excluding current country).
        const duplicate = db.prepare(`
            SELECT id FROM drzave
            WHERE naziv = ? AND id != ?
        `).get(country, dnevnica.drzava_id);

        // Return error if duplicate country name found.
        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Ta država je že v seznamu držav."
            });
        }

        // Update country name and currency in database.
        db.prepare("UPDATE drzave SET naziv = ?, valuta = ? WHERE id = ?")
            .run(country, currency, dnevnica.drzava_id);

        // Update daily allowance rates for all hour categories.
        db.prepare("UPDATE dnevnice SET dnevnica14 = ?, dnevnica8 = ?, dnevnica6 = ? WHERE id = ?")
            .run(rates[0], rates[1], rates[2], req.params.id);

        // Send success response to client.
        res.json({ success: true, message: "Dnevnica je bila uspešno posodobljena." });
    } catch (error) {
        // Log error for debugging purposes.
        console.error("Napaka pri posodabljanju dnevnice:", error);
        // Send error response with error details.
        res.status(500).json({ success: false, message: error.message || "Dnevnice ni mogoče posodobiti." });
    }
});


// // FUNCTION FOR GETTING ONE USER INFO -- SETTINGS UPDATE USER INFO
// Fetch all user information for editing in admin settings panel.
app.get("/api/admin/users/:userId", requireAdmin, async (req, res) => {

    // Extract user ID from URL parameters.
    const { userId } = req.params;

    // Validate that user ID is provided.
    if (!userId) {
            return res.status(400).json({ message: "Manjka ID potnega naloga" });
        }

    try {

        // Query database for user by ID and fetch all user data.
        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE id = ?
        `).get(userId);

        // Return error if user doesn't exist.
        if (!user) {
            return res.status(404).json({
                message: "Uporabnik ni najden"
            });
        }

        // Send user information to client for editing.
        res.json({
            ime: user.ime,
            priimek: user.priimek,
            registerska: user.registerska,
            vin: user.vin,
            username: user.username,
            prebivalisce: user.prebivalisce,
            delovno_mesto: user.delovno_mesto,
            role: user.role,
            status: user.status
        })
    } catch (error) {
        // Log error for debugging purposes.
        console.error(error);
        // Send error response to client.
        res.status(500).json({
            error: "Napaki pri dobivanju informacij"
        });
    }
});


// GET STATISTICS FOR DISPLAYING INFORMATION ABOUT EACH TRAVEL ORDER CATEGORY
// Fetch all travel order statuses to display statistics and dashboard information.
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
        // Query database for all travel order statuses.
        const stats = db.prepare(`
            SELECT status 
            FROM potni_nalogi
        `).all();

        // Send travel order statistics to client.
        res.json(stats);

    } catch (error) {
        // Log error for debugging purposes.
        console.error(error);
    }
})


// ADD FUNCTION FOR AUTO UPDATE STATUS IN TRAVEL ORDERS (ACIVE->NOT PAID, APPROVED->ACTIVE)
cron.schedule('* * * * *', () => {

    try {

        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; 

        // Update APPROVED -> NOT PAID (if travel order was made in the past).
        const result3 = db.prepare(`
            UPDATE potni_nalogi
            SET status = 'Not paid'
            WHERE status = 'Approved' AND datum_prihoda < ?
        `).run(todayString);

        // Update APPROVED -> ACTIVE (if departure date is today or past).
        const result2 = db.prepare(`
            UPDATE potni_nalogi
            SET status = 'Active'
            WHERE status = 'Approved' AND datum_odhoda <= ?
        `).run(todayString);
 
        // Update ACTIVE -> NOT PAID (if arrival date has passed).
        const result1 = db.prepare(`
            UPDATE potni_nalogi
            SET status = 'Not paid'
            WHERE status = 'Active' AND datum_prihoda < ?
        `).run(todayString);
        
    } catch (error) {
        console.error('Error updating travel order statuses:', error);
    }

});


// PORT LISTEN
// Error handling middleware for file upload errors and other server errors.
app.use((error, req, res, next) => {

    // Check if error is file size exceeding limit (10 MB per file).
    if (error?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ success: false, message: "Datoteka je prevelika. Največja dovoljena velikost je 10 MB." });
    }

    // Check if error is exceeding maximum file count limit (10 files per upload).
    if (error?.code === "LIMIT_FILE_COUNT") {
        return res.status(413).json({ success: false, message: "Izberete lahko največ 10 datotek." });
    }

    // Log any unhandled errors for debugging purposes.
    console.error("Neobdelana napaka:", error);

    // Send generic error response to client for unhandled errors.
    res.status(500).json({ success: false, message: "Na strežniku je prišlo do napake." });
});

// Start server and listen on the specified port.
app.listen(PORT, () => {
    // Log confirmation message when server starts successfully.
    console.log(`Server running at http://localhost:${PORT}`);
});