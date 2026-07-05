import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import HomeScreen from "../screens/HomeScreen";
import MapScreen from "../screens/MapScreen";
import ResultsScreen from "../screens/ResultsScreen";
import { RootStackParamList } from "../types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Sports Finder" }} />
        <Stack.Screen
          name="Results"
          component={ResultsScreen}
          options={{ title: "Nearby Facilities" }}
        />
        <Stack.Screen name="Map" component={MapScreen} options={{ title: "Map View" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
