import MobileNavText from "@/components/NavHeadComp";
import { useState } from "react";
import type { Post } from "@/types/Post";
import TicketCard from "@/components/TicketCard";
import TicketModal from "@/components/TicketModal";
import { useAuth } from "../../context/AuthContext";
import { useUserPostsWithSet } from "../../hooks/usePosts";
import { postService } from "../../services/firebase";
import { useToast } from "../../context/ToastContext";

export default function MyTicket() {
  const { userData, loading: authLoading } = useAuth();
  const {
    posts,
    deletedPosts,
    setPosts,
    loading: postsLoading,
  } = useUserPostsWithSet(userData?.email || "");
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<
    "all_tickets" | "active_tickets" | "completed_tickets" | "deleted_tickets"
  >("all_tickets");
  const [searchText, setSearchText] = useState("");
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [restoringPostId, setRestoringPostId] = useState<string | null>(null);
  const [permanentlyDeletingPostId, setPermanentlyDeletingPostId] = useState<
    string | null
  >(null);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show error if no user data
  if (!userData) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Please log in to view your tickets</p>
      </div>
    );
  }

  // Filter posts owned by current user
  const rawUserPosts = posts.filter(
    (post) => post.user.email === userData.email
  );

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const handleDeletePost = async (id: string) => {
    try {
      setDeletingPostId(id); // Show loading state

      // Soft delete the post by setting deletedAt timestamp
      await postService.updatePost(id, {
        deletedAt: new Date().toISOString(),
      });

      // Update local state after successful soft delete
      setPosts((prevPosts: Post[]) =>
        prevPosts.map((p: Post) =>
          p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p
        )
      );
      setSelectedPost(null); // close modal after delete

      // Show success message
      showToast(
        "success",
        "Ticket Moved to Recently Deleted",
        "Your ticket has been moved to Recently Deleted."
      );
    } catch (error: any) {
      console.error("Error moving post to recently deleted:", error);
      showToast(
        "error",
        "Delete Failed",
        "Failed to move ticket to Recently Deleted. Please try again."
      );
    } finally {
      setDeletingPostId(null); // Hide loading state
    }
  };

  const handleRestorePost = async (id: string) => {
    try {
      setRestoringPostId(id);

      // Restore the post by removing the deletedAt timestamp
      await postService.updatePost(id, {
        deletedAt: null,
      });

      // Update local state after successful restore
      setPosts((prevPosts: Post[]) =>
        prevPosts.map((p: Post) =>
          p.id === id ? { ...p, deletedAt: undefined } : p
        )
      );

      // If we're viewing the deleted tab, remove the post from the view
      if (activeTab === "deleted_tickets") {
        setSelectedPost(null);
      }

      showToast(
        "success",
        "Ticket Restored",
        "Your ticket has been restored successfully."
      );
    } catch (error) {
      console.error("Error restoring post:", error);
      showToast(
        "error",
        "Restore Failed",
        "Failed to restore ticket. Please try again."
      );
    } finally {
      setRestoringPostId(null);
    }
  };

  const handlePermanentlyDeletePost = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this ticket? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setPermanentlyDeletingPostId(id);

      // Permanently delete the post
      await postService.deletePost(id);

      // Update local state after successful permanent deletion
      setPosts((prevPosts: Post[]) =>
        prevPosts.filter((p: Post) => p.id !== id)
      );

      // If we're viewing the deleted tab, remove the post from the view
      if (activeTab === "deleted_tickets") {
        setSelectedPost(null);
      }

      showToast(
        "success",
        "Ticket Permanently Deleted",
        "Your ticket has been permanently deleted."
      );
    } catch (error: any) {
      console.error("Error permanently deleting post:", error);

      // Provide more specific error messages based on the error type
      let errorMessage =
        "Failed to permanently delete ticket. Please try again.";
      let errorTitle = "Delete Failed";

      if (
        error.message?.includes("Cloudinary API credentials not configured")
      ) {
        errorTitle = "Configuration Error";
        errorMessage =
          "⚠️ Cloudinary API credentials are not configured. Images cannot be deleted from storage. Please contact your administrator.";
      } else if (
        error.message?.includes("permissions insufficient") ||
        error.message?.includes("401")
      ) {
        errorTitle = "Partial Delete Success";
        errorMessage =
          "✅ Ticket deleted from database successfully! ⚠️ Images remain in Cloudinary storage due to account permission limitations. This won't affect your app functionality.";
      } else if (error.message?.includes("Cloudinary")) {
        errorTitle = "Image Deletion Failed";
        errorMessage =
          "✅ Ticket deleted from database successfully! ⚠️ Some images may remain in Cloudinary storage. This won't affect your app functionality.";
      }

      // Show error message to user
      showToast("error", errorTitle, errorMessage);

      // If the post was partially deleted (database but not images), we should still remove it from local state
      // since the user expects it to be gone
      if (
        error.message?.includes("Ticket deleted") ||
        error.message?.includes("permissions insufficient")
      ) {
        setPosts((prevPosts: Post[]) =>
          prevPosts.filter((p: Post) => p.id !== id)
        );
        setSelectedPost(null);
      }
    } finally {
      setDeletingPostId(null); // Hide loading state
    }
  };

  // Filter posts based on selected tab
  const tabFilteredPosts = (
    activeTab === "deleted_tickets" ? deletedPosts : rawUserPosts
  ).filter((post) => {
    if (activeTab === "all_tickets") return true;
    if (activeTab === "active_tickets")
      return post.status === "pending" || post.status === "unclaimed";
    if (activeTab === "completed_tickets") return post.status === "resolved";
    if (activeTab === "deleted_tickets") return post.deletedAt; // Only show posts with deletedAt timestamp
    return false;
  });

  const visiblePosts = tabFilteredPosts.filter((post) =>
    post.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const tabOptions = [
    { key: "all_tickets", label: "All Tickets" },
    { key: "active_tickets", label: "Active Tickets" },
    { key: "completed_tickets", label: "Completed Tickets" },
    { key: "deleted_tickets", label: "Recently Deleted" },
  ] as const;

  return (
    <div className="mb-13">
      <MobileNavText
        title="My Ticket"
        description="View and edit your posted ticket here"
      />

      <div className="mx-4 lg:mx-6">
        {/* Search Section */}
        <div className="flex items-center justify-between pt-4 mb-5">
          <div className="w-full flex justify-center items-center gap-3 lg:justify-start">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search a ticket"
              className="w-full md:max-w-sm border px-3 py-2 rounded placeholder:text-sm"
            />
            <button className="bg-brand rounded text-white text-sm lg:text-base px-3 py-2 hover:bg-yellow-600 transition-colors">
              Search
            </button>
            <button
              onClick={() => setSearchText("")}
              className="bg-gray-200 rounded text-black text-sm lg:text-base px-3 py-2 hover:bg-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="hidden w-full lg:block lg:text-right space-y-1">
            <h1 className="font-medium text-sm">My Ticket</h1>
            <p className="text-xs text-gray-500">
              View and edit your posted ticket here
            </p>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="flex flex-wrap sm:justify-center items-center gap-2 w-full lg:justify-start lg:gap-3">
          {tabOptions.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 lg:px-8 rounded text-[14px] lg:text-base font-medium transition-colors duration-300
                ${
                  activeTab === tab.key
                    ? "bg-navyblue text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-blue-200 border-gray-300"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Posts Section */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {postsLoading ? (
            <div className="flex h-90 items-center justify-center col-span-full">
              <p className="text-gray-500 text-sm">Loading tickets...</p>
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="flex h-90 items-center justify-center col-span-full">
              <p className="text-gray-500 text-sm">No tickets found.</p>
            </div>
          ) : (
            visiblePosts.map((post) => (
              <div key={post.id} className="relative group">
                {activeTab === "deleted_tickets" && (
                  <div className="absolute top-2 right-2 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    Deleted
                  </div>
                )}
                <TicketCard post={post} onClick={() => setSelectedPost(post)} />
                {activeTab === "deleted_tickets" && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-4 space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestorePost(post.id);
                      }}
                      disabled={restoringPostId === post.id}
                      className="w-full bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {restoringPostId === post.id ? "Restoring..." : "Restore"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePermanentlyDeletePost(post.id);
                      }}
                      disabled={permanentlyDeletingPostId === post.id}
                      className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {permanentlyDeletingPostId === post.id
                        ? "Deleting..."
                        : "Permanently Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {selectedPost && (
          <TicketModal
            key={selectedPost.id} // 💡 This forces modal to re-render fresh data
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onDelete={handleDeletePost}
            isDeleting={deletingPostId === selectedPost.id}
            onUpdatePost={async (updatedPost) => {
              try {
                // Save changes to Firebase
                await postService.updatePost(updatedPost.id, {
                  title: updatedPost.title,
                  description: updatedPost.description,
                  location: updatedPost.location,
                  status: updatedPost.status,
                  createdAt: updatedPost.createdAt,
                  images: updatedPost.images,
                });

                // Update local state after successful Firebase update
                setPosts((prevPosts: Post[]) =>
                  prevPosts.map((p: Post) =>
                    p.id === updatedPost.id ? updatedPost : p
                  )
                );
                setSelectedPost(updatedPost); // still important to update modal state

                // Show success message
                showToast(
                  "success",
                  "Ticket Updated",
                  "Your ticket has been successfully updated!"
                );
              } catch (error: any) {
                console.error("Error updating post:", error);

                // Show error message to user
                let errorMessage = "Failed to update ticket. Please try again.";
                let errorTitle = "Update Failed";

                if (error.message?.includes("Cloudinary")) {
                  errorTitle = "Image Update Failed";
                  errorMessage =
                    "⚠️ Ticket updated but some images may not have been processed correctly. Please check your ticket.";
                }

                showToast("error", errorTitle, errorMessage);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
