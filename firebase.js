const { initializeApp, cert} = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const firebase = require('firebase/app');
const { getStorage } = require('firebase/storage');
require('firebase/auth');
require('firebase/firestore');

const serviceAccount = require('./isometric-exercise-app.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "isometric-exercise-app.appspot.com",
})

const firebaseConfig = {
    apiKey: "AIzaSyAuxVTDsLBfS7QDktjejRBUHmIzhZc3dLg",
    authDomain: "isometric-exercise-app.firebaseapp.com",
    databaseURL: "https://isometric-exercise-app-default-rtdb.firebaseio.com",
    projectId: "isometric-exercise-app",
    storageBucket: "isometric-exercise-app.appspot.com",
    messagingSenderId: "707175885150",
    appId: "1:707175885150:web:0a7b0e6e8b6f0b5c8687cf"
}

const firebaseApp = firebase.initializeApp(firebaseConfig)

// const db = getFirestore()
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const storage = getStorage(firebaseApp);

console.log('Firebase has been initialized')

module.exports = { db, firebase, admin, storage, firebaseApp }