import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../../features/home/screens/HomeScreen';
import ComponentGalleryScreen from '../../features/_dev/ComponentGalleryScreen';
import ProfileMenuScreen from '../../features/profile/screens/ProfileMenuScreen';

// Legacy screens — reached from Profile menu until they're rewritten in Vantage style.
import KycScreen from '../../features/profile/screens/KycScreen';
import AccountsScreen from '../../features/profile/screens/AccountsScreen';
import PortfolioScreen from '../../features/trading/screens/PortfolioScreen';
import IBScreen from '../../features/profile/screens/IBScreen';
import BusinessScreen from '../../features/profile/screens/BusinessScreen';
import PammScreen from '../../features/trading/screens/PammScreen';
import AcademyScreen from '../../features/profile/screens/AcademyScreen';
import RiskCalculatorScreen from '../../features/markets/screens/RiskCalculatorScreen';
import EconomicCalendarScreen from '../../features/markets/screens/EconomicCalendarScreen';
import SupportScreen from '../../features/profile/screens/SupportScreen';
import NotificationsScreen from '../../features/profile/screens/NotificationsScreen';
import InstructionsScreen from '../../features/profile/screens/InstructionsScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="ProfileMenu" component={ProfileMenuScreen} options={{ animation: 'slide_from_left' }} />

      <Stack.Screen name="Kyc" component={KycScreen} />
      <Stack.Screen name="Accounts" component={AccountsScreen} />
      <Stack.Screen name="Portfolio" component={PortfolioScreen} />
      <Stack.Screen name="IB" component={IBScreen} />
      <Stack.Screen name="Business" component={BusinessScreen} />
      <Stack.Screen name="Pamm" component={PammScreen} />
      <Stack.Screen name="Academy" component={AcademyScreen} />
      <Stack.Screen name="RiskCalculator" component={RiskCalculatorScreen} />
      <Stack.Screen name="EconomicCalendar" component={EconomicCalendarScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Instructions" component={InstructionsScreen} />

      {__DEV__ ? <Stack.Screen name="ComponentGallery" component={ComponentGalleryScreen} /> : null}
    </Stack.Navigator>
  );
}
