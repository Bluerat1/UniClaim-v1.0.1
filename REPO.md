# UniClaim - Lost and Found Application

UniClaim is a comprehensive lost and found platform with web and mobile applications, built with modern web technologies and React Native. The platform helps users report lost and found items, manage claims, and connect with others to reunite items with their owners.

## Project Structure

### Frontend (Web)
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: React Context API
- **Routing**: React Router v7
- **Maps**: Leaflet and OpenLayers
- **Charts**: Chart.js with react-chartjs-2
- **UI Components**:
  - Radix UI primitives
  - Hero Icons
  - Lucide Icons
  - Framer Motion for animations
- **Form Handling**: React Hook Form
- **Date Handling**: date-fns
- **File Handling**: file-saver, exceljs, html2canvas

### Mobile (React Native)
- **Framework**: Expo (v54)
- **Navigation**: React Navigation
- **Styling**: NativeWind (Tailwind for React Native)
- **State Management**: React Context API
- **Storage**: AsyncStorage
- **Notifications**: expo-notifications
- **UI Components**:
  - Expo Vector Icons
  - React Native Elements
  - React Native Paper

### Backend
- **Authentication & Database**: Firebase (v12)
- **File Storage**: Cloudinary
- **Real-time Updates**: Firebase Realtime Database
- **Serverless Functions**: Firebase Cloud Functions

## Key Features

### Core Functionality
- User authentication and profile management
- Report lost and found items with photos
- Advanced search and filtering
- In-app messaging system
- Real-time notifications
- Admin dashboard with analytics

### Web-Specific Features
- Interactive maps for location-based search
- Data visualization with charts
- Export functionality (PDF, Excel)
- Responsive design for all devices

### Mobile-Specific Features
- Camera integration for quick reporting
- Push notifications
- Offline support
- Native device features (camera, location, etc.)

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Firebase CLI (for deployment)
- Expo CLI (for mobile development)

### Installation

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd "lost and found app 2"
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install frontend dependencies
   cd frontend
   npm install

   # Install mobile dependencies
   cd ../mobile
   npm install
   ```

3. **Environment Setup**
   - Create a `.env` file in both `frontend` and `mobile` directories
   - Add your Firebase and Cloudinary configuration

### Development

#### Web Application
```bash
cd frontend
npm run dev
```

#### Mobile Application
```bash
cd mobile
expo start
```

### Building for Production

#### Web
```bash
cd frontend
npm run build
```

#### Mobile
```bash
cd mobile
expo build:android  # or expo build:ios
```

## Documentation

Additional documentation can be found in the `docs/` directory, including:
- Email verification setup
- Flagging system documentation
- Test plans and results
- API documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the [Your License] - see the [LICENSE](LICENSE) file for details.

## Contact

[Your Name] - [Your Email]
Project Link: [https://github.com/yourusername/uniclaim](https://github.com/yourusername/uniclaim)
