import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ServicesScreen from './screens/ServicesScreen';
import ClientsScreen from './screens/ClientsScreen';
import AppointmentsScreen from './screens/AppointmentsScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="Clients" component={ClientsScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
