// src/routes/user-routes/LocationReport.tsx
import USTPCDOMapLoc from "@/components/USTPCDOMap";
import { detectLocationFromCoordinates } from "@/utils/locationDetection";

interface LocationProps {
  selectedLocation: string | null;
  setSelectedLocation: (val: string | null) => void;
  locationError?: boolean;
  coordinates: { lat: number; lng: number } | null;
  setCoordinates: (val: { lat: number; lng: number } | null) => void;
}

const LocationReport = ({
  selectedLocation,
  setSelectedLocation,
  locationError = false,
  coordinates,
  setCoordinates,
}: LocationProps) => {
  // Handle coordinate changes and auto-detect location
  const handleCoordinatesChange = (
    newCoordinates: { lat: number; lng: number } | null
  ) => {
    setCoordinates(newCoordinates);

    if (newCoordinates) {
      // Detect location from coordinates
      const detectionResult = detectLocationFromCoordinates(newCoordinates);

      if (detectionResult.location && detectionResult.confidence >= 80) {
        // High confidence detection - set the location
        setSelectedLocation(detectionResult.location);
      } else {
        // Low confidence or no detection - clear location
        setSelectedLocation(null);
      }
    } else {
      // No coordinates - clear location
      setSelectedLocation(null);
    }
  };

  return (
    <div>
      <h1 className="font-medium">Location</h1>

      <div className="bg-blue-50 border border-blue-500 rounded-md mt-3 px-3 py-2">
        <p className="text-[14px] text-blue-800">
          Pin a location on the map to automatically detect the building or area
        </p>
      </div>

      {/* Show detected location */}
      {selectedLocation && (
        <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-green-800 font-medium">
              Detected Location: {selectedLocation}
            </span>
          </div>
        </div>
      )}

      {/* Show error if no location detected */}
      {locationError && !selectedLocation && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            <span className="text-red-800 font-medium">
              Please pin a location within a building area on the map
            </span>
          </div>
        </div>
      )}

      <div className="mt-4">
        <USTPCDOMapLoc
          locationError={locationError}
          coordinates={coordinates}
          setCoordinatesExternal={handleCoordinatesChange}
        />
      </div>

      {/* Instructions */}
      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-start">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 mt-2"></div>
          <div className="text-blue-800 text-sm">
            <p className="mb-1 font-medium">How to use:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click on the map to pin a location</li>
              <li>Make sure to pin within a building or campus area</li>
              <li>The system will automatically detect the location name</li>
              <li>
                If no location is detected, try pinning more precisely within a
                building
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationReport;
