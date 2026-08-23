import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FundsScreen from '../../features/funds/screens/FundsScreen';
import DepositScreen from '../../features/funds/screens/DepositScreen';
import DepositRazorpay from '../../features/funds/screens/DepositRazorpay';
import DepositOnchain from '../../features/funds/screens/DepositOnchain';
import DepositManual from '../../features/funds/screens/DepositManual';
import DepositOxapay from '../../features/funds/screens/DepositOxapay';
import DepositLocalBanking from '../../features/funds/screens/DepositLocalBanking';
import RazorpayCheckout from '../../features/funds/components/RazorpayCheckout';
import WithdrawScreen from '../../features/funds/screens/WithdrawScreen';
import WithdrawCrypto from '../../features/funds/screens/WithdrawCrypto';
import WithdrawManual from '../../features/funds/screens/WithdrawManual';
import TransferScreen from '../../features/funds/screens/TransferScreen';
import TransactionHistoryScreen from '../../features/funds/screens/TransactionHistoryScreen';

const Stack = createNativeStackNavigator();

export default function FundsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Funds" component={FundsScreen} />
      <Stack.Screen name="Deposit" component={DepositScreen} />
      <Stack.Screen name="DepositRazorpay" component={DepositRazorpay} />
      <Stack.Screen name="DepositOnchain" component={DepositOnchain} />
      <Stack.Screen name="DepositManual" component={DepositManual} />
      <Stack.Screen name="DepositOxapay" component={DepositOxapay} />
      <Stack.Screen name="DepositLocalBanking" component={DepositLocalBanking} />
      <Stack.Screen name="RazorpayCheckout" component={RazorpayCheckout} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="WithdrawCrypto" component={WithdrawCrypto} />
      <Stack.Screen name="WithdrawManual" component={WithdrawManual} />
      <Stack.Screen name="Transfer" component={TransferScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </Stack.Navigator>
  );
}
