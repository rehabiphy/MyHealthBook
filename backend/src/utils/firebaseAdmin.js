import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccount = JSON.parse(readFileSync(path.join(__dirname, '..', 'myhealthbook-507809-firebase-adminsdk-fbsvc-a471eae446.json'), 'utf-8'));

const firebaseApp = initializeApp({ credential: cert(serviceAccount) });

// Not sent anywhere yet this phase — exported so the future
// notification-sending engine has one canonical entry point.
export const messaging = getMessaging(firebaseApp);

export default firebaseApp;
