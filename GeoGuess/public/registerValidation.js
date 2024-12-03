const express = require('express');
const { body, validationResult } = require('express-validator');
const bodyParser = require('body-parser');
const app = express();

// Middleware to parse incoming request body
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// POST route for registration with validation
app.post('/register', [
    // Validation for username
    body('ime')
        .notEmpty().withMessage('Ime je obavezno polje')
        .isAlpha().withMessage('Molim Vas unesite validno ime'),

    // Validation for email
    body('prezime')
        .notEmpty().withMessage('Prezime je obavezno polje')
        .isAlpha().withMessage('Molim Vas unesite validno prezime'),

    // Validation for password
    body('email')
        .notEmpty().withMessage('Email je obavezno polje')
        .isEmail().withMessage('Molim Vas unesite validno email'),

    // Validation for confirmPassword
    body('lozinka')
        .notEmpty().withMessage('Lozinka je obavezno polje')
        .isLength({min: 6}).withMessage('Lozinka mora imati bar 6 karaktera')
        .matches(/(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_])/).withMessage('Lozinka mora da ima bar jedno veliko slovo, bar jedan broj i bar jedan specijalan karakter'),

    body('nickname')
        .notEmpty().withMessage('Nickname je obavezno polje')
        .isLength({min: 3}).withMessage('Nickname mora imati bar 3 karaktera'),
    
    body('date')
        .notEmpty().withMessage('Datum je obavezno polje'
        .isAfter(() => {
            const currentDate = new Date();
            currentDate.setFullYear(currentDate.getFullYear() - 13); // Subtract 13 years
            return currentDate.toISOString();
          }).withMessage('Morate imati bar 13 godina kako biste se ulogovali')
        )
], (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // If validation passes, proceed with registration (e.g., save to database)
  const { ime, prezime, email, nickname, date, lozinka } = req.body;
  // In a real scenario, you'd save this data to the database
  res.status(200).json({ message: 'Registration successful!', data: { ime, prezime, email, nickname, date } });
});


