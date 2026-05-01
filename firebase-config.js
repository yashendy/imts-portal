import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAUYzG5HNj2uCZWJHwJmRlQhprDYmF0gs0",
    authDomain: "gen-lang-client-0936195703.firebaseapp.com",
    databaseURL: "https://gen-lang-client-0936195703-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gen-lang-client-0936195703",
    storageBucket: "gen-lang-client-0936195703.firebasestorage.app",
    messagingSenderId: "559289050319",
    appId: "1:559289050319:web:db3714928fe5ee979ec3ba",
    measurementId: "G-LR67SFNSD5"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, db };