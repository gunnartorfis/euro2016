require('coffee-script').register();
const http = require('http');
const https = require('https');
const express = require('express');
const hbs = require('hbs');
const session = require('express-session');
const Store = require('express-sequelize-session')(session.Store);
const passport = require('passport');
const bodyParser = require('body-parser');
const compression = require('compression');
const moment = require('moment');
const csrf = require('csurf');
const fs = require('fs');
const helmet = require('helmet');
const package = require('./package.json');
const routes = require('./routes');
const config = require('./config');
const instance = require('./models').instance;

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    instance.model('User').findById(id).then(function(user) {
        done(null, user);
    }).catch(function(err) {
        done(err, false);
    });
});

hbs.registerPartials(__dirname + '/views/partials');

const app = express();
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.disable('x-powered-by');
app.enable('strict routing');
app.enable('case sensitive routing');

app.locals.origin = config.origin;
hbs.localsAsTemplateData(app);

if(process.env.NODE_ENV === 'production') {
    hbs.registerHelper('asset', function(path) {
        return '/' + package.version + path;
    });
} else {
    hbs.registerHelper('asset', function(path) {
        return path;
    });
}

hbs.registerHelper('calendar', function(when) {
    return moment(when).format('dddd, MMMM Do, H:mm');
});

hbs.registerHelper('calendarShort', function(when) {
    return moment(when).format('MMM D, H:mm');
});

hbs.registerHelper('expired', function(match) {
    return match.isExpired();
});

hbs.registerHelper('toFixed1', function(number) {
    return Math.round(number * 10) / 10;
});

hbs.registerHelper('scoreClass', function(match) {
    const betHome = this.Bets && this.Bets[0] ? this.Bets[0].goalsHome : NaN;
    const betAway = this.Bets && this.Bets[0] ? this.Bets[0].goalsAway : NaN;

    if(Number.isInteger(betHome) && Number.isInteger(betAway) &&
        Number.isInteger(this.goalsHome) && Number.isInteger(this.goalsAway)) {

        if(betHome === this.goalsHome && betAway === this.goalsAway) {
            return 'score-3';
        } else if(betHome - betAway === this.goalsHome - this.goalsAway) {
            return 'score-2';
        } else if(Math.sign(betHome - betAway) === Math.sign(this.goalsHome - this.goalsAway)) {
            return 'score-1';
        }
    }

    return 'score-0';
});

app.use(compression());
if(process.env.NODE_ENV === 'production') {
    app.use('/' + package.version, express.static(__dirname + '/bower_components', {maxAge: '365d'}));
    app.use('/' + package.version, express.static(__dirname + '/public', {maxAge: '365d'}));
    app.use('/', express.static(__dirname + '/webroot'));
} else {
    app.use(express.static(__dirname + '/bower_components'));
    app.use(express.static(__dirname + '/public'));
}
app.use(helmet.csp({
    directives: {
        baseUri: ["'self'"],
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
    },
    setAllHeaders: false,
    browserSniff: false
}));
app.use(helmet.frameguard({
    action: 'deny'
}));
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(bodyParser.urlencoded({extended: false}));
app.use(session({
    name: 'sid',
    secret: config.sessionSecret,
    store: new Store(instance),
    resave: false,
    saveUninitialized: true
}));
app.use(csrf());
app.use(passport.initialize());
app.use(passport.session());

routes(app);

instance.sync().then(function() {
    return instance.query(fs.readFileSync(__dirname + '/functions.sql').toString('utf8'), {raw: true});
}).then(function () {
    if(config.https) {
        http.createServer(function(req, res) {
            res.writeHead(301, { 'Location': 'https://' + req.headers.host + req.url });
            res.end();
        }).listen(config.httpPort, function() {
            console.log('HTTPS redirect server running');
        });
        const options = {
            key: fs.readFileSync(config.key),
            cert: fs.readFileSync(config.cert),
            ca: fs.readFileSync(config.ca)
        };
        https.createServer(options, app).listen(config.httpsPort, function() {
            console.log('Visit %s', config.origin);
        });
    } else {
        app.listen(config.httpPort, function() {
            console.log('Visit %s', config.origin);
        });
    }
});
