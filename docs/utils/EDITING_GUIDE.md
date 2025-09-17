# How to Edit Building Polygons (Any Shape) - Step by Step

## Quick Start Guide

### 1. Open the File to Edit
```
frontend/src/utils/campusCoordinates.ts
```

### 2. Find the Building You Want to Edit
Look for the building name, for example:
```typescript
{
  name: "Library",
  coordinates: [
    [124.6565, 8.4855], // ← Edit these coordinates (can be any number of points!)
    [124.6570, 8.4855], // ← 
    [124.6570, 8.4860], // ←
    [124.6565, 8.4860]  // ← Add more points for complex shapes
  ],
  center: [124.65675, 8.48575], // ← This gets calculated automatically
  buffer: 100 // ← Adjust this number (higher = more forgiving)
}
```

### 3. Get Real Coordinates from Google Maps

1. **Go to Google Maps**: https://maps.google.com
2. **Search**: "University of Science and Technology of Southern Philippines CDO"
3. **Zoom in** to see buildings clearly
4. **For each building corner**:
   - Right-click on the corner
   - Select "What's here?"
   - Copy the coordinates that appear

### 4. Update the Coordinates

You can create **any shape** by adding as many coordinate points as needed:

#### Simple Rectangle (4 points):
```typescript
{
  name: "Library",
  coordinates: [
    [124.6572, 8.4858], // Corner 1
    [124.6578, 8.4858], // Corner 2
    [124.6578, 8.4863], // Corner 3
    [124.6572, 8.4863]  // Corner 4
  ],
  center: [124.6575, 8.48605],
  buffer: 80
}
```

#### L-Shaped Building (6 points):
```typescript
{
  name: "Engineering Hall",
  coordinates: [
    [124.6585, 8.4855], // Start here
    [124.6590, 8.4855], // Go right
    [124.6590, 8.4858], // Go down
    [124.6588, 8.4858], // Go left (L-shape)
    [124.6588, 8.4860], // Go down
    [124.6585, 8.4860]  // Go left, back to start
  ],
  center: [124.65875, 8.48575],
  buffer: 80
}
```

#### Complex Building (8+ points):
```typescript
{
  name: "Main Building",
  coordinates: [
    [124.6560, 8.4855], // Point 1
    [124.6565, 8.4855], // Point 2
    [124.6565, 8.4858], // Point 3
    [124.6568, 8.4858], // Point 4
    [124.6568, 8.4860], // Point 5
    [124.6565, 8.4860], // Point 6
    [124.6565, 8.4863], // Point 7
    [124.6560, 8.4863]  // Point 8 (back to start)
  ],
  center: [124.6564, 8.4859],
  buffer: 80
}
```

### 5. Calculate the Center Point

For **any shape**, calculate the center by averaging all coordinates:

```typescript
// Center longitude = (sum of all longitudes) / number of points
// Center latitude = (sum of all latitudes) / number of points

// Example with 4 points:
// Points: [124.6572, 8.4858], [124.6578, 8.4858], [124.6578, 8.4863], [124.6572, 8.4863]
// Center longitude = (124.6572 + 124.6578 + 124.6578 + 124.6572) / 4 = 124.6575
// Center latitude = (8.4858 + 8.4858 + 8.4863 + 8.4863) / 4 = 8.48605

// Example with 6 points (L-shape):
// Points: [124.6585, 8.4855], [124.6590, 8.4855], [124.6590, 8.4858], [124.6588, 8.4858], [124.6588, 8.4860], [124.6585, 8.4860]
// Center longitude = (124.6585 + 124.6590 + 124.6590 + 124.6588 + 124.6588 + 124.6585) / 6 = 124.65875
// Center latitude = (8.4855 + 8.4855 + 8.4858 + 8.4858 + 8.4860 + 8.4860) / 6 = 8.48575
```

### 6. Adjust Buffer Zone

- **Higher buffer** (e.g., 120) = More forgiving detection
- **Lower buffer** (e.g., 60) = More precise detection
- **Start with 80-100** and adjust based on testing

### 7. Test Your Changes

1. Save the file
2. Refresh your app
3. Go to report page
4. Click "Show Map"
5. Pin on the building you just updated
6. Check if it detects correctly

## Building Shape Rules

### For Any Shape:
1. **Start at any corner** and go around the building
2. **Always end where you started** (close the polygon)
3. **Go in one direction** (clockwise or counterclockwise)
4. **Add as many points as needed** for the building shape

### Examples:

#### Rectangle (4 points):
```
Start → Right → Down → Left → Back to Start
[1] → [2] → [3] → [4] → [1]
```

#### L-Shape (6 points):
```
Start → Right → Down → Left → Down → Left → Back to Start
[1] → [2] → [3] → [4] → [5] → [6] → [1]
```

#### Complex Shape (8+ points):
```
Start → Right → Down → Right → Down → Left → Down → Left → Back to Start
[1] → [2] → [3] → [4] → [5] → [6] → [7] → [8] → [1]
```

## Common Mistakes to Avoid

1. **Wrong coordinate order**: Use [longitude, latitude] not [latitude, longitude]
2. **Wrong corner order**: Make sure corners are in the right sequence
3. **Typos**: Double-check all numbers
4. **Missing commas**: Make sure there are commas between coordinates

## Quick Test Method

1. **Pin on the building** in your app
2. **Check the coordinates** that appear in the input field
3. **Compare with your building center** - they should be close
4. **If not close**, adjust the building coordinates

## Example: Complete Update

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

// After (real coordinates from Google Maps):
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

## Need Help?

If you're still having trouble:
1. Start with just one building (like Library)
2. Get the coordinates from Google Maps
3. Update just that one building
4. Test it in your app
5. Once it works, do the other buildings one by one
