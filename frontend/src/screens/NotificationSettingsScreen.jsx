import React from 'react';
import Screen from '../components/layout/Screen';
import NotificationsCard from '../components/NotificationsCard';

// Profile → Notifications
export default function NotificationSettingsScreen() {
  return (
    <Screen title="Notifications" subtitle="What this phone reminds you about" back>
      <NotificationsCard />
    </Screen>
  );
}
