import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from "react-native-maps";

import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Map">;

export default function MapScreen({ route }: Props) {
  const { lat, lon, places } = route.params;

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={styles.map}
      initialRegion={{
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
    >
      {/* OSM raster tiles keep the map on OpenStreetMap data instead of Google Maps. */}
      <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
      <Marker coordinate={{ latitude: lat, longitude: lon }} title="You" pinColor="blue" />
      {places.map((place) => (
        <Marker
          key={`${place.osm_type}-${place.osm_id}`}
          coordinate={{ latitude: place.lat, longitude: place.lon }}
          title={place.name}
          description={`${place.distance_miles} mi away`}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
