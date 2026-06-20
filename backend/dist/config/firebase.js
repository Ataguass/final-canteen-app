import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        initializeApp({
            credential: cert(serviceAccount)
        });
        console.log("Firebase Admin initialized using FIREBASE_SERVICE_ACCOUNT_JSON");
    }
    else {
        initializeApp();
        console.log("Firebase Admin initialized using default credentials");
    }
}
catch (error) {
    console.error("Firebase admin initialization error", error);
}
export const firebaseAdmin = {
    auth: getAuth
};
