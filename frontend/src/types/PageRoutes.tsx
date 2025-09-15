import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// screens
import AdminLogin from "../routes/admin-routes/AdminLogin";
import AdminHomePage from "../routes/admin-routes/AdminHomePage";
import AdminProfile from "../routes/admin-routes/AdminProfile";
import AdminUserManagement from "../routes/admin-routes/AdminUserManagement";
import AdminMessagesPage from "../routes/admin-routes/AdminMessagesPage";
import AdminAnnouncementsPage from "../routes/admin-routes/AdminAnnouncementsPage";
import FlaggedPostsPage from "../routes/admin-routes/FlaggedPostsPage";
import ConversationCleanupAdmin from "../components/ConversationCleanupAdmin";

import Login from "../routes/user-routes/Login";
import Register from "../routes/user-routes/Register";
import ResetPassword from "../routes/user-routes/ResetPassword";
import EmailVerification from "../routes/user-routes/EmailVerification";
import HomePage from "../routes/user-routes/HomePage";
import MainHome from "../routes/user-routes/MainHome";

// layouts
import AdminLayout from "../layout/AdminLayout";
import GeoLocation from "../routes/user-routes/GeolocationWithMap";
import SendEmail from "../routes/user-routes/SendEmail";
import Success from "../routes/user-routes/Success";
import MyTicket from "../routes/user-routes/MyTicket";
import ReportPage from "../routes/user-routes/ReportPage";
import Profile from "@/routes/user-routes/Profile";
import ContactUs from "@/routes/user-routes/Contact";
import AboutUniClaim from "@/routes/user-routes/AboutUniClaim";
import MessagesPage from "@/routes/user-routes/MessagesPage";

// wrappers
import ProtectedRoute from "../components/ProtectedRoute";
import EmailVerificationRoute from "../components/EmailVerificationRoute";
import { ToastProvider } from "@/context/ToastContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { MessageProvider } from "@/context/MessageContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { AdminNotificationProvider } from "@/context/AdminNotificationContext";
import { AnnouncementProvider } from "@/context/AnnouncementContext";
import PageWrapper from "@/components/PageWrapper";
import ScrollToTop from "@/context/ScrollTop";


// Component that uses the useAuth hook
function AppRoutesWithAuth() {
  const { user } = useAuth();
  
  return (
    <NotificationProvider>
      <MessageProvider userId={user?.uid || null}>
        <Routes>
        {/* Public routes - no AnnouncementProvider needed */}
        <Route
          path="/login"
          element={
            <PageWrapper title="User Login">
              <Login />
            </PageWrapper>
          }
        />
        <Route
          path="/register"
          element={
            <PageWrapper title="Register">
              <Register />
            </PageWrapper>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PageWrapper title="Reset Password">
              <ResetPassword />
            </PageWrapper>
          }
        />
        <Route
          path="/adminlogin"
          element={
            <PageWrapper title="Admin Login">
              <AdminLogin />
            </PageWrapper>
          }
        />
        <Route
          path="/email-verification"
          element={
            <PageWrapper title="Email Verification">
              <EmailVerification />
            </PageWrapper>
          }
        />



        {/* Protected routes using MainHome as layout */}
        <Route
          path="/"
          element={
            <AnnouncementProvider>
              <EmailVerificationRoute>
                <MainHome />
              </EmailVerificationRoute>
            </AnnouncementProvider>
          }
        >
          <Route
            index
            element={
              <PageWrapper title="Home">
                <HomePage />
              </PageWrapper>
            }
          />
          <Route
            path="report"
            element={
              <PageWrapper title="Report ">
                <ReportPage />
              </PageWrapper>
            }
          />
          <Route
            path="ticket"
            element={
              <PageWrapper title="My Ticket">
                <MyTicket />
              </PageWrapper>
            }
          />
          <Route
            path="sendemail"
            element={
              <PageWrapper title="Send Email">
                <SendEmail />
              </PageWrapper>
            }
          />
          <Route
            path="success"
            element={
              <PageWrapper title="Success">
                <Success />
              </PageWrapper>
            }
          />
          <Route
            path="geolocation"
            element={
              <PageWrapper title="Geolocation">
                <GeoLocation />
              </PageWrapper>
            }
          />
          <Route
            path="profile"
            element={
              <PageWrapper title="My Profile">
                <Profile />
              </PageWrapper>
            }
          />
          <Route
            path="contact_us"
            element={
              <PageWrapper title="Contact Us">
                <ContactUs />
              </PageWrapper>
            }
          />
          <Route
            path="aboutuniclaim"
            element={
              <PageWrapper title="About UniClaim">
                <AboutUniClaim />
              </PageWrapper>
            }
          />
          <Route
            path="messages"
            element={
              <PageWrapper title="Messages">
                <MessagesPage />
              </PageWrapper>
            }
          />
        </Route>

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AnnouncementProvider>
              <AdminNotificationProvider>
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              </AdminNotificationProvider>
            </AnnouncementProvider>
          }
        >
          <Route
            index
            element={
              <PageWrapper title="Admin Home">
                <AdminHomePage />
              </PageWrapper>
            }
          />
          <Route
            path="users"
            element={
              <PageWrapper title="User Management">
                <AdminUserManagement />
              </PageWrapper>
            }
          />
          <Route
            path="messages"
            element={
              <PageWrapper title="Admin Messages">
                <AdminMessagesPage />
              </PageWrapper>
            }
          />
          <Route
            path="announcements"
            element={
              <PageWrapper title="Announcements">
                <AdminAnnouncementsPage />
              </PageWrapper>
            }
          />
          <Route
            path="flagged-posts"
            element={
              <PageWrapper title="Flagged Posts">
                <FlaggedPostsPage />
              </PageWrapper>
            }
          />
          <Route
            path="profile"
            element={
              <PageWrapper title="Admin Profile">
                <AdminProfile />
              </PageWrapper>
            }
          />
          <Route
            path="cleanup"
            element={
              <PageWrapper title="System Cleanup">
                <ConversationCleanupAdmin />
              </PageWrapper>
            }
          />
        </Route>

        {/* Catch-all: redirect unknown or unauthenticated routes to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </MessageProvider>
    </NotificationProvider>
  );
}

export default function PageRoutes() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AppRoutesWithAuth />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
