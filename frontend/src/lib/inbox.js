/* Links push handling (outside React, sometimes headless) to the
   screens: a push arriving means the Notifications list and the Home
   bell's unread badge are stale, and tapping a server push in the tray
   should open the Notifications page. Medicine reminders are local and
   aren't part of the list, so tapping one just opens the app as before. */

// pushes the server also saves to the Notifications list (backend/src/utils/push.js, sosController.js)
const LISTED = ['health_tip', 'family_invite', 'subscription_ending', 'general'];

export const isListedPush = data => !!data && (LISTED.includes(data.type) || !!data.notificationId);

const changeListeners = new Set();
let openListener = null;
let openPending = false;

export function onInboxChanged(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export function inboxChanged() {
  changeListeners.forEach(fn => fn());
}

/* Remembered until the app shell is up to act on it — a tap can arrive
   before sign-in and navigation are ready (cold start from the tray). */
export function requestOpenInbox() {
  if (openListener) openListener();
  else openPending = true;
}

export function onOpenInbox(fn) {
  openListener = fn;
  if (openPending) {
    openPending = false;
    fn();
  }
  return () => {
    if (openListener === fn) openListener = null;
  };
}
