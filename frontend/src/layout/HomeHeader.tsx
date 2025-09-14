import {
  HiOutlineMenuAlt2,
  HiOutlineBell,
  HiOutlineUser,
  HiOutlineX,
  HiOutlineCog,
} from "react-icons/hi";
import { IoLogOutOutline } from "react-icons/io5";
import Logo from "../assets/uniclaim_logo.png";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAdminView } from "@/context/AdminViewContext";
import { useNotifications } from "@/context/NotificationContext";
import { useCurrentAnnouncement } from "@/context/AnnouncementContext";
import ProfilePicture from "@/components/ProfilePicture";
import NotificationPreferencesModal from "@/components/NotificationPreferences";
import PostModal from "@/components/PostModal";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { postService } from "@/services/firebase/posts";
import type { Post } from "@/types/Post";
import { authService } from "@/utils/firebase";
import { useEffect } from "react";

interface HomeHeaderProps {
  sideNavClick: () => void;
  sideBarOpen: boolean;
}

export default function HomeHeader({
  sideBarOpen,
  sideNavClick,
}: HomeHeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const toggleProfileMenu = () => setShowProfileMenu((prev) => !prev);
  const toggleNotif = () => setShowNotif((prev) => !prev);

  const { logout, userData, user } = useAuth();
  const { isViewingAsUser, switchToAdminView } = useAdminView();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications();
  const {
    currentAnnouncement,
    hasActiveAnnouncements,
    loading: announcementLoading,
  } = useCurrentAnnouncement();
  const [isAdmin, setIsAdmin] = useState(false);

  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user) {
        try {
          const adminStatus = await authService.isAdmin(user.uid);
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      }
    };

    checkAdminStatus();
  }, [user]);

  // Handle notification clicks to open post modal
  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // If notification has a postId, fetch the post and open modal
    if (notification.postId) {
      try {
        const post = await postService.getPostById(notification.postId);
        if (post) {
          setSelectedPost(post);
          toggleNotif(); // Close the notification dropdown
        } else {
          console.error("Post not found:", notification.postId);
        }
      } catch (error) {
        console.error("Error fetching post:", error);
      }
    }
  };

  const handleProfileClick = () => {
    setShowProfileMenu(false); // Hide dropdown
    navigate("/profile"); // Navigate to profile
  };

  return (
    <>
      <div className="">
        {/* header-container */}
        <div className="">
          <div className="fixed left-0 right-0 z-40 flex items-center justify-between bg-navyblue px-5 py-4 top-0">
            {/* logo-w-text-container */}
            <div className="flex items-center gap-1">
              <img
                src={Logo}
                alt="logo_pic"
                className="size-10 hidden lg:block"
              />
              {sideBarOpen && (
                <h1 className="hidden ml-1 font-albert-sans font-bold text-[23px] text-white transition-all duration-300 md:block">
                  <span className="text-brand">Uni</span>Claim
                </h1>
              )}
              {sideBarOpen ? (
                <HiOutlineMenuAlt2
                  onClick={sideNavClick}
                  className="size-8 ml-2 lg:ml-17 text-white stroke-1 cursor-pointer hover:text-brand"
                />
              ) : (
                <HiOutlineMenuAlt2
                  onClick={sideNavClick}
                  className="size-8 lg:ml-7 text-white stroke-[1.5px] cursor-pointer hover:text-brand"
                />
              )}
            </div>

            {/* Announcement Banner - positioned between menu and notifications */}
            <AnnouncementBanner
              message={currentAnnouncement?.message || ""}
              isVisible={hasActiveAnnouncements && !announcementLoading}
              priority={currentAnnouncement?.priority || "normal"}
            />

            {/* notification-bell-w-profile-container */}
            <div className="flex items-center gap-4 relative">
              {/* notification-bell */}
              <button onClick={toggleNotif} className="relative">
                <HiOutlineBell className="size-8 text-white stroke-[1.3px] cursor-pointer hover:text-brand" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {/* profile picture */}
              <div className="">
                <ProfilePicture
                  src={userData?.profilePicture}
                  alt="user-profile"
                  size="md"
                  className="cursor-pointer"
                  onClick={toggleProfileMenu}
                />
              </div>

              {/* profile dropdown */}
              {showProfileMenu && (
                <div className="absolute font-manrope right-0 top-16 p-2 w-40 bg-white shadow-xs rounded-sm z-50">
                  <button
                    onClick={handleProfileClick}
                    className="flex items-center px-4 py-2 text-gray-800 hover:bg-gray-100 rounded w-full text-sm"
                  >
                    <HiOutlineUser className="size-4 stroke-[1.5px] mr-3" />
                    <Link to="/profile">My Profile</Link>
                  </button>

                  {/* Show admin switch button only if user is admin and viewing as user */}
                  {isAdmin && isViewingAsUser && (
                    <>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button
                        onClick={() => {
                          switchToAdminView();
                          navigate("/admin");
                        }}
                        className="flex items-center px-4 py-2 text-blue-600 hover:bg-blue-50 rounded w-full text-sm"
                      >
                        <HiOutlineCog className="size-4 stroke-[1.5px] mr-3" />
                        Switch to Admin
                      </button>
                    </>
                  )}

                  <button
                    onClick={logout}
                    className="flex items-center px-4 py-2 text-red-500 hover:bg-red-50/70 rounded w-full text-sm"
                  >
                    <IoLogOutOutline className="size-4 stroke-[1.5px] mr-3" />
                    Log-out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* notification dropdown */}
        <div
          className={`fixed font-manrope p-3 right-0 h-full bg-white shadow-lg transition-transform duration-300 z-40 ${
            showNotif ? "translate-x-0" : "translate-x-full"
          } w-full md:w-2/3 lg:w-1/3 top-0`}
        >
          <div className="p-4 flex justify-between items-center border-b border-gray-200">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold text-navyblue">
                Notifications Dummy
              </h2>
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
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

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4">
                <p className="text-gray-500 text-center">
                  No notifications yet.
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
                        : "bg-blue-50 border-blue-500"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 text-sm">
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 text-xs mt-1">
                          {notification.body}
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          {new Date(
                            notification.createdAt?.toDate?.() ||
                              notification.createdAt
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center ml-2">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the notification click
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

          {notifications.length > 0 && (
            <div className="p-4 border-t border-gray-200 space-y-2">
              <button
                onClick={markAllAsRead}
                className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Mark all as read
              </button>
              <button
                onClick={deleteAllNotifications}
                className="w-full text-center text-red-600 hover:text-red-800 text-sm font-medium"
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

      {/* PostModal for notifications */}
      {selectedPost && (
        <PostModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          hideSendMessage={false}
        />
      )}
    </>
  );
}
