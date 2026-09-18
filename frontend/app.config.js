const appJson = require("./app.json");

// Maps SDK keys - use environment variables if set, otherwise use app.json values
const googleMapsApiKeyIOS = process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY || "";
const googleMapsApiKeyAndroid = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY || "";

const expo = { ...appJson.expo };

// Only override iOS key if env var is explicitly set
if (googleMapsApiKeyIOS) {
  expo.ios = {
    ...expo.ios,
    config: {
      ...(expo.ios.config || {}),
      googleMapsApiKey: googleMapsApiKeyIOS,
    },
  };
}

// Only override Android key if env var is explicitly set
if (googleMapsApiKeyAndroid) {
  expo.android = {
    ...expo.android,
    config: {
      ...(expo.android.config || {}),
      googleMaps: { apiKey: googleMapsApiKeyAndroid },
    },
  };
}

module.exports = { expo };
