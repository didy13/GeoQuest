/*const express = require('express');
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

*/
/*form.addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form submission

    // Perform custom validation logic
    const ime = form.elements['ime']; // accessing element by name
    const email = form.elements['email'];
    const prezime = form.elements['prezime'];
    const nickname = form.elements['nickname'];
    const lozinka = form.elements['lozinka'];

    if (!emailIsValid(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    if(!imeIsValid(ime)){
        alert('Molim Vas unesite validno ime');
        return;
    }
    
    if(!imeIsValid(prezime)){
        alert('Molim Vas unesite validno prezime');
        return;
    }

    if(!passIsValid(lozinka)){
        alert('Lozinka mora sadržati bar jedno veliko slovo, jedan broj i jedan specijalan karakter');
        return;
    }

    if (lozinka.length < 6) {
        alert('Lozinka mora imati bar 6 karaktera');
        return;
    }

    if(nickname.length < 3){
        alert('Nickname mora imati bar 3 karaktera');
        return;
    }

    if(nickname.length > 18){
        alert('Nickname mora ne sme imati preko 18 karaktera');
        return;
    }
 
    // If validation passes, submit the form
    form.submit();
});

function emailIsValid(email) {
    return /^[^\s@]+@[^\s@]+.[^\s@]+$/.test(email);
}

function imeIsValid(ime){
    return /^[A-Za-z]+$/.test(ime);
}

function passIsValid(lozinka){
    return /^(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_]).{6,}$/.test(lozinka);
}*/

// registerValidation.js
const { body } = require('express-validator');

const registerValidation = [
  // Validation for username
  body('ime')
    .notEmpty().withMessage('Ime je obavezno polje')
    .isAlpha().withMessage('Molim Vas unesite validno ime'),

  // Validation for surname
  body('prezime')
    .notEmpty().withMessage('Prezime je obavezno polje')
    .isAlpha().withMessage('Molim Vas unesite validno prezime'),

  // Validation for email
  body('email')
    .notEmpty().withMessage('Email je obavezno polje')
    .isEmail().withMessage('Molim Vas unesite validno email'),

  // Validation for password
  body('lozinka')
    .notEmpty().withMessage('Lozinka je obavezno polje')
    .isLength({ min: 6 }).withMessage('Lozinka mora imati bar 6 karaktera')
    .matches(/(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_])/).withMessage('Lozinka mora da ima bar jedno veliko slovo, bar jedan broj i bar jedan specijalan karakter'),

  // Validation for nickname
  body('nickname')
    .notEmpty().withMessage('Nickname je obavezno polje')
    .isLength({ min: 3 }).withMessage('Nickname mora imati bar 3 karaktera'),

  // Validation for date of birth
  body('date')
    .notEmpty().withMessage('Datum je obavezno polje')
    .custom((value) => {
        // Calculate the current date minus 13 years
        const currentDate = new Date();
        currentDate.setFullYear(currentDate.getFullYear() - 13);
        const minAgeDate = currentDate.toISOString().split('T')[0]; // Get the date in YYYY-MM-DD format
        if (value <= minAgeDate) {
            throw new Error('Morate imati bar 13 godina kako biste se ulogovali');
          }
          return true;
    }).withMessage('Morate imati bar 13 godina kako biste se ulogovali')
];

module.exports = registerValidation;

/*
document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the form from submitting until validation is done

    // Call the validation function
    if (validateForm()) {
        // If form is valid, send it to the server via AJAX (fetch API)
        submitForm();
    }
});

function validateForm() {
    // Clear any previous error messages
    const errorMessages = document.getElementById('errorMessages');
    errorMessages.innerHTML = '';

    let isValid = true;

    // Validate the 'ime' field
    const ime = document.getElementById('ime').value.trim();
    if (!ime || !/^[a-zA-Z]+$/.test(ime)) {
        isValid = false;
        errorMessages.innerHTML += 'Ime is required and should contain only letters.<br>';
    }

    // Validate the 'prezime' field
    const prezime = document.getElementById('prezime').value.trim();
    if (!prezime || !/^[a-zA-Z]+$/.test(prezime)) {
        isValid = false;
        errorMessages.innerHTML += 'Prezime is required and should contain only letters.<br>';
    }

    // Validate the 'email' field
    const email = document.getElementById('email').value.trim();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        isValid = false;
        errorMessages.innerHTML += 'Please enter a valid email address.<br>';
    }

    // Validate the 'lozinka' field
    const lozinka = document.getElementById('lozinka').value.trim();
    if (!lozinka || lozinka.length < 6 || !/(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_])/.test(lozinka)) {
        isValid = false;
        errorMessages.innerHTML += 'Lozinka must be at least 6 characters long, contain at least one uppercase letter, one number, and one special character.<br>';
    }

    // Validate the 'nickname' field
    const nickname = document.getElementById('nickname').value.trim();
    if (!nickname || nickname.length < 3) {
        isValid = false;
        errorMessages.innerHTML += 'Nickname must be at least 3 characters long.<br>';
    }

    // Validate the 'date' field
    const date = document.getElementById('datumRodjenja').value.trim();
    const currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() - 13);
    const minDate = currentDate.toISOString().split('T')[0]; // Subtract 13 years for age validation
    if (!date || date > minDate) {
        isValid = false;
        errorMessages.innerHTML += 'You must be at least 13 years old to register.<br>';
    }

    return isValid;
}

function submitForm() {
    // Get form data
    const formData = new FormData(document.getElementById('registerForm'));

    // Use the Fetch API to submit the form data via POST request
    fetch('/register', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = '/'; // Redirect to home page after successful registration
        } else {
            // Handle server-side errors (e.g., duplicate email or nickname)
            document.getElementById('errorMessages').innerHTML = data.error;
        }
    })
    .catch(error => {
        console.error('Error during form submission:', error);
        document.getElementById('errorMessages').innerHTML = 'An error occurred during submission.';
    });
}
*/

