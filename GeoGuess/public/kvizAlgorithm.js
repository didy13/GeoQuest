const connection = require("../controller/config");

function getRandomEasyQuestion(callback) {
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
            return callback(err);  // Call the callback with error
        }

        callback(null, results[0]);  // Return the question or null if no results
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
            return callback(err);
        }

        callback(null, results[0]);
    });
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
            return callback(err);
        }

        callback(null, results[0]);
    });
}

// Export the functions
module.exports = {
    getRandomEasyQuestion,
    getRandomMediumQuestion,
    getRandomHardQuestion
};
