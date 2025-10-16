// USTP CDO Campus Coordinates Configuration (Mobile)
// This file contains the actual coordinates for USTP CDO campus buildings
// Update these coordinates with real campus data for accurate location detection

/*
BUILDING CORNER LAYOUT:
┌─────────────────────────────────────┐
│  TOP-LEFT        TOP-RIGHT          │
│     [1] ──────────── [2]            │
│      │               │              │
│      │               │              │
│      │               │              │
│     [4] ──────────── [3]            │
│  BOTTOM-LEFT    BOTTOM-RIGHT        │
└─────────────────────────────────────┘

Coordinate Order:
[1] = TOP-LEFT corner    (smallest lng, largest lat)
[2] = TOP-RIGHT corner   (largest lng, largest lat)
[3] = BOTTOM-RIGHT corner (largest lng, smallest lat)
[4] = BOTTOM-LEFT corner  (smallest lng, smallest lat)

For free-form shapes, add more points between corners as needed.
*/

export interface CampusLocation {
    name: string;
    coordinates: [number, number][]; // [lng, lat] pairs forming a polygon (can be any shape!)
    center: [number, number]; // [lng, lat] center point of the building
    bufferRadius: number; // in meters
}

// Helper function to calculate centroid of polygon coordinates
function calculateCentroid(coordinates: [number, number][]): [number, number] {
    if (coordinates.length === 0) return [0, 0];

    let lngSum = 0;
    let latSum = 0;

    coordinates.forEach(([lng, lat]) => {
        lngSum += lng;
        latSum += lat;
    });

    return [lngSum / coordinates.length, latSum / coordinates.length];
}

// TODO: Replace these placeholder coordinates with actual USTP CDO campus building locations
// To get accurate coordinates:
// 1. Use Google Maps or OpenStreetMap to find the exact building locations
// 2. Get the building footprints/outlines
// 3. Update the coordinates below with the real data
// 4. Test the detection accuracy

export const USTP_CAMPUS_LOCATIONS: CampusLocation[] = [
    {
        name: "Gymnasium",
        coordinates: [
            [124.65638, 8.48597], // TOP-LEFT corner
            [124.65682, 8.48613],  // TOP-RIGHT corner
            [124.65701, 8.48566],  // BOTTOM-RIGHT corner
            [124.65658, 8.48549]   // BOTTOM-LEFT corner
        ],
        center: [124.656695, 8.48581], // Center of the building
        bufferRadius: 30 // in meters
    },
    {
        name: "Cafeteria",
        coordinates: [
            [124.65665, 8.48535], // TOP-LEFT corner
            [124.65696, 8.48547], // TOP-RIGHT corner
            [124.65702, 8.48520], // BOTTOM-RIGHT corner
            [124.65692, 8.48508], // BOTTOM-RIGHT corner
            [124.65677, 8.48502]  // BOTTOM-LEFT corner
        ],
        center: [124.656835, 8.48522], // Center of the building
        bufferRadius: 20 // in meters
    },
    {
        name: "Culinary Arts Building",
        coordinates: [
            [124.65708, 8.48552], // TOP-LEFT corner
            [124.65718, 8.48553], // TOP-RIGHT corner
            [124.65721, 8.48527], // BOTTOM-RIGHT corner
            [124.65711, 8.48526]  // BOTTOM-LEFT corner
        ],
        center: calculateCentroid([
            [124.65708, 8.48552],
            [124.65718, 8.48553],
            [124.65721, 8.48527],
            [124.65711, 8.48526]
        ]),
        bufferRadius: 15 // in meters
    },
    {
        name: "Science Complex Building",
        coordinates: [
            [124.65572, 8.48561], // TOP-LEFT corner
            [124.65632, 8.48579], // TOP-RIGHT corner
            [124.65638, 8.48563], // BOTTOM-RIGHT corner
            [124.65581, 8.48543]  // BOTTOM-LEFT corner
        ],
        center: calculateCentroid([
            [124.65572, 8.48561],
            [124.65632, 8.48579],
            [124.65638, 8.48563],
            [124.65581, 8.48543]
        ]),
        bufferRadius: 40 // in meters
    },
    {
        name: "Old Civil Engineering Building",
        coordinates: [
            [124.65723, 8.48574], // TOP-LEFT corner
            [124.65802, 8.48584], // TOP-RIGHT corner
            [124.65803, 8.48571], // BOTTOM-RIGHT corner
            [124.65724, 8.48562]  // BOTTOM-LEFT corner
        ],
        center: calculateCentroid([
            [124.65723, 8.48574],
            [124.65802, 8.48584],
            [124.65803, 8.48571],
            [124.65724, 8.48562]
        ]),
        bufferRadius: 50 // in meters
    },
    {
        name: "Science Centrum",
        coordinates: [
            [124.65712, 8.48519], // TOP-LEFT corner
            [124.65721, 8.48520], // TOP-RIGHT corner
            [124.65722, 8.48497], // BOTTOM-RIGHT corner
            [124.65713, 8.48496]  // BOTTOM-LEFT corner
        ],
        center: calculateCentroid([
            [124.65712, 8.48519],
            [124.65721, 8.48520],
            [124.65722, 8.48497],
            [124.65713, 8.48496]
        ]),
        bufferRadius: 15 // in meters
    },
    {
        name: "Engineering Complex II",
        coordinates: [
            [124.65668, 8.48493],
            [124.65670, 8.48490], // TOP-LEFT corner
            [124.65695, 8.48498], // TOP-RIGHT corner
            [124.65696, 8.48494], // BOTTOM-RIGHT corner
            [124.65693, 8.48482], // BOTTOM-RIGHT corner
            [124.65668, 8.48476],
            [124.65661, 8.48478],  // BOTTOM-LEFT corner
            [124.65659, 8.48482],
            [124.65659, 8.48486],
            [124.65662, 8.48490],
        ],
        center: calculateCentroid([
            [124.65668, 8.48493],
            [124.65670, 8.48490],
            [124.65695, 8.48498],
            [124.65696, 8.48494],
            [124.65693, 8.48482],
            [124.65668, 8.48476],
            [124.65661, 8.48478],
            [124.65659, 8.48482],
            [124.65659, 8.48486],
            [124.65662, 8.48490]
        ]),
        bufferRadius: 20 // in meters
    },
    {
        name: "Student Lounge",
        coordinates: [
            [124.65689, 8.48597], // TOP-LEFT corner
            [124.65706, 8.48603], // TOP-RIGHT corner
            [124.65709, 8.48570], // BOTTOM-RIGHT corner
            [124.65701, 8.48567]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "LRC Building",
        coordinates: [
            [124.65557, 8.48670], // TOP-LEFT corner
            [124.65595, 8.48683], // TOP-RIGHT corner
            [124.65604, 8.48659], // BOTTOM-RIGHT corner
            [124.65590, 8.48654],
            [124.65592, 8.48650],
            [124.65580, 8.48646],
            [124.65578, 8.48650],
            [124.65566, 8.48646],

        ],
    },
    {
        name: "New Clinic Building",
        coordinates: [
            [124.65557, 8.48595], // TOP-LEFT corner
            [124.65571, 8.48600], // TOP-RIGHT corner
            [124.65573, 8.48595], // BOTTOM-RIGHT corner
            [124.65560, 8.48589]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Parking Lot A",
        coordinates: [
            [124.65657, 8.48514], // TOP-LEFT corner
            [124.65660, 8.48516], // TOP-RIGHT corner
            [124.65667, 8.48500], // BOTTOM-RIGHT corner
            [124.65659, 8.48496],  // BOTTOM-LEFT corner
            [124.65656, 8.48503]
        ],
    },
    {
        name: "Parking Lot B",
        coordinates: [
            [124.6590, 8.4850], // TOP-LEFT corner
            [124.6595, 8.4850], // TOP-RIGHT corner
            [124.6595, 8.4855], // BOTTOM-RIGHT corner
            [124.6590, 8.4855]  // BOTTOM-LEFT corner
        ],
    },

    {
        name: "Science Complex Building",
        coordinates: [
            [124.65553, 8.48585], // TOP-LEFT corner
            [124.65621, 8.48610], // TOP-RIGHT corner
            [124.65627, 8.48595], // BOTTOM-RIGHT corner
            [124.65575, 8.48576], // BOTTOM-LEFT corner
            [124.65579, 8.48565],
            [124.65563, 8.48559],
        ],
    },
    {
        name: "Engineering Complex I",
        coordinates: [
            [124.65696, 8.48494], // TOP-LEFT corner
            [124.65723, 8.48490], // TOP-RIGHT corner
            [124.65723, 8.48469], // BOTTOM-RIGHT corner
            [124.65694, 8.48474],  // BOTTOM-LEFT corner
            [124.65696, 8.48481],
            [124.65694, 8.48482],
        ],
    },
    {
        name: "Gym Lobby",
        coordinates: [
            [124.65650, 8.48614], // TOP-LEFT corner
            [124.65663, 8.48619], // TOP-RIGHT corner
            [124.65666, 8.48612], // BOTTOM-RIGHT corner
            [124.65641, 8.48602],  // BOTTOM-LEFT corner
            [124.65636, 8.48615],
            [124.65647, 8.48620],
        ],
    },
    {
        name: "Information and Communication Technology Center",
        coordinates: [
            [124.65717, 8.48644], // TOP-LEFT corner
            [124.65733, 8.48638], // TOP-RIGHT corner
            [124.65746, 8.48627], // BOTTOM-RIGHT corner
            [124.65755, 8.48617],  // BOTTOM-LEFT corner
            [124.65760, 8.48609],
            [124.65763, 8.48602],
            [124.65757, 8.48600],
            [124.65759, 8.48598],
            [124.65760, 8.48596],
            [124.65760, 8.48593],
            [124.65759, 8.48592],
            [124.65756, 8.48589],
            [124.65752, 8.48589],
            [124.65749, 8.48591],
            [124.65748, 8.48594],
            [124.65748, 8.48598],
            [124.65749, 8.48600],
            [124.65744, 8.48608],
            [124.65734, 8.48618],
            [124.65724, 8.48625],
            [124.65711, 8.48631],

        ],
    },
    {
        name: "Finance and Accounting Building",
        coordinates: [
            [124.65646, 8.48627], // TOP-LEFT corner
            [124.65685, 8.48642], // TOP-RIGHT corner
            [124.65697, 8.48611], // BOTTOM-RIGHT corner
            [124.65686, 8.48606],  // BOTTOM-LEFT corner
            [124.65677, 8.48626],
            [124.65650, 8.48616],
        ],
    },
    {
        name: "Food innovation",
        coordinates: [
            [124.65601, 8.48649], // TOP-LEFT corner
            [124.65609, 8.48652], // TOP-RIGHT corner
            [124.65614, 8.48639], // BOTTOM-RIGHT corner
            [124.65610, 8.48634],  // BOTTOM-LEFT corner
            [124.65569, 8.48618],
            [124.65564, 8.48630],
            [124.65602, 8.48645],
        ],
    },
    {
        name: "residences",
        coordinates: [
            [124.65723, 8.48556], // TOP-LEFT corner
            [124.65756, 8.48559], // TOP-RIGHT corner
            [124.65756, 8.48552], // BOTTOM-RIGHT corner
            [124.65723, 8.48549]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "FIC Extension",
        coordinates: [
            [124.65763, 8.48559], // TOP-LEFT corner
            [124.65795, 8.48562], // TOP-RIGHT corner
            [124.65796, 8.48556], // BOTTOM-RIGHT corner
            [124.65763, 8.48553]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed",
        coordinates: [
            [124.65768, 8.48613], // TOP-LEFT corner
            [124.65774, 8.48614], // TOP-RIGHT corner
            [124.65776, 8.48605], // BOTTOM-RIGHT corner
            [124.65770, 8.48603]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed 2",
        coordinates: [
            [124.65788, 8.48589], // TOP-LEFT corner
            [124.65794, 8.48590], // TOP-RIGHT corner
            [124.65795, 8.48587], // BOTTOM-RIGHT corner
            [124.65789, 8.48586]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Guidance and Testing Center",
        coordinates: [
            [124.65819, 8.48633], // TOP-LEFT corner
            [124.65838, 8.48636], // TOP-RIGHT corner
            [124.65839, 8.48626], // BOTTOM-RIGHT corner
            [124.65821, 8.48623]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Arts and Culture Building",
        coordinates: [
            [124.65842, 8.48627], // TOP-LEFT corner
            [124.65856, 8.48630], // TOP-RIGHT corner
            [124.65858, 8.48620], // BOTTOM-RIGHT corner
            [124.65843, 8.48618]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed 3",
        coordinates: [
            [124.65625, 8.48626], // TOP-LEFT corner
            [124.65630, 8.48628], // TOP-RIGHT corner
            [124.65632, 8.48624], // BOTTOM-RIGHT corner
            [124.65627, 8.48621]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed 4",
        coordinates: [
            [124.65619, 8.48640], // TOP-LEFT corner
            [124.65624, 8.48642], // TOP-RIGHT corner
            [124.65626, 8.48638], // BOTTOM-RIGHT corner
            [124.65621, 8.48635]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed 5",
        coordinates: [
            [124.65541, 8.48649], // TOP-LEFT corner
            [124.65547, 8.48651], // TOP-RIGHT corner
            [124.65551, 8.48641], // BOTTOM-RIGHT corner
            [124.65545, 8.48639]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Technology Building",
        coordinates: [
            [124.65542, 8.48702], // TOP-LEFT corner
            [124.65550, 8.48705], // TOP-RIGHT corner
            [124.65558, 8.48682], // BOTTOM-RIGHT corner
            [124.65515, 8.48666], // BOTTOM-LEFT corner
            [124.65508, 8.48686],
            [124.65543, 8.48699],
        ],
    },
    {
        name: "Study Shed 5",
        coordinates: [
            [124.65541, 8.48649], // TOP-LEFT corner
            [124.65547, 8.48651], // TOP-RIGHT corner
            [124.65551, 8.48641], // BOTTOM-RIGHT corner
            [124.65545, 8.48639]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Student Center",
        coordinates: [
            [124.65505, 8.48625], // TOP-LEFT corner
            [124.65517, 8.48630], // TOP-RIGHT corner
            [124.65531, 8.48597], // BOTTOM-RIGHT corner
            [124.65518, 8.48592]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "BTED",
        coordinates: [
            [124.65518, 8.48591], // TOP-LEFT corner
            [124.65531, 8.48596], // TOP-RIGHT corner
            [124.65543, 8.48566], // BOTTOM-RIGHT corner
            [124.65531, 8.48561]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Blank",
        coordinates: [
            [124.65529, 8.48553], // TOP-LEFT corner
            [124.65547, 8.48563], // TOP-RIGHT corner
            [124.65554, 8.48549], // BOTTOM-RIGHT corner
            [124.65535, 8.48543]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Sports Complex",
        coordinates: [
            [124.65625, 8.48654], // TOP-LEFT corner
            [124.65681, 8.48676], // TOP-RIGHT corner
            [124.65686, 8.48662], // BOTTOM-RIGHT corner
            [124.65631, 8.48640]  // BOTTOM-LEFT corner
        ],
    },

    {
        name: "Dr. Rotoras Memorial Statue",
        coordinates: [
            [124.65711, 8.48591], // TOP-LEFT corner
            [124.65715, 8.48592], // TOP-RIGHT corner
            [124.65716, 8.48586], // BOTTOM-RIGHT corner
            [124.65711, 8.48586]  // BOTTOM-LEFT corner
        ],
    },

    {
        name: "Administration Building",
        coordinates: [
            [124.65722, 8.48614], // TOP-LEFT corner
            [124.65738, 8.48603], // TOP-RIGHT corner
            [124.65739, 8.48592], // BOTTOM-RIGHT corner
            [124.65736, 8.48588],  // BOTTOM-LEFT corner
            [124.65724, 8.48593],
            [124.65713, 8.48601],
        ],
    },
    {
        name: "Civil Technology Building (small)",
        coordinates: [
            [124.65489, 8.48667], // TOP-LEFT corner
            [124.65496, 8.48669], // TOP-RIGHT corner
            [124.65497, 8.48666], // BOTTOM-RIGHT corner
            [124.65491, 8.48663]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Civil Technology Building (Big)",
        coordinates: [
            [124.65482, 8.48659], // TOP-LEFT corner
            [124.65499, 8.48665], // TOP-RIGHT corner
            [124.65511, 8.48637], // BOTTOM-RIGHT corner
            [124.65493, 8.48630]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Sump Pit",
        coordinates: [
            [124.65478, 8.48683], // TOP-LEFT corner
            [124.65498, 8.48689], // TOP-RIGHT corner
            [124.65502, 8.48677], // BOTTOM-RIGHT corner
            [124.65482, 8.48671]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Girl's Trade Building",
        coordinates: [
            [124.65522, 8.48658], // TOP-LEFT corner
            [124.65539, 8.48664], // TOP-RIGHT corner
            [124.65544, 8.48652], // BOTTOM-RIGHT corner
            [124.65538, 8.48649],  // BOTTOM-LEFT corner
            [124.65549, 8.48624],
            [124.65554, 8.48626],
            [124.65560, 8.48612],
            [124.65542, 8.48605],
        ],
    },
    {
        name: "Printing Press",
        coordinates: [
            [124.65605, 8.48671], // TOP-LEFT corner
            [124.65615, 8.48675], // TOP-RIGHT corner
            [124.65619, 8.48664], // BOTTOM-RIGHT corner
            [124.65609, 8.48660]  // BOTTOM-LEFT corner
        ],
    },
    {
        name: "Study Shed 6",
        coordinates: [
            [124.65602, 8.48545], // TOP-LEFT corner
            [124.65642, 8.48559], // TOP-RIGHT corner
            [124.65653, 8.48526], // BOTTOM-RIGHT corner
            [124.65624, 8.48505],  // BOTTOM-LEFT corner
            [124.65609, 8.48517],
        ],
    },
    {
        name: "ITB Building",
        coordinates: [
            [124.65820, 8.48606], // TOP-LEFT corner
            [124.65858, 8.48608], // TOP-RIGHT corner
            [124.65859, 8.48594], // BOTTOM-RIGHT corner
            [124.65806, 8.48591],  // BOTTOM-LEFT corner
            [124.65804, 8.48622],
            [124.65819, 8.48623],
        ],
    },
    {
        name: "SPED Center",
        coordinates: [
            [124.65824, 8.48592], // TOP-LEFT corner
            [124.65835, 8.48592], // TOP-RIGHT corner
            [124.65835, 8.48588], // BOTTOM-RIGHT corner
            [124.65824, 8.48588]  // BOTTOM-LEFT corner
        ],
    },




];

// Campus boundary (approximate)
export const CAMPUS_BOUNDARY: [number, number][] = [
    [124.6540, 8.4850], [124.6600, 8.4845], [124.6600, 8.4875], [124.6550, 8.4875]
];

// Instructions for updating coordinates:
/*
1. Open Google Maps or OpenStreetMap
2. Search for "University of Science and Technology of Southern Philippines CDO"
3. For each building:
   - Right-click on the building and select "What's here?"
   - Copy the coordinates (longitude, latitude)
   - Draw the building outline by getting corner coordinates
   - Update the coordinates array with the building footprint
4. Test the detection by pinning on the map
5. Adjust buffer zones if needed for better detection

Example of getting accurate coordinates:
- Library: Right-click on library building → Get coordinates
- Draw polygon around library building → Get corner coordinates
- Update the coordinates array with real building footprint
*/