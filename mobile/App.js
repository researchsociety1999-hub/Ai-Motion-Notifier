import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { useNotifications } from './src/hooks/useNotifications';
import EventsScreen from './src/screens/EventsScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function EventsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f1f5f9',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="EventsList"
        component={EventsScreen}
        options={{ title: '🚨 Motion Events' }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Event Detail' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  useNotifications((message) => {
    console.log('[App] New notification:', message);
  });

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
          tabBarActiveTintColor: '#ef4444',
          tabBarInactiveTintColor: '#64748b',
        }}
      >
        <Tab.Screen
          name="Events"
          component={EventsStack}
          options={{
            tabBarLabel: 'Events',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🚨</Text>,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⚙️</Text>,
            headerShown: true,
            headerStyle: { backgroundColor: '#1e293b' },
            headerTintColor: '#f1f5f9',
            headerTitle: 'Settings',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
