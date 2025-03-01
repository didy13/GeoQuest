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
const NodeCache = require('node-cache');
router.use(express.json());

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

const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 }); // Cache expires in 5 min

router.get("/", isAuthenticated, async (req, res) => {
    try {
        let cityData = cache.get("randomCity");
        if (!cityData) {
            console.log("Fetching new city from DB...");
            const queryCity = "SELECT glavniGrad FROM Drzava ORDER BY RAND() LIMIT 1";
            const cityResults = await new Promise((resolve, reject) => {
                connection.query(queryCity, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            if (!cityResults.length) return res.status(404).redirect('/');

            cityData = { original: cityResults[0].glavniGrad };
            cache.set("randomCity", cityData);
        }

        console.log("City:", cityData.original);

        // Serve only cached data initially
        let translatedCity = cache.get(`translated-${cityData.original}`);
        

        res.render("index", {
            title: "GeoQuest",
            user: req.session.user,
            city: { original: cityData.original, translated: translatedCity || null },
            weather: null, // Will be loaded lazily
            // Will be loaded lazily
        });

    } catch (error) {
        console.error("Error in route:", error);
        res.status(500).send("Internal server error");
    }
});

router.get("/user-count", async(req,res) => {
    try{
        let userCount = cache.get("userCount");
        if (!userCount) {
            console.log("Fetching user count...");
            const queryUserCount = "SELECT FLOOR(COUNT(*)/10)*10 AS userCount FROM Korisnik";
            const countResults = await new Promise((resolve, reject) => {
                connection.query(queryUserCount, (err, results) => {
                    if (err) reject(err);
                    else resolve(results);
                });
            });

            userCount = countResults[0]?.userCount || 0;
            cache.set("userCount", userCount, 600);
        }

        console.log("User Count:", userCount);
        res.json({userCount:userCount});
    }catch (error) {
        console.error("Error fetching user count:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }

});

router.get("/api/weather", async (req, res) => {
    try {
        let cityData = cache.get("randomCity");
        if (!cityData) return res.status(404).json({ error: "City not found" });

        let translatedCity = cache.get(`translated-${cityData.original}`);
        if (!translatedCity) {
            console.log("Translating city...");
            translatedCity = await translate(cityData.original, { to: "en" })
                .then(res => res.text)
                .catch(err => {
                    console.error("Translation error:", err);
                    return null;
                });

            if (translatedCity) cache.set(`translated-${cityData.original}`, translatedCity);
        }

        console.log("Translated City:", translatedCity);

        let weatherData = cache.get(`weather-${translatedCity}`);
        if (!weatherData) {
            console.log("Fetching weather data...");
            const apiKey = "6b3f90733d55f97c9970464fd39a253e";
            const weather = new OpenWeatherAPI({ key: apiKey, locationName: translatedCity, units: "metric" });

            try {
                weatherData = await weather.getCurrent();
                if (weatherData) cache.set(`weather-${translatedCity}`, weatherData, 600);
            } catch (error) {
                console.error("Weather API error:", error);
                weatherData = null;
            }
        }

        console.log("Weather Data:", weatherData);

       

        res.json({ weather: weatherData });
    } catch (error) {
        console.error("Error fetching weather:", error);
        res.status(500).json({ error: "Failed to fetch data" });
    }
});



router.get("/kviz", (req, res) => {
    
    
        try {
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
                        res.json(questionsWithAnswers);
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
                        res.json(questionsWithAnswers);
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
                        res.json(questionsWithAnswers);
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
                        res.json(questionsWithAnswers);
                    }
                });
            } 
        });
        });
        } catch (error) {
            console.error("Error loading quiz data:", error);
        }
    });

    router.get("/kviz-stranica", (req, res) => {
        if (!req.session.user) {
            return res.redirect("/");
        }
        res.render("kviz", {
            title: "GeoQuest Kviz",
            user: req.session.user
        });

    })
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

    if(!req.session.user || req.session.user.admin === undefined){
        return res.redirect("/");
    }
    else if (!req.session.user.admin || !req.session.user) {
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
        res.render("admin", { title: "GeoQuest Admin", korisnici: results, user: req.session.user });
    });
});
router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("login",{title: "GeoQuest Prijava", user: "", error: ""});
});

router.get("/ranglista", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    const query = `
        SELECT k.nickname, MAX(r.bodovi) AS najbolji_bodovi, MAX(r.datum) AS datum
        FROM RangLista r
        INNER JOIN Korisnik k ON r.KorisnikID = k.KorisnikID
        GROUP BY k.KorisnikID
        ORDER BY najbolji_bodovi DESC
        LIMIT 10
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching leaderboard:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log(results);
        res.render("ranglista", { title: "GeoQuest Rang Lista", rezultati: results, user: req.session.user });
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

        res.render("login", { error: "Netačna lozinka ili korisničko ime", title: "GeoQuest Prijava", user: "" });
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
    res.render("register", { error: "",title: "GeoQuest Registracija", user: username, errors: [] }); // Pretpostavljamo da postoji odgovarajuća view datoteka
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
            title: 'GeoQuest Register', // Page title
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
                title: 'GeoQuest Registracija', 
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
            title: 'GeoQuest Registracija',
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

router.get("/pitanja", async(req, res) => {
    
    const query = `
        SELECT * FROM Pitanje;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching leaderboard:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log(results);
        res.json(results);
    });
});

router.get("/drzava", async(req, res) => {
    
    const query = `
        SELECT * FROM Drzava;
    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching leaderboard:", err);
            return res.status(500).send("Internal Server Error");
        }
        console.log(results);
        res.json(results);
    });
});

router.post('/adminDeleteQuestion', async (req, res) => {
    const { ID } = req.body;

    

    try {
        // Check if the user exists
        const checkQuery = "SELECT * FROM Pitanje as p JOIN Drzava as d ON p.DrzavaID = d.DrzavaID WHERE  p.PitanjeID = ?";
        const quest = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [ID], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
        if (quest.length === 0) {
            // User not found
            return  res.render("admin", { error: "Pitanje nije pronađeno", title: "GeoQuest Prijava", user: req.session.user });;
        }

        // Delete the user
        const deleteQuery = "DELETE p FROM Pitanje as p JOIN Drzava as d ON p.DrzavaID = d.DrzavaID WHERE p.PitanjeID = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [ID], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
            
        });
        
        // Redirect to a success page or display a success message
        return res.send(`
            <script>
                alert('Pitanje je uspešno obrisano!');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
        
    } catch (error) {
        console.error('Error during user deletion:', error);

        // Render the deletion page with a general error message
        return res.send(`
            <script>
                alert('Došlo je do greške! Pokušajte ponovo');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
    }
});

router.post('/adminInsertQuestion', async (req, res) => {
    const { tekstPitanja, tezina, imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave || !tipPitanja || !tekstPitanja || !tezina) {
        return res.send(`
            <script>
                alert('Morate popuniti sva polja!');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
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

        
        return res.send(`
            <script>
                alert('Pitanje je uspešno dodato!');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
        
        // Redirect to a success page or display a success message
        
        
    } catch (error) {
        console.error('Error during question insertion:', error);

        // Render the deletion page with a general error message
        return res.send(`
            <script>
                alert('Došlo je do greške! Pokušajte ponovo');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
    }
});

router.post('/adminUpdateQuestion', async (req, res) => {
    const { tekstPitanja, tezina, imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave || !tipPitanja) {
        return res.send(`
            <script>
                alert('Morate popuniti polja za pretraživanje!');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
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
            return res.send(`
                <script>
                    alert('Morate popuniti polja za vrednosti novog pitanja!');
                    window.location.href = '/admin'; // Redirect after the alert
                </script>
            `);
        }

        // Render success message
        return res.send(`
            <script>
                alert('Pitanje je uspešno editovano!');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
    } catch (error) {
        console.error('Error during question update:', error);

        // Render the page with a general error message
        return res.send(`
            <script>
                alert('Došlo je do greške! Pokušajte ponovo');
                window.location.href = '/admin'; // Redirect after the alert
            </script>
        `);
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

router.use((req,res) => {
    let username = "";
    if(req.session.user)
    {
        username = req.session.user;
    }
    res.status(404).render("404", {title: "GeoQuest 404", user: username});
})

module.exports = router;
