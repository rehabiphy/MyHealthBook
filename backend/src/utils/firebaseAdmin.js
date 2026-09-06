import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Prefer the env var (deployable without ever needing to push the
   secret JSON file itself — set FIREBASE_SERVICE_ACCOUNT to the
   file's full contents, minified, on any server that can't/shouldn't
   have the file uploaded to it) and fall back to the local file for
   convenience in local dev where the file already sits on disk. */
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync(path.join(__dirname, '..', 'myhealthbook-507809-firebase-adminsdk-fbsvc-a471eae446.json'), 'utf-8'));

const firebaseApp = initializeApp({ credential: cert(serviceAccount) });

// Not sent anywhere yet this phase — exported so the future
// notification-sending engine has one canonical entry point.
export const messaging = getMessaging(firebaseApp);

export default firebaseApp;
