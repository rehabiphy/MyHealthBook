/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleSosPush } from './src/lib/sos';
import { displayPush } from './src/lib/notifications';
import { isListedPush, requestOpenInbox } from './src/lib/inbox';

/* Runs headless when a data push arrives with the app in the background
   or killed — must be registered here, outside React, before
   registerComponent. A family SOS starts the native alarm from here;
   health tips and invites are drawn by Notifee (with the app logo). A
   push that carries its own `notification` block was already shown by
   Android, so it isn't drawn a second time. */
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  if (handleSosPush(remoteMessage)) return;
  if (!remoteMessage.notification) await displayPush(remoteMessage);
});

/* Taps / dismissals of Notifee notifications while the app is in the
   background. Tapping a server push (health tip, invite…) opens the
   Notifications page once the app is up; a medicine reminder tap just
   opens the app. */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS && isListedPush(detail.notification?.data)) requestOpenInbox();
});

AppRegistry.registerComponent(appName, () => App);
