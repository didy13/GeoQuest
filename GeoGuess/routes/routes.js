const express = require("express");
const session = require("express-session");
require('dotenv').config();
const router = express.Router();
const connection = require("../controller/config");
const bcrypt = require("bcrypt");
const Korisnik = require("../models/Korisnik");
const registerValidation = require("../public/registerValidation");
const { validationResult } = require('express-validator');
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


router.get("/", isAuthenticated, (req, res) => {
    console.log(req.session.user);
    res.render("index", { title: "Home", user: req.session.user});
});
router.get("/kviz", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    const query = `
       SELECT Pitanje.tekstPitanja, 
       Pitanje.tipPitanja, 
       Pitanje.tezina, 
       Drzava.naziv AS drzavaNaziv
FROM Pitanje
JOIN Drzava ON Pitanje.DrzavaID = Drzava.DrzavaID
WHERE Pitanje.tezina IN ('Lako', 'Srednje', 'Teško')
ORDER BY RAND()
LIMIT 10;

    `;

    connection.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching questions:", err);
            // Osiguraj da se odgovor šalje samo jednom
            return res.status(500).send("Server Error");
        }
    res.render("kviz",{title: "kviz", user: req.session.user, questions: results});
    });
});
router.get("/admin", (req, res) => {
    if (!req.session.user.admin) {
        return res.redirect("/");
    }
    res.render("admin",{title: "admin", user: req.session.user});
});
router.get("/login", (req, res) => {
    if (req.session.user) {
        return res.redirect("/");
    }
    res.render("login",{title: "Login", user: ""});
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
        res.render("ranglista", { title: "Rang lista", rezultati: results, user: req.session.user });
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
        res.render("login", { error: "Invalid username or password", title: "Login", user: "" });
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
    res.render("register", { error: "",title: "Register", user: username, errors: [] }); // Pretpostavljamo da postoji odgovarajuća view datoteka
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
            title: 'Register', // Page title
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
                title: 'Register', 
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
            title: 'Register',
            user: req.session.user || '',
            error: 'Došlo je do greške. Pokušajte ponovo.' // General error message
        });
    }
});


router.post('/adminDeleteUser', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).render('admin', {
            errors: [{ msg: 'Korisničko ime je obavezno!' }], // Validation error
            formData: req.body,
            title: 'Delete User',
            user: req.session.user || '',
        });
    }

    try {
        // Check if the user exists
        const checkQuery = "SELECT * FROM Korisnik WHERE nickname = ?";
        const user = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (user.length === 0) {
            // User not found
            return res.status(404).render('admin', {
                errors: [{ msg: 'Korisnik sa datim korisničkim imenom ne postoji!' }], 
                formData: req.body,
                title: 'Delete User',
                user: req.session.user || '',
            });
        }

        // Delete the user
        const deleteQuery = "DELETE FROM Korisnik WHERE nickname = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
            
        });
        if(req.session.user.username === username){
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                    return res.status(500).render('admin', {
                        errors: [{ msg: 'Došlo je do greške prilikom odjave korisnika.' }],
                        formData: req.body,
                        title: 'Delete User',
                        user: req.session.user || '',
                    });
                }
                res.clearCookie("connect.sid", { path: "/" });
                return res.redirect('/logout');
            });
            return;
        }
        res.redirect("/admin");
        // Redirect to a success page or display a success message
        res.render('admin', {
            success: `Korisnik "${username}" je uspešno obrisan.`,
            formData: {}, // Clear the form data
            title: 'Delete User',
            user: req.session.user || '',
        });
        
    } catch (error) {
        console.error('Error during user deletion:', error);

        // Render the deletion page with a general error message
        res.status(500).render('admin', {
            errors: [{ msg: 'Došlo je do greške. Pokušajte ponovo.' }],
            formData: req.body,
            title: 'Delete User',
            user: req.session.user || '',
        });
    }
});

router.post('/adminUpdateUser', async (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).render('admin', {
            errors: [{ msg: 'Korisničko ime je obavezno!' }], // Validation error
            formData: req.body,
            title: 'Update User',
            user: req.session.user || '',
        });
    }

    try {
        // Check if the user exists
        const checkQuery = "SELECT * FROM Korisnik WHERE nickname = ?";
        const user = await new Promise((resolve, reject) => {
            connection.query(checkQuery, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        if (user.length === 0) {
            // User not found
            return res.status(404).render('admin', {
                errors: [{ msg: 'Korisnik sa datim korisničkim imenom ne postoji!' }], 
                formData: req.body,
                title: 'Delete User',
                user: req.session.user || '',
            });
        }

        // Delete the user
        const deleteQuery = "UPDATE Korisnik SET admin = 1 Korisnik WHERE nickname = ?";
        await new Promise((resolve, reject) => {
            connection.query(deleteQuery, [username], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
            
        });
        
            
        
        res.redirect("/admin");
        // Redirect to a success page or display a success message
        res.render('admin', {
            success: `Korisnik "${username}" je uspešno obrisan.`,
            formData: {}, // Clear the form data
            title: 'Delete User',
            user: req.session.user.username || '',
        });
        
    } catch (error) {
        console.error('Error during user deletion:', error);

        // Render the deletion page with a general error message
        res.status(500).render('admin', {
            errors: [{ msg: 'Došlo je do greške. Pokušajte ponovo.' }],
            formData: req.body,
            title: 'Delete User',
            user: req.session.user || '',
        });
    }
});

router.post('/adminDeleteQuestion', async (req, res) => {
    const { imeDrzave, tipPitanja } = req.body;

    if (!imeDrzave && !tipPitanja) {
        return res.status(400).render('admin', {
            errors: [{ msg: 'Sva polja su obavezna!' }], // Validation error
            formData: req.body,
            title: 'Delete Question',
            user: req.session.user || '',
        });
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
            return res.status(404).render('admin', {
                errors: [{ msg: 'Pitanje ne postoji!' }], 
                formData: req.body,
                title: 'Delete Question',
                user: req.session.user || '',
            });
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
        res.render('admin', {
            success: `Pitanje o "${imeDrzave}" je uspešno obrisano.`,
            formData: {}, // Clear the form data
            title: 'Delete Question',
            user: req.session.user || '',
        });
        
    } catch (error) {
        console.error('Error during user deletion:', error);

        // Render the deletion page with a general error message
        res.status(500).render('admin', {
            errors: [{ msg: 'Došlo je do greške. Pokušajte ponovo.' }],
            formData: req.body,
            title: 'Delete User',
            user: req.session.user || '',
        });
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
        res.render('admin', {
            success: `Pitanje za "${imeDrzave}" je uspešno dodato.`,
            formData: {}, // Clear the form data
            title: 'Insert Question',
            user: req.session.user || '',
        });
        
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
        if (!tekstPitanja && !tezina && !tacanOdgovor) {
            return res.status(400).render('adminUpdateQuestion', {
                errors: [{ msg: 'Morate uneti bar jednu vrednost za ažuriranje!' }],
                formData: req.body,
                title: 'Update Question',
                user: req.session.user || '',
            });
        }

        // Render success message
        res.render('admin', {
            success: 'Pitanje je uspešno ažurirano.',
            formData: {}, // Clear the form data
            title: 'Update Question',
            user: req.session.user || '',
        });
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
    res.status(404).render("404", {title: "404", user: username});
})

module.exports = router;
