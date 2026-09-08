import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
} from "react-native";

const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

interface CustomSplashProps {
  onFinish: () => void;
  duration?: number;
}

export default function CustomSplash({ onFinish, duration = 1500 }: CustomSplashProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide status bar for true fullscreen
    StatusBar.setHidden(true);
    StatusBar.setBackgroundColor("transparent");
    StatusBar.setTranslucent(true);

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        // Restore status bar
        StatusBar.setHidden(false);
        onFinish();
      });
    }, duration);

    return () => {
      clearTimeout(timer);
      StatusBar.setHidden(false);
    };
  }, [fadeAnim, duration, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Image
        source={require("../../assets/splash-logo.png")}
        style={styles.image}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: "#C6E7CE",
    zIndex: 9999,
    elevation: 9999,
  },
  image: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
