import {
  useFonts,
  Poppins_700Bold_Italic,
} from "@expo-google-fonts/poppins";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import CustomSplash from "./src/components/CustomSplash";
import AppNavigator from "./src/navigation";
import { ThemeProvider } from "./src/theme";

SplashScreen.preventAutoHideAsync();

function AppContent({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { isLoading: authLoading } = useAuth();
  const [showCustomSplash, setShowCustomSplash] = useState(Platform.OS === "android");
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);

  // On Android: hide native splash immediately to show custom splash
  // On iOS: wait for fonts and auth to be ready
  useEffect(() => {
    if (Platform.OS === "android" && !nativeSplashHidden) {
      // Hide native splash immediately on Android
      SplashScreen.hideAsync();
      setNativeSplashHidden(true);
    } else if (Platform.OS === "ios" && fontsLoaded && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, authLoading, nativeSplashHidden]);

  const handleSplashFinish = useCallback(() => {
    setShowCustomSplash(false);
  }, []);

  // Show custom fullscreen splash on Android (while app loads behind it)
  if (Platform.OS === "android" && showCustomSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: "#C6E7CE" }}>
        {fontsLoaded && !authLoading && <AppNavigator />}
        <CustomSplash onFinish={handleSplashFinish} duration={1500} />
      </View>
    );
  }

  // Wait for everything to load before showing app
  if (!fontsLoaded || authLoading) {
    return null;
  }

  return <AppNavigator />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_700Bold_Italic,
  });

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent fontsLoaded={fontsLoaded} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
