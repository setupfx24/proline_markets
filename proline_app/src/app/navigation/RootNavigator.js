import React, { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../providers/AuthContext';
import { AccountProvider } from '../providers/AccountContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import AppLoader from '../../components/vantage/AppLoader';
import NotificationsBridge from '../../components/NotificationsBridge';
import { navigationRef } from './navigationRef';
import { vantage } from '../../theme/vantageTheme';

export default function RootNavigator() {
  const auth = useContext(AuthContext);
  const ready = !auth?.loading;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={{
        dark: true,
        colors: {
          primary: vantage.accent,
          background: vantage.bg,
          card: vantage.bg,
          text: vantage.textPrimary,
          border: vantage.border,
          notification: vantage.accent,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium:  { fontFamily: 'System', fontWeight: '500' },
          bold:    { fontFamily: 'System', fontWeight: '700' },
          heavy:   { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      {!ready ? (
        <AppLoader />
      ) : auth?.user ? (
        <AccountProvider>
          <MainTabs />
          <NotificationsBridge />
        </AccountProvider>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
