const express = require("express");
const session = require("express-session");
const router = express.Router();
const connection = require("../controller/config");

const crypto = require('crypto');

const secretKey = crypto.randomBytes(64).toString('hex');
router.use(session({
    secret: secretKey,  
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  
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
    const query = "SELECT * FROM Korisnik WHERE nickname = ? AND lozinka = ?";

    connection.query(query, [nickname, lozinka], (err, results) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        if (results.length > 0) {
            req.session.user = {
                id: results[0].KorisnikID,
                username: results[0].nickname
            };
            res.redirect("/");
        } else {
            res.render("login", { error: "Invalid username or password" });
        }
    });
});


router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Unable to log out");
        }
        res.redirect("/login");
    });
});

module.exports = router;
