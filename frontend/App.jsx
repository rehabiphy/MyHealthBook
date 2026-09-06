/**
 * MyHealthBook — a home vitals record.
 * React Native CLI port of the original web/Artifact ui.jsx.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/state/AuthContext';
import { DataProvider } from './src/state/DataContext';
import { AskDialogProvider } from './src/state/AskDialogContext';
import { configureGoogleSignIn } from './src/lib/googleAuth';
import { setupForegroundNotifications } from './src/lib/notifications';
import RootNavigator from './src/navigation/RootNavigator';

/* react-native-screens is enabled by default (no enableScreens() call
   needed) — that default matters here: it natively detaches inactive
   tab screens from the view hierarchy, which is what stops an
   off-screen tab's BlurViews from staying mounted and compositing
   underneath the active screen. Disabling it stacks every visited
   tab's translucent blur layers on top of each other, which is what
   was producing the dim/muddy look. */
export default function App() {
  useEffect(() => {
    configureGoogleSignIn();
    const unsubscribe = setupForegroundNotifications();
    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <AuthProvider>
        <DataProvider>
          <AskDialogProvider>
            <RootNavigator />
          </AskDialogProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
