const express = require("express");
const session = require("express-session");
require('dotenv').config();
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");

router.use(session({
    secret: process.env.SESSION_SECRET,  
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
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
                req.session.user = {
                    id: results[0].KorisnikID,
                    username: results[0].nickname
                };
                return res.redirect("/");
            }
        }
        res.render("login", { error: "Invalid username or password" });
    });
});


router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Unable to log out");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

module.exports = router;
