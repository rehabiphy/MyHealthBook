/* Dev testing on a physical device: run
     adb reverse tcp:4000 tcp:4000
   so the device can reach the backend at localhost:4000 without
   needing the dev machine's LAN IP (which changes between networks).
   Point this at a real deployed host once the backend is hosted. */
export const API_BASE_URL = 'http://localhost:4000';
