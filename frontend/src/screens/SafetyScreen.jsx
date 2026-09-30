import React from 'react';
import Screen from '../components/layout/Screen';
import SafetyCard from '../components/sos/SafetyCard';

// Profile → Safety: fall detection and the SOS that goes to family
export default function SafetyScreen() {
  return (
    <Screen title="Safety" subtitle="Fall detection and SOS to your family" back>
      <SafetyCard />
    </Screen>
  );
}
