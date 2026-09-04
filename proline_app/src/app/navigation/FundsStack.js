import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FundsScreen from '../../features/funds/screens/FundsScreen';
import DepositScreen from '../../features/funds/screens/DepositScreen';
import DepositOxapay from '../../features/funds/screens/DepositOxapay';
import WithdrawScreen from '../../features/funds/screens/WithdrawScreen';
import WithdrawCrypto from '../../features/funds/screens/WithdrawCrypto';
import WithdrawManual from '../../features/funds/screens/WithdrawManual';
import TransferScreen from '../../features/funds/screens/TransferScreen';
import TransactionHistoryScreen from '../../features/funds/screens/TransactionHistoryScreen';

const Stack = createNativeStackNavigator();

// Deposit is one screen with the website's Crypto | USDT | Manual tabs, so the
// only pushed deposit route is the OxaPay gateway. The Razorpay / local-banking
// / on-chain routes that used to sit here were removed: the trader web app has
// no such flows and the gateway has no endpoints behind them.
export default function FundsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Funds" component={FundsScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="DepositOxapay" component={DepositOxapay} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawCrypto" component={WithdrawCrypto} />
      <Stack.Screen name="WithdrawManual" component={WithdrawManual} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
