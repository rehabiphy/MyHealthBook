import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

/* Matches the original web app's `go(key)` prop — screens call
   go("meds"), go("history"), etc. to jump straight to another tab,
   regardless of which tab they're currently on. */
export function useGo() {
  const navigation = useNavigation();
  return useCallback(key => navigation.navigate(key), [navigation]);
}
