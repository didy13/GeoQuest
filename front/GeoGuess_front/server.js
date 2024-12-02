const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();

app.use(cors());

const connection = mysql.createConnection({
    host: 'sql7.freemysqlhosting.net',
    user: 'sql7749265',
    password: '7GEQ68UX7x',
    database: 'sql7749265',
    port: '3306'
});

connection.connect((err) => {
    if (err) {
        console.error('Greška pri povezivanju sa bazom: ', err.message);
    } else {
        console.log('Povezano sa MySQL bazom!');
    }
});

const port = 7000;
app.listen(port, ()=>{
  console.log("server je pokrenut i radi...");
});
