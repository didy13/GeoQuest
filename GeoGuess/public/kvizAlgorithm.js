const express = require('express');
const mysql = require('mysql');
const path = require('path');
const connection = require("../controller/config");
const Korisnik = require("../models/Korisnik");
const app = express();
const port = 3000;

// Configure EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
Korisnik.setConnection(connection);


// Function to get a random question
function getRandomEasyQuestion(callback) {

// Query to fetch questions based on difficulty
const query = `
    SELECT Pitanje.tekstPitanja, Pitanje.tipPitanja, Pitanje.tezina, Pitanje.tacanOdgovor, Drzava.naziv AS drzavaNaziv
    FROM Pitanje
    JOIN Drzava ON Pitanje.DrzavaID = Drzava.DrzavaID
    WHERE Pitanje.tezina = "Lako"
    ORDER BY RAND()
    LIMIT 1
`;

connection.query(query, (err, results) => {
    if (err) {
        return res.status(500).send("Internal Server Error");
    }

    if (results.length > 0) {
        return res.render("question", { question: results[0] });
    } else {
        return res.send("No questions available for this difficulty.");
    }
});

}
function getRandomMediumQuestion(callback) {
    const query = `
    SELECT Pitanje.tekstPitanja, Pitanje.tipPitanja, Pitanje.tezina, Pitanje.tacanOdgovor, Drzava.naziv AS drzavaNaziv
    FROM Pitanje
    JOIN Drzava ON Pitanje.DrzavaID = Drzava.DrzavaID
    WHERE Pitanje.tezina = "Srednje"
    ORDER BY RAND()
    LIMIT 1
`;

connection.query(query, (err, results) => {
    if (err) {
        return res.status(500).send("Internal Server Error");
    }

    if (results.length > 0) {
        return res.render("question", { question: results[0] });
    } else {
        return res.send("No questions available for this difficulty.");
    }
})
}
function getRandomHardQuestion(callback) {
    const query = `
    SELECT Pitanje.tekstPitanja, Pitanje.tipPitanja, Pitanje.tezina, Pitanje.tacanOdgovor, Drzava.naziv AS drzavaNaziv
    FROM Pitanje
    JOIN Drzava ON Pitanje.DrzavaID = Drzava.DrzavaID
    WHERE Pitanje.tezina = "Teško"
    ORDER BY RAND()
    LIMIT 1
`;

    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).send("Internal Server Error");
        }

        if (results.length > 0) {
            return res.render("question", { question: results[0] });
        } else {
            return res.send("No questions available for this difficulty.");
        }
    })
}
// Route for displaying the question
app.get('/kvizLaka', (req, res) => {
    getRandomEasyQuestion((err, question) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (question) {
            res.render('question', { question });
        } else {
            res.send('No questions available.');
        }
    });
});
app.get('/kvizSrednja', (req, res) => {
    getRandomMediumQuestion((err, question) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (question) {
            res.render('question', { question });
        } else {
            res.send('No questions available.');
        }
    });
});
app.get('/kvizTeska', (req, res) => {
    getRandomHardQuestion((err, question) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }
        if (question) {
            res.render('question', { question });
        } else {
            res.send('No questions available.');
        }
    });
});
