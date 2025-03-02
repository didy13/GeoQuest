const mysql = require("mysql2");
const dotenv = require("dotenv");
const fs = require("fs");
const pg = require("pg");
dotenv.config()

  let connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DBNAME,
    port: process.env.DB_PORT,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync("./ca.pem").toString(),
    },
})

connection.connect((err) => {
  if (err) {
      console.error('Greška pri povezivanju sa bazom: ', err.message);
  } else {
      console.log('Povezano sa MySQL bazom!');
  }
});

  module.exports = connection;
  
