# How to Edit Building Polygons (Squares) for USTP Campus

## Step 1: Get the Real Coordinates

### Method 1: Using Google Maps (Recommended)
1. Go to [Google Maps](https://maps.google.com)
2. Search for "University of Science and Technology of Southern Philippines CDO"
3. Zoom in to see the campus buildings clearly
4. For each building, right-click and select "What's here?"
5. Copy the coordinates that appear (longitude, latitude)

### Method 2: Using the Map in Your App
1. Open your app and go to the report page
2. Click "Show Map" to open the USTP map
3. Right-click on a building and inspect the coordinates
4. Note down the coordinates for each building

## Step 2: Edit the Coordinates

Open the file: `frontend/src/utils/campusCoordinates.ts`

### For Each Building, Update These Values:

```typescript
{
  name: "Library", // Building name
  coordinates: [
    [124.6565, 8.4855], // Top-left corner [longitude, latitude]
    [124.6570, 8.4855], // Top-right corner
    [124.6570, 8.4860], // Bottom-right corner
    [124.6565, 8.4860]  // Bottom-left corner
  ],
  center: [124.65675, 8.48575], // Center point of the building
  buffer: 100 // How far from center to detect (in meters)
}
```

### How to Get Building Corners:
1. **Top-left corner**: Northwest corner of the building
2. **Top-right corner**: Northeast corner of the building  
3. **Bottom-right corner**: Southeast corner of the building
4. **Bottom-left corner**: Southwest corner of the building

### How to Calculate Center:
```typescript
// Center longitude = (left + right) / 2
// Center latitude = (top + bottom) / 2

// Example:
// Top-left: [124.6565, 8.4855]
// Bottom-right: [124.6570, 8.4860]
// Center: [124.65675, 8.48575]
```

## Step 3: Test Your Changes

1. Save the file
2. Refresh your app
3. Go to the report page
4. Click "Show Map"
5. Pin on different buildings to test if detection works correctly

## Step 4: Adjust Buffer Zones

If detection is still not accurate:
- **Increase buffer** (e.g., from 80 to 120) for more forgiving detection
- **Decrease buffer** (e.g., from 80 to 60) for more precise detection

## Example: Updating the Library

```typescript
// Before (placeholder):
{
  name: "Library",
  coordinates: [
    [124.6565, 8.4855], [124.6570, 8.4855], 
    [124.6570, 8.4860], [124.6565, 8.4860]
  ],
  center: [124.65675, 8.48575],
  buffer: 100
}

// After (real coordinates):
{
  name: "Library",
  coordinates: [
    [124.6572, 8.4858], [124.6578, 8.4858], 
    [124.6578, 8.4863], [124.6572, 8.4863]
  ],
  center: [124.6575, 8.48605],
  buffer: 80
}
```

## Quick Reference: Coordinate Format

- **Longitude**: East-West position (usually 124.xxxx for CDO)
- **Latitude**: North-South position (usually 8.xxxx for CDO)
- **Format**: [longitude, latitude] (note the order!)

## Troubleshooting

### If detection is still wrong:
1. Check if coordinates are in correct order [lng, lat]
2. Verify the building corners are correct
3. Increase buffer zone
4. Make sure the polygon forms a proper rectangle

### If no detection at all:
1. Check if coordinates are within campus boundary
2. Verify the building is in the USTP_LOCATIONS list
3. Check for typos in coordinates
