import {
  HiOutlineMenuAlt2,
  HiOutlineBell,
  HiOutlineUser,
  HiOutlineX,
  HiOutlineShieldCheck,
  HiOutlineCog,
} from "react-icons/hi";
import { IoLogOutOutline } from "react-icons/io5";
import Logo from "../assets/uniclaim_logo.png";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAdminView } from "@/context/AdminViewContext";
import { useAdminNotifications } from "@/context/AdminNotificationContext";
import ProfilePicture from "@/components/ProfilePicture";
import NotificationPreferencesModal from "@/components/NotificationPreferences";
import { postService } from "@/services/firebase/posts";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Notification limit constant - should match the limit in adminNotifications service
const NOTIFICATION_LIMIT = 15;

interface AdminHeaderProps {
  sideNavClick: () => void;
  sideBarOpen: boolean;
}

export default function AdminHeader({
  sideBarOpen,
  sideNavClick,
}: AdminHeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const toggleProfileMenu = () => setShowProfileMenu((prev) => !prev);
  const toggleNotif = () => setShowNotif((prev) => !prev);

  const handleNotificationClick = async (notification: any) => {
    try {
      // Mark notification as read if it's not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Handle conversation/message notifications
      if (notification.data?.conversationId) {
        console.log(
          "Admin navigating to conversation:",
          notification.data.conversationId
        );
        // Navigate to admin messages page with conversation parameter
        navigate(
          `/admin/messages?conversation=${notification.data.conversationId}`
        );
        setShowNotif(false); // Close notification panel
        return;
      }

      // Check for postId in different possible locations
      const postId =
        notification.postId ||
        (notification.data &&
          (notification.data.postId || notification.data.id));

      if (postId) {
        try {
          const post = await postService.getPostById(postId);
          if (post) {
            // Show toast for post found
            toast.success("Post loaded successfully.", {
              position: "top-right",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
            });
            setShowNotif(false); // Close notification panel
          } else {
            // Show toast message for deleted post
            toast.error("This post has been deleted.", {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
            });
            console.log("Post not found, it may have been deleted:", postId);
          }
        } catch (error) {
          console.error("Error fetching post:", error);
          // Show error toast
          toast.error("Error loading post. Please try again.", {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
          });
        }
      }
    } catch (error) {
      console.error("Error handling notification click:", error);
    }
  };

  const { logout, userData } = useAuth();
  const { switchToUserView } = useAdminView();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useAdminNotifications();
  const navigate = useNavigate();

  // Ref for the profile dropdown menu
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Ref for the profile picture trigger
  const profilePictureRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks on the profile picture trigger or dropdown menu
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node) &&
        profilePictureRef.current &&
        !profilePictureRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    navigate("/admin/profile");
  };

  const handleUserView = () => {
    switchToUserView();
    navigate("/");
  };

  return (
    <>
      <div className="">
        {/* header-container */}
        <div className="">
          <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-navyblue px-5 py-4">
            {/* logo-w-text-container */}
            <div className="flex items-center gap-1">
              <img
                src={Logo}
                alt="logo_pic"
                className="size-10 hidden lg:block"
              />
              {sideBarOpen && (
                <div className="hidden ml-1 md:block">
                  <h1 className="font-albert-sans font-bold flex items-center text-[23px] text-white transition-all duration-300">
                    <span className="text-brand">Uni</span>Claim
                    <HiOutlineShieldCheck className="ml-2 w-5 h-6 stroke-[1.5px] text-amber-400" />
                  </h1>
                </div>
              )}
              {sideBarOpen ? (
                <HiOutlineMenuAlt2
                  onClick={sideNavClick}
                  className="size-8 ml-2 lg:ml-12 text-white stroke-1 cursor-pointer hover:text-brand"
                />
              ) : (
                <HiOutlineMenuAlt2
                  onClick={sideNavClick}
                  className="size-8 lg:ml-7 text-white stroke-[1.5px] cursor-pointer hover:text-brand"
                />
              )}
            </div>

            {/* admin-controls-container */}
            <div className="flex items-center gap-4 relative">
              {/* notification-bell */}
              <button onClick={toggleNotif} className="relative">
                <HiOutlineBell className="size-8 text-white stroke-[1.3px] cursor-pointer hover:text-brand" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* profile picture */}
              <div className="" ref={profilePictureRef}>
                <ProfilePicture
                  src={userData?.profilePicture}
                  alt="admin-profile"
                  className="cursor-pointer size-10"
                  onClick={toggleProfileMenu}
                />
              </div>

              {/* profile dropdown */}
              {showProfileMenu && (
                <div ref={profileMenuRef} className="absolute font-manrope right-0 top-16 p-2 w-55 bg-white shadow-lg rounded-lg z-50 border border-gray-200">
                  <div className="px-3 py-2 border-b flex items-center gap-1 border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {userData?.firstName} {userData?.lastName}
                    </p>
                    <HiOutlineShieldCheck className="ml-2 w-5 h-6 stroke-[1.5px] text-amber-400" />
                  </div>

                  <button
                    onClick={handleProfileClick}
                    className="flex items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded w-full text-sm"
                  >
                    <HiOutlineUser className="size-4 stroke-[1.5px] mr-3" />
                    Admin Profile
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={handleUserView}
                    className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 rounded w-full text-sm"
                  >
                    <HiOutlineUser className="size-4 stroke-[1.5px] mr-3" />
                    Switch to User View
                  </button>

                  <button
                    onClick={logout}
                    className="flex items-center px-4 py-2 text-red-500 hover:bg-red-50 rounded w-full text-sm"
                  >
                    <IoLogOutOutline className="size-4 stroke-[1.5px] mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* notification dropdown */}
        <div
          className={`fixed font-manrope top-0 right-0 h-full bg-white shadow-lg transition-transform duration-300 z-40 ${
            showNotif ? "translate-x-0" : "translate-x-full"
          } w-full md:w-2/3 lg:w-1/3 flex flex-col`}
        >
          {/* Header */}
          <div className="p-4 flex justify-between items-center border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-navyblue">
                Admin Notifications
              </h2>
              <span className="ml-2 text-sm text-gray-500">
                ({notifications.length}/{NOTIFICATION_LIMIT})
              </span>
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full py-1 px-2">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPreferences(true)}
                className="text-gray-500 hover:text-gray-800 p-1"
                title="Notification Settings"
              >
                <HiOutlineCog className="size-5" />
              </button>
              <button
                onClick={toggleNotif}
                className="text-lg lg:text-gray-500 lg:hover:text-gray-800"
              >
                <HiOutlineX className="size-6 stroke-[1.5px]" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4">
                <p className="text-gray-500 text-center">
                  No admin notifications.
                </p>
              </div>
            ) : (
              <div className="p-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 mb-2 rounded-lg border-l-4 cursor-pointer transition-colors ${
                      notification.read
                        ? "bg-gray-50 border-gray-200"
                        : "bg-yellow-50 border-yellow-500"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 text-xs mt-1">
                          {notification.message}
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          {(() => {
                            const date = notification.createdAt?.toDate?.();
                            if (!date) return "Recently";
                            const now = new Date();
                            const diffMs = now.getTime() - date.getTime();
                            const diffSeconds = Math.floor(diffMs / 1000);
                            const diffMinutes = Math.floor(diffSeconds / 60);
                            const diffHours = Math.floor(diffMinutes / 60);
                            const diffDays = Math.floor(diffHours / 24);
                            const diffWeeks = Math.floor(diffDays / 7);
                            const diffMonths = Math.floor(diffDays / 30);
                            const diffYears = Math.floor(diffDays / 365);

                            if (diffSeconds < 60) return `${diffSeconds}s`;
                            if (diffMinutes < 60) return `${diffMinutes}m`;
                            if (diffHours < 24) return `${diffHours}h`;
                            if (diffDays < 7) return `${diffDays}d`;
                            if (diffWeeks < 4) return `${diffWeeks}w`;
                            if (diffMonths < 12) return `${diffMonths}mth`;
                            return `${diffYears}y`;
                          })()}
                        </p>
                      </div>
                      <div className="flex items-center ml-2">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                          title="Delete notification"
                        >
                          <HiOutlineX className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fixed Bottom Buttons */}
          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 space-y-3 flex-shrink-0">
              <button
                onClick={markAllAsRead}
                className="w-full text-center bg-navyblue hover:bg-blue-900 transition-colors duration-300 py-2.5 text-white rounded-md text-sm font-medium"
              >
                Mark all as read
              </button>
              <button
                onClick={deleteAllNotifications}
                className="w-full text-center transition-colors bg-red-50 hover:bg-red-200 rounded-md text-red-500 py-2.5 duration-300 text-sm font-medium"
              >
                Delete all
              </button>
            </div>
          )}
        </div>

        {showNotif && (
          <div
            className="fixed inset-0 bg-black/35 z-30"
            onClick={toggleNotif}
          />
        )}

        {/* Notification Preferences Modal */}
        {showPreferences && (
          <NotificationPreferencesModal
            onClose={() => setShowPreferences(false)}
          />
        )}
      </div>
    </>
  );
}
