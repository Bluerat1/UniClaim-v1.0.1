import {
  HiOutlineMenuAlt2,
  HiOutlineBell,
  HiOutlineUser,
  HiOutlineX,
  HiOutlineShieldCheck,
  HiOutlineTrash,
} from "react-icons/hi";
import { IoLogOutOutline } from "react-icons/io5";
import Logo from "../assets/uniclaim_logo.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useAdminView } from "@/context/AdminViewContext";
import { useAdminNotifications } from "@/context/AdminNotificationContext";
import ProfilePicture from "@/components/ProfilePicture";
import AdminPostModal from "@/components/AdminPostModal";
import { postService } from "@/services/firebase/posts";
import type { Post } from "@/types/Post";

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
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState(false);

  const toggleProfileMenu = () => setShowProfileMenu((prev) => !prev);
  const toggleNotif = () => setShowNotif((prev) => !prev);

  const handleNotificationClick = async (notification: any) => {
    try {
      // Mark notification as read if it's not already read
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      // Check for postId in different possible locations
      const postId = notification.postId || 
                    (notification.data && (notification.data.postId || notification.data.id));
      
      if (postId) {
        setIsLoadingPost(true);
        try {
          const post = await postService.getPostById(postId);
          if (post) {
            setSelectedPost(post);
            setShowNotif(false); // Close notification panel
          }
        } catch (error) {
          console.error('Error fetching post:', error);
          // Handle error (e.g., show a toast message)
        }
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    } finally {
      setIsLoadingPost(false);
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
              <div className="">
                <ProfilePicture
                  src={userData?.profilePicture}
                  alt="admin-profile"
                  size="md"
                  className="cursor-pointer"
                  onClick={toggleProfileMenu}
                />
              </div>

              {/* profile dropdown */}
              {showProfileMenu && (
                <div className="absolute font-manrope right-0 top-16 p-2 w-55 bg-white shadow-lg rounded-lg z-50 border border-gray-200">
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
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-[10px] rounded-full py-1 px-2">
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={toggleNotif}
              className="text-lg lg:text-gray-500 lg:hover:text-gray-800"
            >
              <HiOutlineX className="size-6 stroke-[1.5px]" />
            </button>
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
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 hover:bg-yellow-100 transition-colors cursor-pointer ${
                      !notification.read
                        ? "bg-blue/10 border-l-4 border-yellow-500"
                        : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`text-sm font-medium ${
                              !notification.read
                                ? "text-blue-900"
                                : "text-gray-900"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <div className="flex items-center space-x-1">
                            {notification.priority === "high" && (
                              <span
                                className="inline-block w-2 h-2 bg-orange-500 rounded-full"
                                title="High priority"
                              ></span>
                            )}
                            {notification.priority === "critical" && (
                              <span
                                className="inline-block w-2 h-2 bg-red-500 rounded-full"
                                title="Critical"
                              ></span>
                            )}
                            <button
                              onClick={() =>
                                deleteNotification(notification.id)
                              }
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Delete notification"
                            >
                              <HiOutlineTrash className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p
                          className={`text-sm mt-1 ${
                            !notification.read
                              ? "text-blue-800"
                              : "text-gray-600"
                          }`}
                        >
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            {notification.type === "new_post" && "📝 New Post"}
                            {notification.type === "flagged_post" &&
                              "🚩 Flagged Post"}
                            {notification.type === "user_report" &&
                              "👤 User Report"}
                            {notification.type === "system_alert" &&
                              "⚠️ System Alert"}
                            {notification.type === "activity_summary" &&
                              "📊 Activity Summary"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {notification.createdAt
                              ?.toDate?.()
                              ?.toLocaleDateString() || "Recently"}
                          </span>
                        </div>
                        {notification.relatedEntity && (
                          <div className="mt-2">
                            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                              {notification.relatedEntity.type}:{" "}
                              {notification.relatedEntity.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="mt-2">
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
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

        {/* Admin Post Modal */}
        {selectedPost && (
          <AdminPostModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onPostUpdate={(updatedPost) => {
              // Update the post in the notifications if needed
              setSelectedPost(updatedPost);
            }}
            onPostDelete={(deletedPostId) => {
              // Close the modal if the post was deleted
              if (selectedPost?.id === deletedPostId) {
                setSelectedPost(null);
              }
            }}
          />
        )}
      </div>
    </>
  );
}
