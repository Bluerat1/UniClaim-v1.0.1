import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/context/AuthContext.tsx";
import { AdminViewProvider } from "@/context/AdminViewContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AdminViewProvider>
        <App />
      </AdminViewProvider>
    </AuthProvider>
  </StrictMode>
);
