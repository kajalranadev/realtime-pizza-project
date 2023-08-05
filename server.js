require("dotenv").config();
const express = require("express");

const app = express();
const ejs = require("ejs");
const path = require("path");
const expressLayout = require("express-ejs-layouts");
const PORT = process.env.PORT || 4901;
const mongoose = require("mongoose");
const session = require("express-session");
const flash = require("express-flash");
const MongoDbStore = require("connect-mongo");
const passport = require("passport");
const Emitter = require("events");

// Database connection

const url = "mongodb://localhost/pizza";
mongoose.connect("mongodb://127.0.0.1:27017/pizza");
const connection = mongoose.connection;
connection.once("open", function () {
  console.log("MongoDB database connection established successfully");
});
connection.on("error", console.error.bind(console, "Connecction error"));
// Event emitter
const eventEmitter = new Emitter();
app.set("eventEmitter", eventEmitter);

// session config
app.use(
  session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    store: MongoDbStore.create({
      mongoUrl: url,
      collectionName: "sessions",
    }),
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 24 hour
  })
);

// passport config
const passportInit = require("./app/config/passport");
passportInit(passport);
app.use(session({ secret: "somevalue" }));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
// Assets

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Global middleware

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.user = req.user;

  next();
});

// Set template engine
app.use(expressLayout);
app.set("views", path.join(__dirname, "/resources/views")); // Remove the leading slash (/) before "resources"
app.set("view engine", "ejs");

require("./routes/web")(app);

app.use((req, res) => {
  res.status(404).render("errors/404");
});

const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// Socket

const io = require("socket.io")(server);

io.on("connection", (socket) => {
  // Join
  // console.log(socket.id);
  socket.on("join", (orderId) => {
    socket.join(orderId);
  });
});

eventEmitter.on("orderUpdated", (data) => {
  io.to(`order_${data.id}`).emit("orderUpdated", data);
});
eventEmitter.on("orderPlaced", (data) => {
  io.to("adminRoom").emit("orderPlaced", data);
});
