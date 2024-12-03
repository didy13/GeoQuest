const express = require("express");
const session = require("express-session");
require('dotenv').config();
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");
const Korisnik = require("../models/Korisnik");

Korisnik.setConnection(connection);

router.use(session({
    secret: process.env.SESSION_SECRET || "defaultsecret", // Proveri da li postoji vrednost u .env
    resave: false, // Nemoj ponovo snimati sesiju ako se ne menja
    saveUninitialized: false, // Nemoj čuvati prazne sesije
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7, // Kolačić traje 7 dana
        secure: false, // Postavi na true ako koristiš HTTPS
        sameSite: "lax" // Poboljšava sigurnost sesije
    }
}));


const isAuthenticated = (req, res, next) =>
{
    if (req.session.user) {
        next(); 
    } else {
        res.redirect("/login"); 
    }
}


router.get("/", isAuthenticated, (req, res) => {
    res.render("index", { title: "Home", user: req.session.user });
});


router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("login");
});


router.post("/login", (req, res) => {
    const { nickname, lozinka } = req.body;
    const query = "SELECT * FROM Korisnik WHERE nickname = ?";

    connection.query(query, [nickname], async (err, results) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        if (results.length > 0) {
            const validPassword = await bcrypt.compare(lozinka, results[0].lozinka);
            if (validPassword) {
                req.session.user = { username: results[0].nickname };
                req.session.save((saveErr) => { // Eksplicitno sačuvaj sesiju
                    if (saveErr) {
                        console.error("Error saving session:", saveErr);
                        return res.status(500).send("Error saving session");
                    }
                    return res.redirect("/");
                });
                return; // Završava funkciju nakon redirect-a
            }
        }
        res.render("login", { error: "Invalid username or password" });
    });
});

router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).send("Unable to log out");
        }
        res.clearCookie("connect.sid", { path: "/" }); // Postavi tačan path ako je drugačiji
        res.redirect("/login");
    });
});

router.get("/register", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("register", { error: "" }); // Pretpostavljamo da postoji odgovarajuća view datoteka
});

// POST: Obrada podataka za registraciju
router.post("/register", async (req, res) => {
    const { ime, prezime, nickname, email, lozinka, datumRodjenja } = req.body;

    try {
        const checkQuery = "SELECT * FROM Korisnik WHERE email = ? OR nickname = ?";
        const [existingUser] = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [email, nickname], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (existingUser) {
            return res.status(400).render("register", { error: "Email ili korisničko ime već postoje!" });
        }

        const hashedPassword = await bcrypt.hash(lozinka, 10);

        const newUser = new Korisnik(ime, prezime, nickname, email, hashedPassword, datumRodjenja);
        await newUser.save();

        req.session.user = { username: newUser.nickname };
        req.session.save((err) => { // Sačuvaj sesiju
            if (err) {
                console.error("Error saving session:", err);
                return res.status(500).send("Error saving session");
            }
            res.redirect("/");
        });
    } catch (error) {
        console.error("Error during registration:", error);
        res.status(500).render("register", { error: "Došlo je do greške. Pokušajte ponovo." });
    }
});



module.exports = router;
