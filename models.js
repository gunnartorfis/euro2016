const Sequelize = require('sequelize');
const config = require('./config');

const instance = new Sequelize(config.db, {
    define: {
        freezeTableName: true
    },
    logging: (process.env.NODE_ENV === "production" ? false : console.log)
});
module.exports.instance = instance;

// Model definitions
const User = instance.define('User', {
    facebookId: {type: Sequelize.STRING, unique: true},
    googleId: {type: Sequelize.STRING, unique: true},
    name: {type: Sequelize.STRING, allowNull: false, validate: {len: [3, 40]}},
    email: {type: Sequelize.STRING, unique: true, validate: {isEmail: true}},
    password: {type: Sequelize.STRING},
    emailConfirmed: {type: Sequelize.BOOLEAN},
    emailConfirmToken: {type: Sequelize.UUID, unique: true}
});

const Team = instance.define('Team', {
    name: {type: Sequelize.STRING, allowNull: false, validate: {len: [1, 100]}},
    code: {type: Sequelize.STRING, allowNull: false, validate: {len: [1,10]}}
}, {
    timestamps: false
});

const Match = instance.define('Match', {
    goalsHome: Sequelize.INTEGER,
    goalsAway: Sequelize.INTEGER,
    when: {type: Sequelize.DATE, allowNull: false}
});

const MatchType = instance.define('MatchType', {
    code: {type: Sequelize.STRING, allowNull: false, validate: {len: [1, 10]}},
    name: {type: Sequelize.STRING, allowNull: false, validate: {len: [1, 100]}}
}, {
    timestamps: false
});

const Bet = instance.define('Bet', {
    goalsHome: {type: Sequelize.INTEGER, allowNull: false, validate: {min: 0, max: 20}},
    goalsAway: {type: Sequelize.INTEGER, allowNull: false, validate: {min: 0, max: 20}}
}, {
    indexes : [
        {
            unique: true,
            fields: ['UserId', 'MatchId']
        }
    ]
});

// Associations
Bet.belongsTo(User);
User.hasMany(Bet);

Bet.belongsTo(Match);
Match.hasMany(Bet);

Match.belongsTo(Team, {as: 'HomeTeam'});
Match.belongsTo(Team, {as: 'AwayTeam'});
Match.belongsTo(MatchType);
