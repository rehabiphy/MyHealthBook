/* Live deployed backend (AWS). For local backend dev instead, swap to
   'http://localhost:8010' + `adb reverse tcp:8010 tcp:8000` (port 8000
   is taken on the test phone, hence 8010 on the device side). */
export const API_BASE_URL = 'https://myhealthbook.rehabiphy.com';
// export const API_BASE_URL = 'http://localhost:8010';
