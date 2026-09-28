/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { handleSosPush } from './src/lib/sos';

/* Runs headless when a data push arrives with the app in the background
   or killed — must be registered here, outside React, before
   registerComponent. A family SOS starts the native alarm from here. */
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  handleSosPush(remoteMessage);
});

AppRegistry.registerComponent(appName, () => App);
