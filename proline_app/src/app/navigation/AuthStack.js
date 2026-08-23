import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../../features/auth/screens/LoginScreen';
import SignupScreen from '../../features/auth/screens/SignupScreen';
import RegisterOtp from '../../features/auth/screens/RegisterOtp';
import ForgotPasswordScreen from '../../features/auth/screens/ForgotPasswordScreen';
import TwoFactor from '../../features/auth/screens/TwoFactor';

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="RegisterOtp" component={RegisterOtp} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="TwoFactor" component={TwoFactor} />
    </Stack.Navigator>
  );
}
