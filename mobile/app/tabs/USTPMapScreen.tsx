// USTPMapScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useCoordinates } from "../../context/CoordinatesContext";
import { detectLocationFromCoordinates } from "../../utils/locationDetection";

export default function USTPMapScreen() {
  const navigation = useNavigation();
  const { setCoordinatesFromMap } = useCoordinates();

  const onMessage = (event: any) => {
    const coords = JSON.parse(event.nativeEvent.data);
    
    // Detect location from coordinates
    const detectionResult = detectLocationFromCoordinates({
      latitude: coords.lat,
      longitude: coords.lng
    });
    
    // Use the primary location if available and has good confidence
    let detectedLocation = detectionResult.location;
    
    // If no primary location but we have alternatives, use the top alternative
    if (!detectedLocation && detectionResult.alternatives && detectionResult.alternatives.length > 0) {
      const topAlternative = detectionResult.alternatives[0];
      if (topAlternative.confidence >= 10) { // Use reasonable confidence threshold
        detectedLocation = topAlternative.location;
      }
    }
    
    setCoordinatesFromMap({
      latitude: coords.lat,
      longitude: coords.lng,
      detectedLocation: detectedLocation
    });
    navigation.goBack();
  };

  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>USTP Map</title>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
      <!-- Manrope font -->
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>
      html, body, #map { 
        margin: 0; 
        padding: 0; 
        height: 100%; 
        font-family: 'Manrope', sans-serif; 
      }
      #confirmBtn {
        position: absolute; 
        bottom: 16px; 
        left: 16px; 
        right: 16px;
        padding: 16px; 
        background: #0A193A; 
        color: white;
        border: none; 
        border-radius: 8px; 
        font-weight: 600;
        font-size: 15px; /* Increased text size */
        font-family: 'Manrope', sans-serif; /* Explicit Manrope font */
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        z-index: 999; 
        display: none;
      }
      #confirmBtn svg {
        width: 20px;
        height: 20px;
        fill: white;
      }
    </style>

    </head>
    <body>
      <div id="map"></div>
      <button id="confirmBtn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M9 16.17l-3.88-3.88a1 1 0 0 0-1.41 1.41l4.59 4.59a1 1 0 0 0 1.41 0l10-10a1 1 0 0 0-1.41-1.41L9 16.17z"/>
        </svg>
        Confirm Pin Location
      </button>
      <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      <script>
        let selectedLatLng = null;
        const map = L.map('map', {
          center: [8.485713351944865, 124.6570494294046],
          zoom: 18,
          minZoom: 16,
          maxZoom: 20,
          maxBounds: [
            [8.483, 124.654],
            [8.488, 124.660]
          ],
          maxBoundsViscosity: 1.0,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © OpenStreetMap contributors',
          maxZoom: 19,
          noWrap: true,
          bounds: [
            [8.483, 124.654],
            [8.488, 124.660]
          ]
        }).addTo(map);

        // Add building polygons with highlights
        const buildings = [
          {
            name: "Gymnasium",
            coordinates: [
              [8.48597, 124.65638], // TOP-LEFT corner
              [8.48613, 124.65682],  // TOP-RIGHT corner
              [8.48566, 124.65701],  // BOTTOM-RIGHT corner
              [8.48549, 124.65658]   // BOTTOM-LEFT corner
            ]
          },
          {
            name: "Cafeteria",
            coordinates: [
              [8.48535, 124.65665], // TOP-LEFT corner
              [8.48547, 124.65696], // TOP-RIGHT corner
              [8.48520, 124.65702], // BOTTOM-RIGHT corner
              [8.48508, 124.65692], // BOTTOM-RIGHT corner
              [8.48502, 124.65677]  // BOTTOM-LEFT corner
            ]
          },
          {
            name: "Science Complex Building",
            coordinates: [
              [8.48561, 124.65572], // TOP-LEFT corner
              [8.48579, 124.65632], // TOP-RIGHT corner
              [8.48563, 124.65638], // BOTTOM-RIGHT corner
              [8.48543, 124.65581]  // BOTTOM-LEFT corner
            ]
          },
          {
            name: "LRC Building",
            coordinates: [
              [8.48670, 124.65557], // TOP-LEFT corner
              [8.48683, 124.65595], // TOP-RIGHT corner
              [8.48659, 124.65604], // BOTTOM-RIGHT corner
              [8.48654, 124.65590],
              [8.48650, 124.65592],
              [8.48646, 124.65580],
              [8.48650, 124.65578],
              [8.48646, 124.65566]
            ]
          },
          {
            name: "Civil Technology Building (Big)",
            coordinates: [
              [8.48659, 124.65482], // TOP-LEFT corner
              [8.48665, 124.65499], // TOP-RIGHT corner
              [8.48637, 124.65511], // BOTTOM-RIGHT corner
              [8.48630, 124.65493]  // BOTTOM-LEFT corner
            ]
          },
          {
            name: "Civil Technology Building (small)",
            coordinates: [
              [8.48667, 124.65489], // TOP-LEFT corner
              [8.48669, 124.65496], // TOP-RIGHT corner
              [8.48666, 124.65497], // BOTTOM-RIGHT corner
              [8.48663, 124.65491]  // BOTTOM-LEFT corner
            ]
          }
        ];

        // Add campus boundary
        const campusBoundary = [
          [8.4850, 124.6540], // TOP-LEFT corner (extended)
          [8.4845, 124.6600], // TOP-RIGHT corner
          [8.4875, 124.6600], // BOTTOM-RIGHT corner
          [8.4875, 124.6550]  // BOTTOM-LEFT corner
        ];
        
        // Add subtle boundary with minimal visual impact
        const boundaryPolygon = L.polygon(campusBoundary, {
          color: '#CCCCCC',  // Lighter color
          weight: 1,         // Thinner line
          fillColor: '#CCCCCC',
          fillOpacity: 0.02,  // More transparent
          dashArray: '5, 5'   // More subtle dashes
        }).addTo(map);

        // Remove boundary corner indicators for cleaner mobile view

        // Add building outlines with minimal visibility
        buildings.forEach(building => {
          const polygon = L.polygon(building.coordinates, {
            color: '#CCCCCC',  // Lighter gray color
            weight: 0.5,       // Very thin line
            fill: false,       // No fill
            opacity: 0.3,      // More transparent
            fillOpacity: 0     // Ensure no fill
          }).addTo(map);

          // Remove corner markers for cleaner mobile view
        });

        let marker;
        map.on('click', function (e) {
          if (marker) map.removeLayer(marker);
          
          // Create a custom pin icon with better visibility
          const pinIcon = L.divIcon({
            className: 'custom-pin',
            html: \`<div style="
              background: #EF4444;
              border: 3px solid #DC2626;
              border-radius: 50% 50% 50% 0;
              width: 30px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 16px;
              font-family: Arial, sans-serif;
              transform: rotate(-45deg);
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">📍</div>\`,
            iconSize: [30, 30],
            iconAnchor: [15, 30]
          });
          
          marker = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
          selectedLatLng = e.latlng;
          document.getElementById('confirmBtn').style.display = 'flex';
        });

        document.getElementById('confirmBtn').onclick = function () {
          if (selectedLatLng) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              lat: selectedLatLng.lat,
              lng: selectedLatLng.lng
            }));
          }
        };
      </script>
    </body>
    </html>
  `;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View className="flex-row gap-4 items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>

        <Text className="text-lg font-manrope-semibold">Pin a Location</Text>
      </View>

      <WebView
        originWhitelist={["*"]}
        source={{ html: leafletHTML }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        className="flex-1"
      />
    </SafeAreaView>
  );
}
