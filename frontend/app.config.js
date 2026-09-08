const appJson = require("./app.json");

// Maps SDK key is loaded from the environment and never hardcoded.
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const expo = { ...appJson.expo };

if (googleMapsApiKey) {
  expo.ios = {
    ...expo.ios,
    config: {
      ...(expo.ios.config || {}),
      googleMapsApiKey,
    },
  };
  expo.android = {
    ...expo.android,
    config: {
      ...(expo.android.config || {}),
      googleMaps: { apiKey: googleMapsApiKey },
    },
  };
}

module.exports = { expo };
