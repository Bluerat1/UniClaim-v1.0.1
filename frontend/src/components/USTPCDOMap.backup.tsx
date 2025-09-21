import React, { useEffect, useRef, useState } from "react";
import { useToast } from "@/context/ToastContext";
import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { Icon, Style, Fill, Stroke } from "ol/style";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import Circle from 'ol/geom/Circle';
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
// Remove unused import
import { defaults as defaultControls } from "ol/control";
import { detectLocationFromCoordinates } from "@/utils/locationDetection";
import { USTP_CAMPUS_LOCATIONS, CAMPUS_BOUNDARY } from "@/utils/campusCoordinates";

interface Props {
  locationError?: boolean;
  coordinates?: { lat: number; lng: number } | null;
  setCoordinatesExternal?: (
    coords: { lat: number; lng: number } | null
  ) => void;
}

const USTPLocationPicker: React.FC<Props> = ({
  locationError = false,
  coordinates,
  setCoordinatesExternal,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [localError, setLocalError] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const [showBuildingHighlights] = useState(false);
  const [showCornerNumbers] = useState(false);
  const [showCampusBoundary] = useState(false);

  const { showToast } = useToast();

  const [confirmedCoordinates, setConfirmedCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(coordinates ?? null);

  const markerSourceRef = useRef<VectorSource>(new VectorSource());
  const markerFeatureRef = useRef<Feature<Point> | null>(null);
  const buildingSourceRef = useRef<VectorSource>(new VectorSource());
  const cornerSourceRef = useRef<VectorSource>(new VectorSource());
  const bufferSourceRef = useRef<VectorSource>(new VectorSource());
  const boundarySourceRef = useRef<VectorSource>(new VectorSource());
  const boundaryCornerSourceRef = useRef<VectorSource>(new VectorSource());

  const initializeMap = () => {
    if (!mapRef.current) return;

    const initialCenter = confirmedCoordinates
      ? fromLonLat([confirmedCoordinates.lng, confirmedCoordinates.lat])
      : fromLonLat([124.6570494294046, 8.485713351944865]);

    const markerSource = markerSourceRef.current;
    const buildingSource = buildingSourceRef.current;
    const boundarySource = boundarySourceRef.current;
    const boundaryCornerSource = boundaryCornerSourceRef.current;
    const bufferSource = bufferSourceRef.current;

    // Create building boundary layer (visible with highlighting)
    const buildingLayer = new VectorLayer({
      source: buildingSource,
      style: () => {
        if (!showBuildingHighlights) {
          return new Style({
            fill: new Fill({
              color: 'transparent'
            }),
            stroke: new Stroke({
              color: 'transparent',
              width: 0
            })
          });
        }
        return new Style({
          fill: new Fill({
            color: 'rgba(59, 130, 246, 0.1)' // Light blue fill
          }),
          stroke: new Stroke({
            color: '#3B82F6', // Blue border
            width: 2
          })
        });
      }
    });

    // Create corner indicator layer (visible with numbers)
    const cornerSource = cornerSourceRef.current;
    const cornerLayer = new VectorLayer({
      source: cornerSource,
      style: (feature) => {
        if (!showCornerNumbers) {
          return new Style({
            image: new Icon({
              src: 'data:image/svg+xml;base64,' + btoa(`
                <svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="0.5" cy="0.5" r="0.5" fill="transparent"/>
                </svg>
              `),
              scale: 0.1,
              anchor: [0.5, 0.5]
            })
          });
        }
        const cornerLabel = feature.get('cornerLabel');
        return new Style({
          image: new Icon({
            src: 'data:image/svg+xml;base64,' + btoa(`
              <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#EF4444" stroke="#DC2626" stroke-width="2"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${cornerLabel}</text>
              </svg>
            `),
            scale: 0.8,
            anchor: [0.5, 0.5]
          })
        });
      }
    });

    // Create buffer layer with more visible style
    const bufferLayer = new VectorLayer({
      source: bufferSource,
      zIndex: 100, // Higher z-index to ensure it's above other layers
      updateWhileAnimating: true,
      updateWhileInteracting: true,
      style: new Style({
        fill: new Fill({
          color: 'rgba(76, 175, 80, 0.3)' // More visible semi-transparent green fill
        }),
        stroke: new Stroke({
          color: '#1B5E20', // Darker green border for better contrast
          width: 3,
          lineDash: [5, 5] // Dashed line for buffer
        })
      })
    });

    // Create campus boundary layer
    const boundaryLayer = new VectorLayer({
      source: boundarySource,
      style: () => {
        if (!showCampusBoundary) {
          return new Style({
            fill: new Fill({
              color: 'transparent'
            }),
            stroke: new Stroke({
              color: 'transparent',
              width: 0
            })
          });
        }
        return new Style({
          fill: new Fill({
            color: 'rgba(255, 0, 0, 0.05)' // Very light red fill
          }),
          stroke: new Stroke({
            color: '#FF0000', // Red border
            width: 3,
            lineDash: [10, 5] // Dashed line
          })
        });
      }
    });

    // Create boundary corner indicators layer
    const boundaryCornerLayer = new VectorLayer({
      source: boundaryCornerSource,
      style: (feature) => {
        if (!showCampusBoundary) {
          return new Style({
            image: new Icon({
              src: 'data:image/svg+xml;base64,' + btoa(`
                <svg width="1" height="1" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="0.5" cy="0.5" r="0.5" fill="transparent"/>
                </svg>
              `),
              scale: 0.1,
              anchor: [0.5, 0.5]
            })
          });
        }
        const cornerLabel = feature.get('cornerLabel');
        return new Style({
          image: new Icon({
            src: 'data:image/svg+xml;base64,' + btoa(`
              <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" fill="#FF0000" stroke="#FFFFFF" stroke-width="3"/>
                <text x="16" y="21" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${cornerLabel}</text>
              </svg>
            `),
            scale: 1.0,
            anchor: [0.5, 0.5]
          })
        });
      }
    });

    // Create marker layer
    const markerLayer = new VectorLayer({ source: markerSource });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({ source: new OSM() }), 
        boundaryLayer, // Campus boundary at the bottom
        boundaryCornerLayer, // Boundary corner indicators
        buildingLayer, 
        cornerLayer,
        bufferLayer,
        markerLayer
      ],
      view: new View({
        center: initialCenter,
        zoom: 19,
        extent: transformExtent([124.6535, 8.4835, 124.6605, 8.488], "EPSG:4326", "EPSG:3857") // Extended to accommodate new boundary
      }),

      controls: defaultControls({ attribution: false }),
    });

    // Add building polygons to the map using coordinates from campusCoordinates.ts
    USTP_CAMPUS_LOCATIONS.forEach(building => {
      const coordinates = building.coordinates.map(coord => fromLonLat(coord));
      const polygon = new Polygon([coordinates]);
      const feature = new Feature({
        geometry: polygon,
        name: building.name
      });
      buildingSource.addFeature(feature);

      // Add corner indicators
      const cornerLabels = ['1', '2', '3', '4']; // TOP-LEFT, TOP-RIGHT, BOTTOM-RIGHT, BOTTOM-LEFT
      building.coordinates.forEach((coord, index) => {
        const point = new Point(fromLonLat(coord));
        const cornerFeature = new Feature({
          geometry: point,
          cornerLabel: cornerLabels[index]
        });
        cornerSource.addFeature(cornerFeature);
      });
    });

    // Add campus boundary polygon
    const boundaryCoordinates = CAMPUS_BOUNDARY.map(coord => fromLonLat(coord));
    const boundaryPolygon = new Polygon([boundaryCoordinates]);
    const boundaryFeature = new Feature({
      geometry: boundaryPolygon,
      name: 'Campus Boundary'
    });
    boundarySource.addFeature(boundaryFeature);

    // Add boundary corner indicators
    const boundaryCornerLabels = ['TL', 'TR', 'BR', 'BL']; // Top-Left, Top-Right, Bottom-Right, Bottom-Left
    CAMPUS_BOUNDARY.forEach((coord, index) => {
      const point = new Point(fromLonLat(coord));
      const cornerFeature = new Feature({
        geometry: point,
        cornerLabel: boundaryCornerLabels[index]
      });
      boundaryCornerSource.addFeature(cornerFeature);
    });

    if (coordinates && !markerFeatureRef.current) {
      const { lat, lng } = coordinates;
      const point = new Point(fromLonLat([lng, lat]));
      const feature = new Feature({ geometry: point });
      feature.setStyle(
        new Style({
          image: new Icon({
            src: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            scale: 0.08,
            anchor: [0.5, 1],
            anchorXUnits: "fraction",
            anchorYUnits: "fraction",
            crossOrigin: "anonymous",
          }),
        })
      );
      markerSource.addFeature(feature);
      markerFeatureRef.current = feature;
    }

    // Function to update building buffer
    const updateBuildingBuffer = (building: typeof USTP_CAMPUS_LOCATIONS[0] | null) => {
      const bufferSource = bufferSourceRef.current;
      if (!bufferSource) {
        console.error('Buffer source not initialized');
        return;
      }
      
      bufferSource.clear();

      if (building?.center && Array.isArray(building.center) && building.center.length === 2) {
        try {
          const [lng, lat] = building.center;
          const bufferRadius = building.bufferRadius || 30; // Default to 30m if not specified
          
          console.log(`Updating buffer for ${building.name} at (${lng}, ${lat}) with radius ${bufferRadius}m`);
          
          // Create a circle in the map's projection
          const circle = new Circle(
            fromLonLat([lng, lat]),
            bufferRadius
          );
          
          const bufferFeature = new Feature({
            geometry: circle,
            name: `${building.name} Buffer`
          });
          
          bufferSource.addFeature(bufferFeature);
          
          // Force a re-render of the layer
          bufferSource.changed();
          
          // Log the feature for debugging
          console.log('Added buffer feature:', bufferFeature);
          
        } catch (error) {
          console.error('Error updating building buffer:', error);
        }
      } else {
        console.log('No valid building or center coordinates provided');
      }
    };

    // Function to update marker position
    const updateMarkerPosition = (lng: number, lat: number) => {
      let feature = markerFeatureRef.current;
      if (!feature) {
        feature = new Feature({ geometry: new Point(fromLonLat([lng, lat])) });
        feature.setStyle(
          new Style({
            image: new Icon({
              src: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
              scale: 0.08,
              anchor: [0.5, 1],
              anchorXUnits: "fraction",
              anchorYUnits: "fraction",
              crossOrigin: "anonymous",
            }),
          })
        );
        markerSource.addFeature(feature);
        markerFeatureRef.current = feature;
      } else {
        feature.setGeometry(new Point(fromLonLat([lng, lat])));
      }

      const updated = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
      setCoordinatesExternal?.(updated);
      setLocalError(false);
    };

    // Function to find the closest building to given coordinates
    // This is now only used for the initial buffer visualization
    const findClosestBuilding = (lng: number, lat: number) => {
      let closestBuilding = null;
      let minDistance = Infinity;

      USTP_CAMPUS_LOCATIONS.forEach(building => {
        // Skip if building doesn't have a center or coordinates are invalid
        if (!building?.center || !Array.isArray(building.center) || building.center.length !== 2) {
          console.warn(`Invalid center coordinates for building: ${building.name}`);
          return;
        }

        const [buildingLng, buildingLat] = building.center;
        const distance = Math.sqrt(
          Math.pow(buildingLng - lng, 2) + Math.pow(buildingLat - lat, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestBuilding = building;
        }
      });

      return closestBuilding;
    };

    // Click to place/update marker
    map.on("click", (e) => {
      const [lng, lat] = toLonLat(e.coordinate);
      updateMarkerPosition(lng, lat);

      // Detect location from coordinates
      const detectionResult = detectLocationFromCoordinates({ lat, lng });
      console.log('Detection result:', detectionResult);
      
      // Update the detected location state
      setDetectedLocation(detectionResult.location);

      // Find the closest building for the buffer visualization
      let buildingToHighlight = null;
      
      if (detectionResult.location) {
        // If we have a detected location, find the corresponding building
        buildingToHighlight = USTP_CAMPUS_LOCATIONS.find(
          b => b.name === detectionResult.location
        );
      } else if (detectionResult.alternatives?.length > 0) {
        // If no direct match but we have alternatives, use the first one
        buildingToHighlight = USTP_CAMPUS_LOCATIONS.find(
          b => b.name === detectionResult.alternatives[0].location
        );
      }
      
      // Update the building buffer visualization
      if (buildingToHighlight) {
        updateBuildingBuffer(buildingToHighlight);
      } else {
        // Clear the buffer if no building is found
        const bufferSource = bufferSourceRef.current;
        if (bufferSource) {
          bufferSource.clear();
        }
      }

      // Show toast message based on detection result
      if (detectionResult.location) {
        // Direct match (inside building)
        showToast(
          "success",
          "Location Detected",
          `Pin placed in ${detectionResult.location}`,
          3000
        );
      } else if (detectionResult.alternatives?.length > 0) {
        const closestMatch = detectionResult.alternatives[0];
        if (closestMatch.confidence >= 60) {
          // High confidence near a building
          showToast(
            "info",
            "Near Building",
            `Pin placed near ${closestMatch.location}`,
            3000
          );
        } else if (closestMatch.confidence >= 40) {
          // Medium confidence near a building
          showToast(
            "info",
            "Nearby Area",
            `Pin placed near ${closestMatch.location}`,
            3000
          );
        } else {
          // Low confidence, show generic message
          showToast(
            "warning",
            "General Area",
            `Pin placed in the general area of ${closestMatch.location}`,
            3000
          );
        }
      } else {
        // No buildings detected nearby
        showToast(
          "error",
          "No Building Nearby",
          "Please pin closer to a campus building.",
          3000
        );
      }
      
      // Update map size if needed
      setTimeout(() => map.updateSize(), 200);
    });

  useEffect(() => {
    if (!mapInstance && showMap) {
      initializeMap();
    }

    if (!showMap && mapInstance) {
      mapInstance.setTarget(undefined);
      setMapInstance(null);
    }
  }, [showMap]);

  // Update map layers when toggle states change
  useEffect(() => {
    if (mapInstance) {
      // Force re-render of building, corner, boundary, and boundary corner layers
      mapInstance.getLayers().forEach(layer => {
        if (layer instanceof VectorLayer) {
          const source = layer.getSource();
          if (source === buildingSourceRef.current || source === cornerSourceRef.current || source === boundarySourceRef.current || source === boundaryCornerSourceRef.current) {
            layer.changed();
          }
        }
      });
    }
  }, [showBuildingHighlights, showCornerNumbers, showCampusBoundary, mapInstance]);

  const handleLocationSubmit = () => {
    if (!coordinates) {
      setLocalError(true);
      showToast(
        "error",
        "Missing Location",
        "Please pin a location on the map.",
        5000
      );
      return;
    }

    setConfirmedCoordinates(coordinates); // ✅ Save submitted location

    showToast(
      "success",
      "Location Saved",
      "The pinned location has been saved successfully.",
      5000
    );

    setShowMap(false);
  };

  return (
    <div className="mt-4 rounded space-y-3">
      <label className="block text-black">Map of USTP-CDO Campus</label>

      <div className="flex gap-3 w-full">
        <input
          type="text"
          readOnly
          value={
            detectedLocation 
              ? `${detectedLocation} (${coordinates?.lat.toFixed(5)}, ${coordinates?.lng.toFixed(5)})`
              : coordinates 
                ? `Coordinates: ${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`
                : ""
          }
          className={`w-full p-3 rounded focus:outline-none text-sm font-medium ${
            locationError || localError
              ? "border-2 border-red-500"
              : detectedLocation
                ? "border-2 border-green-500 bg-green-50"
                : "border border-gray-500"
          }`}
          placeholder="Pin a location on the map to detect building/area"
        />
        {!showMap && (
          <button
            onClick={() => setShowMap(true)}
            className="bg-navyblue text-white px-4 py-2 rounded hover:bg-blue-900 transition text-sm whitespace-nowrap"
          >
            Show Map
          </button>
        )}
      </div>

      {showMap && (
        <>

          <div
            ref={mapRef}
            className="w-full h-96 rounded shadow-amber-200 mt-4"
          />

          <div className="flex flex-row gap-3">
            <button
              type="button"
              onClick={handleLocationSubmit}
              className="w-full bg-green-600 text-sm text-white p-2 rounded hover:bg-green-700 transition"
            >
              Submit Location
            </button>

            <button
              onClick={() => setShowMap(false)}
              className="w-full bg-red-600 text-sm text-white p-2 rounded hover:bg-red-700 transition"
            >
              Close Map
            </button>
          </div>
        </>
      )}
    </div>
  );
};

    // Initialize map with all layers and controls
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        buildingLayer, 
        cornerLayer,
        bufferLayer,
        boundaryLayer, 
        boundaryCornerLayer,
        markerLayer
      ],
      view: new View({
        center: initialCenter,
        zoom: 19,
        extent: transformExtent([124.6535, 8.4835, 124.6605, 8.488], "EPSG:4326", "EPSG:3857"),
      }),
      controls: defaultControls({ attribution: false }),
    });

    // Create building layer
    const buildingLayer = new VectorLayer({
      source: buildingSourceRef.current,
      style: new Style({
        fill: new Fill({
          color: 'rgba(0, 0, 255, 0.1)',
        }),
        stroke: new Stroke({
          color: 'rgba(0, 0, 255, 0.5)',
          width: 2,
        }),
      }),
    });

    // Create corner indicator layer (visible with numbers)
    const cornerLayer = new VectorLayer({
      source: cornerSourceRef.current,
      style: (feature) => {
        const point = feature.getGeometry() as Point;
        const coordinates = point.getCoordinates();
        const pixel = map.getPixelFromCoordinate(coordinates);
        
        // Only show corner numbers if enabled
        if (!showCornerNumbers) {
          return new Style({
            image: new Icon({
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              opacity: 0,
            }),
          });
        }
        
        // Create a canvas element for the number
        const canvas = document.createElement('canvas');
        const size = 20;
        canvas.width = size;
        canvas.height = size;
        
        const context = canvas.getContext('2d');
        if (context) {
          context.beginPath();
          context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
          context.fillStyle = 'rgba(255, 0, 0, 0.7)';
          context.fill();
          
          context.font = 'bold 12px Arial';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillStyle = 'white';
          context.fillText(feature.get('number'), size / 2, size / 2);
        }
        
        return new Style({
          image: new Icon({
            img: canvas,
            imgSize: [size, size],
            anchor: [0.5, 0.5],
            scale: 1,
            opacity: 1,
            rotateWithView: false,
            rotation: 0,
            displacement: [0, 0],
          }),
        });
      },
    });

    // Create buffer layer
    const bufferLayer = new VectorLayer({
      source: bufferSourceRef.current,
      style: new Style({
        fill: new Fill({
          color: 'rgba(0, 255, 0, 0.1)',
        }),
        stroke: new Stroke({
          color: 'rgba(0, 255, 0, 0.5)',
          width: 2,
          lineDash: [5, 5],
        }),
      }),
    });

    // Create boundary layer
    const boundaryLayer = new VectorLayer({
      source: boundarySourceRef.current,
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(255, 0, 0, 0.5)',
          width: 2,
          lineDash: [5, 5],
        }),
      }),
    });

    // Create boundary corner indicators layer
    const boundaryCornerLayer = new VectorLayer({
      source: boundaryCornerSourceRef.current,
      style: (feature) => {
        const point = feature.getGeometry() as Point;
        const coordinates = point.getCoordinates();
        const pixel = map.getPixelFromCoordinate(coordinates);
        
        // Only show corner numbers if enabled
        if (!showCornerNumbers) {
          return new Style({
            image: new Icon({
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              opacity: 0,
            }),
          });
        }
        
        // Create a canvas element for the number
        const canvas = document.createElement('canvas');
        const size = 20;
        canvas.width = size;
        canvas.height = size;
        
        const context = canvas.getContext('2d');
        if (context) {
          context.beginPath();
          context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
          context.fillStyle = 'rgba(0, 0, 255, 0.7)';
          context.fill();
          
          context.font = 'bold 12px Arial';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillStyle = 'white';
          context.fillText(feature.get('number'), size / 2, size / 2);
        }
        
        return new Style({
          image: new Icon({
            img: canvas,
            imgSize: [size, size],
            anchor: [0.5, 0.5],
            scale: 1,
            opacity: 1,
            rotateWithView: false,
            rotation: 0,
            displacement: [0, 0],
          }),
        });
      },
    });

    // Create marker layer
    const markerLayer = new VectorLayer({
      source: markerSourceRef.current,
      style: new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-red.png',
          scale: 0.5,
        }),
      }),
    });

    // Add layers to map
    map.addLayer(buildingLayer);
    map.addLayer(cornerLayer);
    map.addLayer(bufferLayer);
    map.addLayer(boundaryLayer);
    map.addLayer(boundaryCornerLayer);
    map.addLayer(markerLayer);

    // Add initial marker if coordinates are provided
    if (confirmedCoordinates) {
      const marker = new Feature({
        geometry: new Point(fromLonLat([confirmedCoordinates.lng, confirmedCoordinates.lat])),
      });
      markerSourceRef.current.addFeature(marker);
      markerFeatureRef.current = marker;
    }

    // Add building polygons
    USTP_CAMPUS_LOCATIONS.forEach((building, index) => {
      const polygon = new Feature({
        geometry: new Polygon([building.coordinates.map(coord => fromLonLat(coord))]),
        name: building.name,
      });
      buildingSourceRef.current.addFeature(polygon);

      // Add corner indicators
      if (showCornerNumbers) {
        building.coordinates.forEach((coord, cornerIndex) => {
          const point = new Feature({
            geometry: new Point(fromLonLat(coord)),
            number: cornerIndex + 1,
          });
          cornerSourceRef.current.addFeature(point);
        });
      }
    });

    // Add campus boundary
    if (showCampusBoundary && CAMPUS_BOUNDARY.length > 0) {
      const boundary = new Feature({
        geometry: new Polygon([CAMPUS_BOUNDARY.map(coord => fromLonLat(coord))]),
      });
      boundarySourceRef.current.addFeature(boundary);

      // Add boundary corner indicators
      if (showCornerNumbers) {
        CAMPUS_BOUNDARY.forEach((coord, index) => {
          const point = new Feature({
            geometry: new Point(fromLonLat(coord)),
            number: index + 1,
          });
          boundaryCornerSourceRef.current.addFeature(point);
        });
      }
    }

    // Function to update building buffer visualization
    const updateBuildingBuffer = (building: typeof USTP_CAMPUS_LOCATIONS[0] | null) => {
      const bufferSource = bufferSourceRef.current;
      bufferSource.clear();

      if (!building) return;

      // Create a buffer around the building
      const buffer = new Feature({
        geometry: new Polygon([building.coordinates.map(coord => fromLonLat(coord))]),
      });
      
      // Style the buffer
      buffer.setStyle(
        new Style({
          fill: new Fill({
            color: 'rgba(0, 255, 0, 0.1)',
          }),
          stroke: new Stroke({
            color: 'rgba(0, 255, 0, 0.5)',
            width: 2,
            lineDash: [5, 5],
          }),
        })
      );

      bufferSource.addFeature(buffer);
    };

    // Function to update marker position
    const updateMarkerPosition = (lng: number, lat: number) => {
      if (setCoordinatesExternal) {
        setCoordinatesExternal({ lat, lng });
      }
      
      setConfirmedCoordinates({ lat, lng });

      if (markerFeatureRef.current) {
        markerSourceRef.current.removeFeature(markerFeatureRef.current);
      }

      const newMarker = new Feature({
        geometry: new Point(fromLonLat([lng, lat])),
      });

      markerSourceRef.current.addFeature(newMarker);
      markerFeatureRef.current = newMarker;

      // Center the map on the new marker
      map.getView().animate({
        center: fromLonLat([lng, lat]),
        duration: 500,
      });
    };

    // Function to find the closest building to given coordinates
    const findClosestBuilding = (lng: number, lat: number) => {
      let minDistance = Infinity;
      let closestBuilding = null;

      USTP_CAMPUS_LOCATIONS.forEach((building) => {
        if (!building.center) return;
        
        const buildingCenter = building.center;
        const distance = Math.sqrt(
          Math.pow(buildingCenter[0] - lng, 2) + 
          Math.pow(buildingCenter[1] - lat, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestBuilding = building;
        }
      });

      return closestBuilding;
    };

    // Click to place/update marker
    map.on("click", (e) => {
      const [lng, lat] = toLonLat(e.coordinate);
      updateMarkerPosition(lng, lat);

      // Detect location from coordinates
      const detectionResult = detectLocationFromCoordinates({ lat, lng });
      console.log('Detection result:', detectionResult);
      
      // Update the detected location state
      setDetectedLocation(detectionResult.location);

      // Find the closest building for the buffer visualization
      let buildingToHighlight = null;
      
      if (detectionResult.location) {
        // If we have a detected location, find the corresponding building
        buildingToHighlight = USTP_CAMPUS_LOCATIONS.find(
          b => b.name === detectionResult.location
        );
      } else if (detectionResult.alternatives?.length > 0) {
        // If no direct match but we have alternatives, use the first one
        buildingToHighlight = USTP_CAMPUS_LOCATIONS.find(
          b => b.name === detectionResult.alternatives[0].location
        );
      }
      
      // Update the building buffer visualization
      if (buildingToHighlight) {
        updateBuildingBuffer(buildingToHighlight);
      } else {
        // Clear the buffer if no building is found
        const bufferSource = bufferSourceRef.current;
        if (bufferSource) {
          bufferSource.clear();
        }
      }

      // Show toast message based on detection result
      if (detectionResult.location) {
        // Direct match (inside building)
        showToast(
          "success",
          "Location Detected",
          `Pin placed in ${detectionResult.location}`,
          3000
        );
      } else if (detectionResult.alternatives?.length > 0) {
        const closestMatch = detectionResult.alternatives[0];
        if (closestMatch.confidence >= 60) {
          // High confidence near a building
          showToast(
            "info",
            "Near Building",
            `Pin placed near ${closestMatch.location}`,
            3000
          );
        } else if (closestMatch.confidence >= 40) {
          // Medium confidence near a building
          showToast(
            "info",
            "Nearby Area",
            `Pin placed near ${closestMatch.location}`,
            3000
          );
        } else {
          // Low confidence, show generic message
          showToast(
            "warning",
            "General Area",
            `Pin placed in the general area of ${closestMatch.location}`,
            3000
          );
        }
      } else {
        // No buildings detected nearby
        showToast(
          "error",
          "No Building Nearby",
          "Please pin closer to a campus building.",
          3000
        );
      }
      
      // Update map size if needed
      setTimeout(() => map.updateSize(), 200);
    });

    // Store map instance in state
    setMapInstance(map);

    // Cleanup function
    return () => {
      map.setTarget(undefined);
      setMapInstance(null);
    };
  };

    }
  }

  // Show toast message based on detection result
  if (detectionResult.location) {
    // Direct match (inside building)
    showToast(
      "success",
      "Location Detected",
      `Pin placed in ${detectionResult.location}`,
      3000
    );
  } else if (detectionResult.alternatives?.length > 0) {
    const closestMatch = detectionResult.alternatives[0];
    if (closestMatch.confidence >= 60) {
      // High confidence near a building
      showToast(
        "info",
        "Near Building",
        `Pin placed near ${closestMatch.location}`,
        3000
      );
    } else if (closestMatch.confidence >= 40) {
      // Medium confidence near a building
      showToast(
        "info",
        "Nearby Area",
        `Pin placed near ${closestMatch.location}`,
        3000
      );
    } else {
      // Low confidence, show generic message
      showToast(
        "warning",
        "General Area",
        `Pin placed in the general area of ${closestMatch.location}`,
        3000
      );
    }
  } else {
    // No buildings detected nearby
    showToast(
      "error",
      "No Building Nearby",
      "Please pin closer to a campus building.",
      3000
    );
  }
  
  // Update map size if needed
  setTimeout(() => map.updateSize(), 200);
});
    
    setConfirmedCoordinates({ lat, lng });

    if (markerFeatureRef.current) {
      markerSourceRef.current.removeFeature(markerFeatureRef.current);
    }

    const newMarker = new Feature({
      geometry: new Point(fromLonLat([lng, lat])),
    });

    markerSourceRef.current.addFeature(newMarker);
    markerFeatureRef.current = newMarker;

    // Center the map on the new marker if map is initialized
    if (mapInstance) {
      mapInstance.getView().animate({
        center: fromLonLat([lng, lat]),
        duration: 500,
      });
    }
  };

  // Update marker position when coordinates prop changes
  useEffect(() => {
    if (coordinates) {
      const { lat, lng } = coordinates;
      updateMarkerPosition(lng, lat);
    }
  }, [coordinates]);

  // Toggle map visibility
  const toggleMap = () => {
    setShowMap(!showMap);
  };

  // Handle location submission
  const handleLocationSubmit = () => {
    if (!confirmedCoordinates) {
      setLocalError(true);
      showToast("error", "No Location Selected", "Please select a location on the map.", 3000);
      return;
    }

    setLocalError(false);
    setShowMap(false);
    
    if (setCoordinatesExternal) {
      setCoordinatesExternal(confirmedCoordinates);
    }
  };

  return (
    <div className="mt-4 rounded space-y-3">
      <label className="block text-black">Map of USTP-CDO Campus</label>
      
      <div className="relative h-64 bg-gray-100 rounded-lg overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
        {!showMap && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <button
              onClick={toggleMap}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Open Map
            </button>
          </div>
        )}
      </div>
      
      {showMap && (
        <div className="flex justify-between mt-2">
          <button
            onClick={handleLocationSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Confirm Location
          </button>
          <button
            onClick={toggleMap}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Close Map
          </button>
        </div>
      )}
    </div>
  );
};

export default USTPLocationPicker;
