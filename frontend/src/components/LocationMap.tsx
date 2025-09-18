import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationMapProps {
  coordinates: { lat: number; lng: number };
  location: string;
  className?: string;
  height?: string | number;
}

export default function LocationMap({ 
  coordinates, 
  location, 
  className = '',
  height = '300px'
}: LocationMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize the map with basic controls
    mapRef.current = L.map(mapContainerRef.current, {
      center: [coordinates.lat, coordinates.lng],
      zoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: true,
    });

    // Add zoom control with better position
    mapRef.current.zoomControl.setPosition('bottomright');

    // Add the OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Create a red pin marker
    const redPin = L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });

    // Add the marker with the red pin
    markerRef.current = L.marker([coordinates.lat, coordinates.lng], {
      icon: redPin
    }).addTo(mapRef.current);

    // Add a popup with location name and coordinates
    const popupContent = `
      <div class="space-y-1 p-1">
        <div class="font-medium text-gray-800">${location}</div>
        <div class="text-xs text-gray-500 font-mono">
          ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}
        </div>
      </div>
    `;
    markerRef.current.bindPopup(popupContent);
    markerRef.current.openPopup();

    // Set a minimum zoom level and fit bounds with padding
    mapRef.current.setMinZoom(15);
    const padding = 0.001;
    mapRef.current.fitBounds([
      [coordinates.lat - padding, coordinates.lng - padding],
      [coordinates.lat + padding, coordinates.lng + padding]
    ] as L.LatLngBoundsExpression, { 
      padding: [10, 10],
      maxZoom: 18
    });

    // Disable map interaction if on mobile
    if (window.innerWidth <= 768) {
      mapRef.current.touchZoom.disable();
      mapRef.current.dragging.disable();
      mapRef.current.doubleClickZoom.disable();
      mapRef.current.scrollWheelZoom.disable();
      mapRef.current.boxZoom.disable();
      mapRef.current.keyboard.disable();
    }

    // Cleanup function to remove the map when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [coordinates.lat, coordinates.lng, location]);

  return (
    <div className="relative w-full h-full flex flex-col rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height }}>
      {/* Location name at the top */}
      <div className="flex-none bg-white px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-blue-500">📍</span>
          <span className="text-sm font-medium text-gray-800 truncate">
            {location}
          </span>
        </div>
      </div>
      
      {/* The map */}
      <div 
        ref={mapContainerRef} 
        className="flex-1 w-full"
        style={{ 
          backgroundColor: '#f8fafc',
          minHeight: '200px',
        }}
      />
      
      {/* Coordinates at the bottom */}
      <div className="flex-none bg-white px-4 py-2 border-t border-gray-200">
        <div className="flex justify-center">
          <span className="text-xs text-gray-600 font-mono">
            {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
          </span>
        </div>
      </div>
    </div>
  );
}
