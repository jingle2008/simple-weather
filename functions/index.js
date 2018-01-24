const functions = require('firebase-functions');
const firebase = require('firebase-admin');
const express = require('express');

const firebaseApp = firebase.initializeApp(
    functions.config().firebase
);

function capitalize(s) {
    return s[0].toUpperCase() + s.slice(1);
}

function findCities(query) {
    query = capitalize(query);

    return firebaseApp
        .database()
        .ref('cities')
        .orderByValue()
        .startAt(query)
        .endAt(query + '\uf8ff')
        .limitToFirst(10)
        .once('value')
        .then(snapshot => snapshot.val());
}

const app = express();

app.get('/cities/:query', (request, response, next) => {
    response.set('Cache-Control', 'public, max-age=3600, s-maxage=6000');
    var query = request.params.query;
    console.log('query:, ', query);
    findCities(query).then(cities => {
        var results = Object.keys(cities || {}).map(k => cities[k]);
        console.log('citites found: ', results);
        return response.json(results);
    })
    .catch(error => next(error));
});

exports.app = functions.https.onRequest(app);
