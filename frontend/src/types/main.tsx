import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import App from "./App.tsx";
import { AuthProvider, useAuth } from "@/context/AuthContext.tsx";
import { AdminViewProvider } from "@/context/AdminViewContext.tsx";
import { NotificationProvider } from "@/context/NotificationContext.tsx";
import { MessageProvider } from "@/context/MessageContext.tsx";

// Create a wrapper component that has access to AuthContext
const AppWithProviders = () => {
  const { user } = useAuth();
  
  return (
    <MessageProvider userId={user?.uid || null}>
      <App />
    </MessageProvider>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AdminViewProvider>
        <NotificationProvider>
          <AppWithProviders />
        </NotificationProvider>
      </AdminViewProvider>
    </AuthProvider>
  </StrictMode>
);
