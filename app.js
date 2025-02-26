const express = require("express");
const app = express();
const routes = require("./routes/routes");
const dotenv = require("dotenv");
dotenv.config();

app.set("view engine", "ejs");
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));

app.listen(process.env.PORT, () =>
{
    console.log(`Server je pokrenut na portu ${process.env.PORT}`);
})

app.use(routes);