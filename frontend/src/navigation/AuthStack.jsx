import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

/* Card's glass BlurView snapshots its background once on mount
   (autoUpdate={false} — safe for this app's normal instant tab
   switches). The default push slide animation mounts a screen while
   it's still animating in, so that one-time snapshot was capturing a
   blank transitional frame and freezing on it — the white-page bug.
   Turning the transition off removes that timing window entirely. */
export default function AuthStack({ initialRouteName = 'Login' }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
