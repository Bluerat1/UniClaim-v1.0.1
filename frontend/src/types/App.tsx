import "./App.css";
import PageRoutes from "../types/PageRoutes";

// 🚀 Import the automatic expiration service
// This ensures expired posts are automatically managed when the app starts
import "../utils/expirationService";

import ErrorBoundary from "../components/ErrorBoundary";
import { SoundUtils } from "../utils/soundUtils";
import { useEffect } from "react";
import { MessageProvider } from "@/context/MessageContext";
import { useAuth } from "@/context/AuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  // Initialize audio system on first user interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      SoundUtils.markUserInteraction();
      // Remove listeners after first interaction to avoid memory leaks
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    // Add event listeners for user interactions
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  const { user } = useAuth();

  return (
    <ErrorBoundary>
      <MessageProvider userId={user?.uid || null}>
        <PageRoutes />
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </MessageProvider>
    </ErrorBoundary>
  );
}

export default App;
