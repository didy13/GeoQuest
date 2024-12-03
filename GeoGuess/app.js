const express = require("express");
const app = express();
const routes = require("./routes/products_routes");
const dotenv = require("dotenv");
dotenv.config();

app.set("view engine", "ejs");
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));


app.listen(process.env.PORT, () =>
{
    console.log(`server je pokrenut na portu ${process.env.PORT}`);
})

app.use(routes);

app.use((req,res) => {
    res.status(404).render("404", {title: "404"});
})
