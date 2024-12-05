const express = require("express");
const session = require("express-session");
require('dotenv').config();
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/registerValidation");
const { validationResult } = require('express-validator');
const axios = require('axios');
const { OpenWeatherAPI } = require("openweather-api-node")
const translate = require('@iamtraction/google-translate');
router.use(express.json());
const {
    getRandomEasyQuestion,
    getRandomMediumQuestion,
    getRandomHardQuestion
} = require('../public/kvizAlgorithm');

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
    console.log(req.session);
    if (req.session.user) {
        next(); 
    } else {
        res.redirect("/login"); 
    }
}


router.get("/", isAuthenticated, async (req, res) => {
    try {
        // 1. Fetch a random city from your database
        const query = "SELECT glavniGrad FROM Drzava ORDER BY RAND() LIMIT 1"; // Replace with your actual table and column names
        connection.query(query, async (err, results) => {
            if (err) {
                console.error('Error fetching city from DB:', err);
                return res.status(500).send('Error fetching city');
            }

            const city = results[0]; // Assuming the city name is in the `glavniGrad` column
            console.log(city.glavniGrad);
            if (!city) {
                return res.status(404).redirect('/');
            }

            try {
                // 2. Translate the city name to English (if necessary)
                const translatedCity = await translate(city.glavniGrad, { to: 'en' })
                    .then(res => res.text)
                    .catch(err => {
                        console.error('Error translating city name:', err);
                        throw new Error('Translation failed');
                    });
                    console.log(translatedCity);
                // 3. Fetch weather data using OpenWeatherAPI
                const apiKey = '6b3f90733d55f97c9970464fd39a253e'; // Replace with your actual API key
                const weather = new OpenWeatherAPI({
                    key: apiKey,
                    locationName: translatedCity,
                    units: "metric" // Use "metric" for Celsius, or "imperial" for Fahrenheit
                });
                let weatherData = null;
                try {
                    // Pokušaj preuzimanja podataka o vremenu
                    weatherData = await weather.getCurrent();
                
                    // Proveri da li podaci postoje i da li su u ispravnom formatu
                    if (weatherData && weatherData.weather) {
                        console.log('Podaci o vremenu su uspešno preuzeti:', weatherData);
                        // Dalja obrada podataka...
                    } else {
                        console.log('Nema podataka o vremenu');
                    }
                } catch (error) {
                    // Ako dođe do greške (npr. nevalidne koordinate, loša mreža, API greška)
                    console.error('Greška pri preuzimanju vremenskih podataka:', error);
                    weatherData = null;
                }

                // 4. Render the index page with the city and weather data
                res.render("index", {
                    title: "GeoGuess",
                    user: req.session.user,
                    city: { original: city.glavniGrad, translated: translatedCity },
                    weather: weatherData,
                });
            } catch (weatherError) {
                console.error('Error fetching weather data:', weatherError);
                return res.status(500).send('Error fetching weather data');
            }
        });
    } catch (error) {
        console.error('Error in route:', error);
        return res.status(500).send('Internal server error');
    }
});
router.get("/kviz", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }

    const query = `
        SELECT 
    RandomPitanja.PitanjeID AS PitanjeID,
    RandomPitanja.tekstPitanja AS tekstPitanja, 
    RandomPitanja.tipPitanja AS tipPitanja, 
    RandomPitanja.tezina AS tezina, 
    Drzava.naziv AS drzavaNaziv, 
    CASE 
        WHEN RandomPitanja.tipPitanja = 'Glavni grad' THEN Drzava.glavniGrad
        WHEN RandomPitanja.tipPitanja = 'Populacija' THEN Drzava.brojStanovnika
        WHEN RandomPitanja.tipPitanja = 'Zastava' THEN Drzava.zastava
        WHEN RandomPitanja.tipPitanja = 'Kontinent' THEN Drzava.kontinent
    END AS tacanOdgovor
FROM (
    SELECT * FROM (SELECT * FROM Pitanje WHERE tezina = 'Lako' ORDER BY RAND() LIMIT 10) AS LakoPitanja
    UNION ALL
    SELECT * FROM (SELECT * FROM Pitanje WHERE tezina = 'Srednje' ORDER BY RAND() LIMIT 10) AS SrednjePitanja
    UNION ALL
    SELECT * FROM (SELECT * FROM Pitanje WHERE tezina = 'Teško' ORDER BY RAND() LIMIT 10) AS TeskoPitanja
) AS RandomPitanja
JOIN Drzava ON RandomPitanja.DrzavaID = Drzava.DrzavaID;


    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching questions:", err);
            return res.status(500).send("Server Error");
        }

        // Uzmi 3 nasumična netačna odgovora za svako pitanje
        const questionsWithAnswers = [];

        results.forEach((question) => {
            switch(question.tipPitanja){
                case "Glavni grad":
                const incorrectQuery1 = `
                    SELECT 
                        Drzava.glavniGrad AS netacanOdgovor
                    FROM 
                        Drzava
                    WHERE 
                        Drzava.DrzavaID != (SELECT DrzavaID FROM Pitanje WHERE PitanjeID = ? AND tipPitanja LIKE ? LIMIT 1)
                    ORDER BY 
                        RAND()
                    LIMIT 3;
                `;

                connection.query(incorrectQuery1, [question.PitanjeID, question.tipPitanja], (err, incorrectResults) => {
                    if (err) {
                        console.error("Error fetching incorrect answers:", err);
                        return res.status(500).send("Server Error");
                    }

                    // Kombinuj tačan odgovor sa netačnim
                    const answers = [...incorrectResults.map(r => r.netacanOdgovor)];
                    // Randomizuj odgovore
                    const shuffledAnswers = answers.sort(() => Math.random() - 0.5);

                    questionsWithAnswers.push({
                        ...question,
                        answers: shuffledAnswers
                    });
                    // Kada se svi odgovori dodaju, renderuj kviz
                    if (questionsWithAnswers.length === results.length) {
                        res.render("kviz", {
                            title: "GeoGuess Kviz",
                            user: req.session.user,
                            questions: questionsWithAnswers
                        });
                    }
                    
                });
                break;
                case "Populacija":
                    const incorrectQuery2 = `
                    SELECT 
                        Drzava.brojStanovnika AS netacanOdgovor
                    FROM 
                        Drzava
                    WHERE 
                        Drzava.DrzavaID != (SELECT DrzavaID FROM Pitanje WHERE PitanjeID = ? AND tipPitanja LIKE ? LIMIT 1)
                    ORDER BY 
                        RAND()
                    LIMIT 3;
                `;

                connection.query(incorrectQuery2, [question.PitanjeID, question.tipPitanja], (err, incorrectResults) => {
                    if (err) {
                        console.error("Error fetching incorrect answers:", err);
                        return res.status(500).send("Server Error");
                    }

                    // Kombinuj tačan odgovor sa netačnim
                    const answers = [...incorrectResults.map(r => r.netacanOdgovor)];
                    // Randomizuj odgovore
                    const shuffledAnswers = answers.sort(() => Math.random() - 0.5);

                    questionsWithAnswers.push({
                        ...question,
                        answers: shuffledAnswers
                    });
                    // Kada se svi odgovori dodaju, renderuj kviz
                    if (questionsWithAnswers.length === results.length) {
                        res.render("kviz", {
                            title: "GeoGuess Kviz",
                            user: req.session.user,
                            questions: questionsWithAnswers
                        });
                    }
                  
                });
                break;
                case "Kontinent":
                    const incorrectQuery3 = `
                    SELECT DISTINCT
                        Drzava.kontinent AS netacanOdgovor
                    FROM 
                        Drzava
                    WHERE 
                        Drzava.DrzavaID != (SELECT DrzavaID FROM Pitanje WHERE PitanjeID = ? AND tipPitanja LIKE ? LIMIT 1)
                    ORDER BY 
                        RAND()
                    LIMIT 3;
                `;

                connection.query(incorrectQuery3, [question.PitanjeID, question.tipPitanja], (err, incorrectResults) => {
                    if (err) {
                        console.error("Error fetching incorrect answers:", err);
                        return res.status(500).send("Server Error");
                    }

                    // Kombinuj tačan odgovor sa netačnim
                    const answers = [...incorrectResults.map(r => r.netacanOdgovor)];
                    // Randomizuj odgovore
                    const shuffledAnswers = answers.sort(() => Math.random() - 0.5);

                    questionsWithAnswers.push({
                        ...question,
                        answers: shuffledAnswers
                    });
                    // Kada se svi odgovori dodaju, renderuj kviz
                    if (questionsWithAnswers.length === results.length) {
                        res.render("kviz", {
                            title: "GeoGuess Kviz",
                            user: req.session.user,
                            questions: questionsWithAnswers
                        });
                    }
                    

                  
                });
                break;
                case "Zastava":
                    const incorrectQuery4 = `
                    SELECT 
                        Drzava.zastava AS netacanOdgovor
                    FROM 
                        Drzava
                    WHERE 
                        Drzava.DrzavaID != (SELECT DrzavaID FROM Pitanje WHERE PitanjeID = ? AND tipPitanja LIKE ? LIMIT 1)
                    ORDER BY 
                        RAND()
                    LIMIT 3;
                `;

                connection.query(incorrectQuery4, [question.PitanjeID, question.tipPitanja], (err, incorrectResults) => {
                    if (err) {
                        console.error("Error fetching incorrect answers:", err);
                        return res.status(500).send("Server Error");
                    }

                    // Kombinuj tačan odgovor sa netačnim
                    const answers = [...incorrectResults.map(r => r.netacanOdgovor)];
                    // Randomizuj odgovore
                    const shuffledAnswers = answers.sort(() => Math.random() - 0.5);

                    questionsWithAnswers.push({
                        ...question,
                        answers: shuffledAnswers
                    });
                    // Kada se svi odgovori dodaju, renderuj kviz
                    if (questionsWithAnswers.length === results.length) {
                        res.render("kviz", {
                            title: "GeoGuess Kviz",
                            user: req.session.user,
                            questions: questionsWithAnswers
                        });
                    }
                    

                  
                });
            }
            
            
        });
    });
});
router.post('/api/quiz/results', async (req, res) => {
    const { user , score } = req.body;
    const query = 'INSERT INTO RangLista (KorisnikID, bodovi, datum) SELECT KorisnikID, ?, NOW() FROM Korisnik WHERE nickname = ?;';
    const values = [score, user];
    try {
        connection.query(query, values, (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ message: 'Greška pri unosu u RangLista', error });
            }

            console.log(res);
            res.json({ message: 'Rezultati su uspešno sačuvani!', data: results });
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Došlo je do greške pri obradi', error });
    }
});
router.get("/admin", (req, res) => {
    if (!req.session.user.admin) {
        return res.redirect("/");
    }
    const query = `
        SELECT *
        FROM Korisnik 
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching leaderboard:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log(results);
        res.render("admin", { title: "GeoGuess Admin", korisnici: results, user: req.session.user });
    });
});
router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("login",{title: "GeoGuess Prijava", user: "", error: ""});
});

router.get("/ranglista", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    const query = `
        SELECT k.nickname, r.bodovi, r.datum
        FROM RangLista r
        INNER JOIN Korisnik k ON r.KorisnikID = k.KorisnikID
        ORDER BY r.bodovi DESC, r.datum DESC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching leaderboard:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log(results);
        res.render("ranglista", { title: "GeoGuess Rang Lista", rezultati: results, user: req.session.user });
    });
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
                req.session.user = { username: results[0].nickname, admin: results[0].admin};
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

        res.render("login", { error: "Netacna lozinka ili korisnicko ime", title: "GeoGuess Prijava", user: "" });
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
    let username = "";
    if(req.session.user)
    {
        username = req.session.user;
    }
    res.render("register", { error: "",title: "GeoGuess Registracija", user: username, errors: [] }); // Pretpostavljamo da postoji odgovarajuća view datoteka
});

// POST: Obrada podataka za registraciju
router.post('/register', registerValidation, async (req, res) => {
    // Validate the form inputs
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Validation errors detected
        return res.status(400).render('register', {
            errors: errors.array(), // Pass validation errors
            formData: req.body, // Retain form input data
            title: 'GeoGuess Register', // Page title
            user: req.session.user || '', // Pass session user (if available)
            error: null // No global error message
        });
    }

    const { ime, prezime, nickname, email, lozinka, date } = req.body;

    try {
        // Check if the user already exists (email or nickname)
        const checkQuery = "SELECT * FROM Korisnik WHERE email = ? OR nickname = ?";
        const existingUsers = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [email, nickname], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
        
        if (existingUsers.length > 0) {
            // User with email or nickname already exists
            return res.status(400).render('register', {
                errors: [], // No validation errors
                formData: req.body, // Retain form input data
                title: 'GeoGuess Registracija', 
                user: req.session.user || '',
                error: 'Email ili korisničko ime već postoje!' // Global error message
            });
        }
        

        // Hash the password
        const hashedPassword = await bcrypt.hash(lozinka, 10);

        // Create a new user instance
        const newUser = new Korisnik(ime, prezime, nickname, email, hashedPassword, date);

        // Save the user to the database
        await newUser.save();

        // Store the user in the session
        req.session.user = { username: newUser.nickname, admin: false };
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).send('Error saving session');
            }
            // Redirect to the homepage after successful registration
            res.redirect('/');
        });
    } catch (error) {
        console.error('Error during registration:', error);

        // Render the registration page with an error message
        res.status(500).render('register', {
            errors: [], // No validation errors
            formData: req.body, // Retain form input data
            title: 'GeoGuess Registracija',
            user: req.session.user || '',
            error: 'Došlo je do greške. Pokušajte ponovo.' // General error message
        });
    }
});


router.post('/delete/:id', async (req, res) => {
    try {
        // Check if the user exists
        const checkQuery = "SELECT * FROM Korisnik WHERE KorisnikID = ?";
        const user = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [req.params.id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (user.length === 0) {
            // User not found
            return res.status(404).redirect("/admin");
        }

        console.log(req.session.user.username);
        console.log(user[0].nickname);

        // If the current user is trying to delete their own account


        // Delete the user from RangLista
        const deleteQuery = "DELETE FROM RangLista WHERE KorisnikID = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [req.params.id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        // Delete the user from Korisnik
        const deleteQuery2 = "DELETE FROM Korisnik WHERE KorisnikID = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery2, [req.params.id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        return res.redirect("/admin"); // Ensure only one response is sent here

    } catch (error) {
        console.error('Error during user deletion:', error);
        return res.status(500).redirect("/admin"); // Handle errors gracefully and ensure one response
    }
});

router.post('/upgrade/:id', async (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).redirect("/admin");
    }

    try {
        const deleteQuery = "UPDATE Korisnik SET admin = 1 WHERE KorisnikID = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [id], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        return res.redirect("/admin"); // Ensure one response here

    } catch (error) {
        console.error('Error during upgrade:', error);
        return res.status(500).redirect("/admin"); // Handle errors gracefully and ensure one response
    }
});



router.post('/adminDeleteQuestion', async (req, res) => {
    const { imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave && !tipPitanja) {
        return res.status(400).redirect("/admin");
    }

    try {
        // Check if the user exists
        const checkQuery = "SELECT * FROM Pitanje as p JOIN Drzava as d ON p.DrzavaID = d.DrzavaID WHERE  d.naziv = ? AND p.tipPitanja = ?";
        const quest = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [imeDrzave, tipPitanja], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (quest.length === 0) {
            // User not found
            return res.status(404).redirect("/admin");
        }

        // Delete the user
        const deleteQuery = "DELETE p FROM Pitanje as p JOIN Drzava as d ON p.DrzavaID = d.DrzavaID WHERE d.naziv = ? AND p.tipPitanja = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [imeDrzave, tipPitanja], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
            
        });
        res.redirect("/admin");
        
        // Redirect to a success page or display a success message
        res.redirect("/admin");
        
    } catch (error) {
        console.error('Error during user deletion:', error);

        // Render the deletion page with a general error message
        res.status(500).redirect("/admin");
    }
});

router.post('/adminInsertQuestion', async (req, res) => {
    const { tekstPitanja, tezina, imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave || !tipPitanja || !tekstPitanja || !tezina) {
        return res.status(400).render('admin', {
            errors: [{ msg: 'Sva polja su obavezna!' }], // Validation error
            formData: req.body,
            title: 'Insert Question',
            user: req.session.user || '',
        });
    }

    try {
        

        // Delete the user
        const deleteQuery = "INSERT INTO Pitanje(tekstPitanja, tipPitanja, tezina, DrzavaID) VALUES (?,?,?,(SELECT DrzavaID FROM Drzava WHERE naziv like ? LIMIT 1))";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [tekstPitanja, tipPitanja, tezina, imeDrzave], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
            
        });

        
        res.redirect("/admin");
        
        // Redirect to a success page or display a success message
        
        
    } catch (error) {
        console.error('Error during question insertion:', error);

        // Render the deletion page with a general error message
        res.status(500).render('admin', {
            errors: [{ msg: 'Došlo je do greške. Pokušajte ponovo.' }],
            formData: req.body,
            title: 'Insert Question',
            user: req.session.user || '',
        });
    }
});

router.post('/adminUpdateQuestion', async (req, res) => {
    const { tekstPitanja, tezina, imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave && !tipPitanja) {
        return res.status(400).render('adminQuestion', {
            errors: [{ msg: 'Morate uneti ime države i tip pitanja!' }],
            formData: req.body,
            title: 'Update Question',
            user: req.session.user || '',
        });
    }

    try {
        let updateQuery = '';
        let updateValues = [];

        // Update the question text if provided
        if (tekstPitanja) {
            updateQuery = `
                UPDATE Pitanje AS p
                JOIN Drzava AS d ON p.DrzavaID = d.DrzavaID
                SET tekstPitanja = ?
                WHERE d.naziv = ? AND p.tipPitanja = ?
            `;
            updateValues = [tekstPitanja, imeDrzave, tipPitanja];
            await executeUpdateQuery(updateQuery, updateValues);
        }

        // Update the difficulty if provided
        if (tezina) {
            updateQuery = `
                UPDATE Pitanje AS p
                JOIN Drzava AS d ON p.DrzavaID = d.DrzavaID
                SET tezina = ?
                WHERE d.naziv = ? AND p.tipPitanja = ?
            `;
            updateValues = [tezina, imeDrzave, tipPitanja];
            await executeUpdateQuery(updateQuery, updateValues);
        }

        // Update the correct answer if provided
        

        // If nothing is updated
        if (!tekstPitanja && !tezina) {
            return res.status(400).render('admin', {
                errors: [{ msg: 'Morate uneti bar jednu vrednost za ažuriranje!' }],
                formData: req.body,
                title: 'Update Question',
                user: req.session.user || '',
            });
        }

        // Render success message
       res.redirect("/admin");
    } catch (error) {
        console.error('Error during question update:', error);

        // Render the page with a general error message
        res.status(500).render('adminUpdateQuestion', {
            errors: [{ msg: 'Došlo je do greške. Pokušajte ponovo.' }],
            formData: req.body,
            title: 'Update Question',
            user: req.session.user || '',
        });
    }
});

// Helper function to execute queries
async function executeUpdateQuery(query, values) {
    return new Promise((resolve, reject) => {
        connection.query(query, values, (err, results) => {
            if (err) return reject(err);
            resolve(results);
        });
    });
}


router.get('/kvizLaka', (req, res) => {
    getRandomEasyQuestion((err, question) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        if (question) {
            return res.render('question', { question });
        } else {
            return res.send('No questions available.');
        }
    });
});

// Route for fetching a medium difficulty question
router.get('/kvizSrednja', (req, res) => {
    getRandomMediumQuestion((err, question) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        if (question) {
            return res.render('question', { question });
        } else {
            return res.send('No questions available.');
        }
    });
});

// Route for fetching a hard question
router.get('/kvizTeska', (req, res) => {
    getRandomHardQuestion((err, question) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Internal Server Error');
        }
        if (question) {
            return res.render('question', { question });
        } else {
            return res.send('No questions available.');
        }
    });
});

/*router.post('/register', registerValidation, (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      // If there are validation errors, render the form again with the errors
      return res.status(400).render('register', { 
        title: 'Register',
        errors: errors.array(),
        formData: req.body  // Optionally send back the form data
      });
    }
  
    // Proceed with form submission if no errors
    // Here you can insert the data into the database or perform other actions
    res.send('Form is valid and data has been processed!');
  });*/
router.use((req,res) => {
    let username = "";
    if(req.session.user)
    {
        username = req.session.user;
    }
    res.status(404).render("404", {title: "GeoGuess 404", user: username});
})

module.exports = router;
