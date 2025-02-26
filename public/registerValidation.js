// registerValidation.js
const { body } = require('express-validator');

const registerValidation = [
  // Validation for username
  body('ime')
    .notEmpty().withMessage(' Ime je obavezno polje')
    .isAlpha().withMessage('Molim Vas unesite validno ime'),

  // Validation for surname
  body('prezime')
    .notEmpty().withMessage('Prezime je obavezno polje')
    .isAlpha().withMessage('Molim Vas unesite validno prezime'),

  // Validation for email
  body('email')
    .notEmpty().withMessage('Email je obavezno polje')
    .isEmail().withMessage('Molim Vas unesite validan email'),

  // Validation for password
  body('lozinka')
    .notEmpty().withMessage('Lozinka je obavezno polje')
    .isLength({ min: 6 }).withMessage('Lozinka mora imati bar 6 karaktera')
    .matches(/(?=.*[A-Z])(?=.*[0-9])/).withMessage('Lozinka mora da ima bar jedno veliko slovo i bar jedan broj'),

  // Validation for nickname
  body('nickname')
    .notEmpty().withMessage('Nickname je obavezno polje')
    .isLength({ min: 3, max: 12 }).withMessage('Nickname mora imati između 3 i 12 karaktera'),

  // Validation for date of birth
  body('date')
    .notEmpty().withMessage('Datum rođenja je obavezno polje')
    .isISO8601()
    .withMessage('Datum rođenja mora biti u formatu MM-DD-YYYY')
    .custom((value) => {
        const today = new Date();
        const userDate = new Date(value);

        if (userDate > today) {
            throw new Error('Ne možete postaviti datum u budućnosti');
        }
        
        const minAgeDate = new Date();
        minAgeDate.setFullYear(minAgeDate.getFullYear() - 13);

        if (userDate > minAgeDate) {
            throw new Error('Morate imati bar 13 godina kako biste se ulogovali');
        }

        return true;
    })];

module.exports = registerValidation;