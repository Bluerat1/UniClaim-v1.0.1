// Location detection utility for USTP CDO Campus (Mobile)
// Defines precise building boundaries and detection logic

import { USTP_CAMPUS_LOCATIONS, CAMPUS_BOUNDARY } from './campusCoordinates';

export interface BuildingPolygon {
    name: string;
    coordinates: [number, number][]; // [lng, lat] pairs forming a polygon
}

export interface LocationDetectionResult {
    location: string | null;
    confidence: number;
    alternatives: Array<{ location: string; confidence: number }>;
}

// Use building polygons from campusCoordinates.ts
export const USTP_BUILDING_POLYGONS: BuildingPolygon[] = USTP_CAMPUS_LOCATIONS;

// Use campus boundary from campusCoordinates.ts
export { CAMPUS_BOUNDARY };

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}


/**
 * Check if a point is within campus boundaries
 */
export function isWithinCampus(point: [number, number]): boolean {
    return isPointInPolygon(point, CAMPUS_BOUNDARY);
}

/**
 * Detect location from coordinates with confidence scoring
 */
export function detectLocationFromCoordinates(
    coordinates: { latitude: number; longitude: number }
): LocationDetectionResult {
    const point: [number, number] = [coordinates.longitude, coordinates.latitude];

    // Check if point is within campus
    if (!isWithinCampus(point)) {
        // Find the closest building even if outside campus
        let minDistance = Infinity;
        let closestBuilding = null;

        for (const building of USTP_BUILDING_POLYGONS) {
            if (!building.coordinates || building.coordinates.length === 0) continue;

            // Calculate centroid of the building polygon
            const center = building.coordinates.reduce(
                (acc, [x, y]) => [acc[0] + x, acc[1] + y],
                [0, 0]
            ).map(sum => sum / building.coordinates.length);

            const distance = Math.sqrt(
                Math.pow(center[0] - point[0], 2) +
                Math.pow(center[1] - point[1], 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestBuilding = building;
            }
        }

        if (closestBuilding) {
            // Calculate confidence based on distance (closer = higher confidence, but lower max)
            const maxDistance = 0.01; // ~1km in degrees
            const confidence = Math.max(5, 50 * (1 - Math.min(minDistance, maxDistance) / maxDistance));

            return {
                location: null,
                confidence: Math.round(confidence),
                alternatives: [{
                    location: closestBuilding.name,
                    confidence: Math.round(confidence)
                }]
            };
        } else {
            return {
                location: null,
                confidence: 0,
                alternatives: []
            };
        }
    }

    const results: Array<{ location: string; confidence: number }> = [];

    // Check each building polygon
    for (const building of USTP_BUILDING_POLYGONS) {
        let confidence = 0;

        // Check if point is inside building polygon
        if (isPointInPolygon(point, building.coordinates)) {
            confidence = 95; // High confidence for points inside building
        }

        if (confidence > 0) {
            results.push({
                location: building.name,
                confidence: Math.round(confidence)
            });
        }
    }

    // If no exact matches found, find the closest building
    if (results.length === 0) {
        let minDistance = Infinity;
        let closestBuilding = null;

        for (const building of USTP_BUILDING_POLYGONS) {
            if (!building.coordinates || building.coordinates.length === 0) continue;

            // Calculate centroid of the building polygon
            const center = building.coordinates.reduce(
                (acc, [x, y]) => [acc[0] + x, acc[1] + y],
                [0, 0]
            ).map(sum => sum / building.coordinates.length);

            const distance = Math.sqrt(
                Math.pow(center[0] - point[0], 2) +
                Math.pow(center[1] - point[1], 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestBuilding = building;
            }
        }

        if (closestBuilding) {
            // Calculate confidence based on distance (closer = higher confidence)
            const maxDistance = 0.001; // ~100 meters in degrees
            const confidence = Math.max(10, 80 * (1 - Math.min(minDistance, maxDistance) / maxDistance));

            // For non-building pins, set to "Near [building]"
            results.push({
                location: "Near " + closestBuilding.name,
                confidence: Math.round(confidence)
            });
        }
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    // Get top result and alternatives
    const primaryResult = results[0];
    const alternatives = results.slice(1, 4); // Top 3 alternatives

    return {
        location: primaryResult && primaryResult.confidence >= 50 ? primaryResult.location : null,
        confidence: primaryResult ? primaryResult.confidence : 0,
        alternatives
    };
}

/**
 * Get building polygon by name
 */
export function getBuildingPolygon(locationName: string): BuildingPolygon | null {
    return USTP_BUILDING_POLYGONS.find(building => building.name === locationName) || null;
}

/**
 * Get all building polygons for map visualization
 */
export function getAllBuildingPolygons(): BuildingPolygon[] {
    return USTP_BUILDING_POLYGONS;
}
