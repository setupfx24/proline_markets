import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TradeScreen from '../../features/trading/screens/TradeScreen';
import StrategyDetailScreen from '../../features/trading/screens/StrategyDetailScreen';
import BecomeMasterScreen from '../../features/trading/screens/BecomeMasterScreen';

const Stack = createNativeStackNavigator();

export default function TradeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' }, animation: 'slide_from_right', animationDuration: 250 }}>
      <Stack.Screen name="Trade" component={TradeScreen} />
      <Stack.Screen name="StrategyDetail" component={StrategyDetailScreen} />
      <Stack.Screen name="BecomeMaster" component={BecomeMasterScreen} />
    </Stack.Navigator>
  );
}
