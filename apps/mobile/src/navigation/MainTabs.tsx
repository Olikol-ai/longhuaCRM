import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { LessonsScreen } from '../screens/LessonsScreen';
import { ExamsScreen } from '../screens/ExamsScreen';
import { MaterialsScreen } from '../screens/MaterialsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useTheme } from '../theme/ThemeProvider';
import { colors } from '../theme/colors';

export type MainTabParamList = {
  Home: undefined;
  Lessons: undefined;
  Exams: undefined;
  Materials: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

const icons: Record<keyof MainTabParamList, { active: IconName; inactive: IconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Lessons: { active: 'calendar', inactive: 'calendar-outline' },
  Exams: { active: 'school', inactive: 'school-outline' },
  Materials: { active: 'folder', inactive: 'folder-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: colors.brand.red,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarIcon: ({ focused, color, size }) => {
          const set = icons[route.name];
          return (
            <Ionicons
              name={focused ? set.active : set.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="Lessons" component={LessonsScreen} options={{ title: 'Уроки' }} />
      <Tab.Screen name="Exams" component={ExamsScreen} options={{ title: 'Экзамены' }} />
      <Tab.Screen
        name="Materials"
        component={MaterialsScreen}
        options={{ title: 'Материалы' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}
