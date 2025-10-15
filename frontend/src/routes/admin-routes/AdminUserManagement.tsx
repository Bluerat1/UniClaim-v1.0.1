import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  doc,
  updateDoc,
  where,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../utils/firebase";
import type { User } from "../../types/User";
import ProfilePicture from "../../components/ProfilePicture";
import { MdClear } from "react-icons/md";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

function fuzzyMatch(text: string, query: string): boolean {
  const cleanedText = text.toLowerCase();
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);

  // Make sure every keyword appears in the text
  return queryWords.every((word) => cleanedText.includes(word));
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search state with debouncing
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Debounce search text to reduce excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // View user modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Ban user modal states
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [customBanReason, setCustomBanReason] = useState("");
  const [banDuration, setBanDuration] = useState<"temporary" | "permanent">(
    "temporary"
  );
  const [banDays, setBanDays] = useState(7);
  const [banNotes, setBanNotes] = useState("");
  const [banningUser, setBanningUser] = useState<User | null>(null);

  // Unban user modal states
  const [showUnbanModal, setShowUnbanModal] = useState(false);
  const [unbanningUser, setUnbanningUser] = useState<User | null>(null);
  const [unbanReason, setUnbanReason] = useState("");

  const { showToast } = useToast();
  const {} = useAuth();

  // Load initial users
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersRef = collection(db, "users");
      const q = query(usersRef, orderBy("createdAt", "desc"), limit(100)); // Increased limit for better pagination
      const snapshot = await getDocs(q);

      const userData: User[] = [];
      snapshot.forEach((doc) => {
        const userDataItem = { uid: doc.id, ...doc.data() } as User;
        // Only include regular users (exclude admins)
        if (userDataItem.role !== "admin") {
          userData.push(userDataItem);
        }
      });

      setUsers(userData);
    } catch (err: any) {
      setError("Failed to load users");
      showToast("error", "Error", "Failed to load users");
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  // Apply search and status filtering to users
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply status filter
    if (statusFilter && statusFilter !== "All") {
      filtered = filtered.filter(
        (user) => user.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Apply search filter if debounced query exists
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((user) => {
        return (
          fuzzyMatch(`${user.firstName} ${user.lastName}`, query) ||
          fuzzyMatch(user.email || "", query) ||
          fuzzyMatch(user.studentId || "", query) ||
          fuzzyMatch(user.contactNum || "", query)
        );
      });
    }

    return filtered;
  }, [users, statusFilter, debouncedSearchQuery]);

  // Pagination logic
  const totalUsersToShow = Math.min(
    filteredUsers.length,
    currentPage * itemsPerPage
  );
  const hasMoreUsers = filteredUsers.length > totalUsersToShow;

  // Function to load more users when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMoreUsers && !loading) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMoreUsers, loading]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, statusFilter]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("All");
    setCurrentPage(1);
  }, [setCurrentPage]);

  // View user functions
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setShowUserModal(false);
  };

  // Ban user functions
  const handleBanUser = (user: User) => {
    setBanningUser(user);
    setShowBanModal(true);
    // Reset form fields
    setBanReason("");
    setBanDuration("temporary");
    setBanDays(7);
    setBanNotes("");
  };

  const handleCloseBanModal = () => {
    setShowBanModal(false);
    setBanningUser(null);
    // Reset form fields
    setBanReason("");
    setCustomBanReason("");
    setBanDuration("temporary");
    setBanDays(7);
    setBanNotes("");
  };

  const handleSubmitBan = async () => {
    if (!banningUser || !banReason) return;

    // Validate custom reason if "other" is selected
    if (banReason === "other" && !customBanReason.trim()) {
      alert("Please enter a custom ban reason");
      return;
    }

    try {
      // Calculate ban end date
      const banStartDate = new Date();
      const banEndDate =
        banDuration === "temporary"
          ? new Date(banStartDate.getTime() + banDays * 24 * 60 * 60 * 1000)
          : null; // null for permanent bans

      // Determine the final reason to use
      const finalReason =
        banReason === "other" ? customBanReason.trim() : banReason;

      // Create ban record
      const banData = {
        userId: banningUser.uid,
        adminId: "admin", // TODO: Get actual admin ID from auth context
        reason: finalReason,
        duration: banDuration,
        banDays: banDuration === "temporary" ? banDays : null,
        banStartDate: banStartDate,
        banEndDate: banEndDate,
        notes: banNotes || "",
        isActive: true,
        createdAt: banStartDate,
      };

      // Add ban record to userBans collection
      const userBansRef = collection(db, "userBans");
      await addDoc(userBansRef, banData);

      // Update user status to deactivated
      const userRef = doc(db, "users", banningUser.uid);
      await updateDoc(userRef, {
        status: "deactivated",
        banInfo: {
          isBanned: true,
          banEndDate: banEndDate,
          currentBanId: banData.userId, // This will be the ban document ID
          reason: finalReason,
          duration: banDuration,
        },
      });

      // Close modal and refresh users
      handleCloseBanModal();
      await loadUsers(); // Refresh the user list to show updated status

      // Show success toast
      showToast(
        "success",
        "User Deactivated",
        `${banningUser.firstName} ${banningUser.lastName} has been successfully deactivated`
      );
      console.log("User banned successfully");
    } catch (error: any) {
      showToast("error", "Error", error.message || "Failed to deactivate user");
      console.error("Error banning user:", error);
    }
  };

  const handleUnbanUser = (user: User) => {
    setUnbanningUser(user);
    setShowUnbanModal(true);
    setUnbanReason("");
  };

  const handleCloseUnbanModal = () => {
    setShowUnbanModal(false);
    setUnbanningUser(null);
    setUnbanReason("");
  };

  const handleSubmitUnban = async () => {
    if (!unbanningUser) return;

    try {
      // Find and delete the active ban record
      const userBansRef = collection(db, "userBans");
      const banQuery = query(
        userBansRef,
        where("userId", "==", unbanningUser.uid),
        where("isActive", "==", true)
      );
      const banSnapshot = await getDocs(banQuery);

      // Delete the ban record completely
      if (!banSnapshot.empty) {
        const banDoc = banSnapshot.docs[0];
        await deleteDoc(banDoc.ref);
        console.log("Ban record deleted successfully");
      }

      // Update user status back to active
      const userRef = doc(db, "users", unbanningUser.uid);
      await updateDoc(userRef, {
        status: "active",
        banInfo: {
          isBanned: false,
          banEndDate: null,
          currentBanId: null,
          reason: null,
          duration: null,
        },
      });

      // Close modal and refresh users
      handleCloseUnbanModal();
      await loadUsers(); // Refresh the user list to show updated status

      // Show success toast
      showToast(
        "success",
        "User Reactivated",
        `${unbanningUser.firstName} ${unbanningUser.lastName} has been successfully reactivated`
      );
      console.log("User unbanned and ban record deleted successfully");
    } catch (error: any) {
      showToast("error", "Error", error.message || "Failed to reactivate user");
      console.error("Error unbanning user:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-lg font-medium mb-3">User Management</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg mb-6 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="w-full">
            <input
              type="text"
              placeholder="Search users by name, email, or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm md:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 text-sm focus:ring-brand"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="deactivated">Deactivated</option>
            </select>
            <button
              onClick={handleClearSearch}
              className="px-3 py-2 bg-red-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <MdClear className="size-5 text-red-500" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg mb-10 shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium">
            Regular Users ({filteredUsers.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <div className="relative">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    User
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Email
                  </th>
                  <th className="px-10 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Joined
                  </th>
                  <th className="-px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Actions
                  </th>
                </tr>
              </thead>
            </table>
            <div className="max-h-145 overflow-y-auto border-t border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="bg-white">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <p className="text-lg font-medium mb-2">
                            No users found
                          </p>
                          <p className="text-sm">
                            {debouncedSearchQuery || statusFilter !== "All"
                              ? "Try adjusting your search or filter criteria"
                              : "Users will appear here once they register"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.slice(0, totalUsersToShow).map((user) => (
                      <tr key={user.uid} className="hover:bg-brand/8">
                        <td className="px-6 py-4 whitespace-nowrap w-1/5">
                          <div className="flex items-center">
                            <ProfilePicture
                              src={user.profilePicture}
                              alt={`${user.firstName} ${user.lastName}`}
                              className="mr-4 size-9"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                @{user.studentId || "No ID"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-1/5">
                          {user.email}
                        </td>
                        <td className="px-7 py-4 whitespace-nowrap w-1/6">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.status === "deactivated"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {user.status === "deactivated"
                              ? "Deactivated"
                              : "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 w-1/6">
                          {user.createdAt
                            ? user.createdAt.toDate
                              ? new Date(
                                  user.createdAt.toDate()
                                ).toLocaleDateString()
                              : new Date(user.createdAt).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-0 py-4 whitespace-nowrap text-sm font-medium w-1/5">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors text-sm font-medium mr-2"
                          >
                            View
                          </button>
                          {user.status === "deactivated" ? (
                            <button
                              onClick={() => handleUnbanUser(user)}
                              className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleBanUser(user)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Load More Button */}
      {hasMoreUsers && !loading && (
        <div className="flex justify-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-3 bg-brand text-white rounded-lg hover:bg-teal-600 transition-colors shadow-sm"
          >
            Load More Users ({filteredUsers.length - totalUsersToShow}{" "}
            remaining)
          </button>
        </div>
      )}

      {/* Ban User Modal */}
      {showBanModal && banningUser && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Deactivate User
                </h3>
                <button
                  onClick={handleCloseBanModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Ban Form */}
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Deactivate User:
                  </h4>
                  <p className="text-gray-700">
                    {banningUser.firstName} {banningUser.lastName} (
                    {banningUser.email})
                  </p>
                </div>

                {/* Ban Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Account Deactivation{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={banReason}
                    onChange={(e) => {
                      setBanReason(e.target.value);
                      if (e.target.value !== "other") {
                        setCustomBanReason("");
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  >
                    <option value="">Select a reason</option>
                    <option value="spam">Spam or Repeated Posts</option>
                    <option value="harassment">Harassment or Bullying</option>
                    <option value="fake">Fake or Misleading Posts</option>
                    <option value="inappropriate">Inappropriate Content</option>
                    <option value="violation">
                      Terms of Service Violation
                    </option>
                    <option value="other">Other</option>
                  </select>

                  {/* Custom Reason Input for "Other" */}
                  {banReason === "other" && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom Reason <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customBanReason}
                        onChange={(e) => setCustomBanReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter custom ban reason..."
                        maxLength={100}
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Maximum 100 characters
                      </p>
                    </div>
                  )}
                </div>

                {/* Ban Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Deactivate Duration{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="temporary"
                        checked={banDuration === "temporary"}
                        onChange={(e) =>
                          setBanDuration(
                            e.target.value as "temporary" | "permanent"
                          )
                        }
                        className="mr-2"
                      />
                      Temporary Deactivation
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="permanent"
                        checked={banDuration === "permanent"}
                        onChange={(e) =>
                          setBanDuration(
                            e.target.value as "temporary" | "permanent"
                          )
                        }
                        className="mr-2"
                      />
                      Permanent Deactivation
                    </label>
                  </div>
                </div>

                {/* Ban Days (for temporary bans) */}
                {banDuration === "temporary" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Account Deactivation Period (Days){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={banDays}
                      onChange={(e) =>
                        setBanDays(parseInt(e.target.value) || 1)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="7"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Maximum 365 days
                    </p>
                  </div>
                )}

                {/* Admin Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Notes (Optional)
                  </label>
                  <textarea
                    value={banNotes}
                    onChange={(e) => setBanNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Additional details about this account deactivation..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={handleCloseBanModal}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-sm hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitBan}
                    disabled={!banReason}
                    className="px-4 py-2 text-white bg-red-600 rounded-sm hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Deactivate User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unban User Modal */}
      {showUnbanModal && unbanningUser && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Reactivate User
                </h3>
                <button
                  onClick={handleCloseUnbanModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              {/* Unban Form */}
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-medium text-green-900 mb-2">
                    Reactivate User:
                  </h4>
                  <p className="text-green-700">
                    {unbanningUser.firstName} {unbanningUser.lastName} (
                    {unbanningUser.email})
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    This will restore their account access immediately.
                  </p>
                </div>

                {/* Unban Reason (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason of Account Activation (Optional)
                  </label>
                  <textarea
                    value={unbanReason}
                    onChange={(e) => setUnbanReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Why are you reactivate this user account? (Optional)"
                  />
                </div>

                {/* Warning Message */}
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Important Note
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          Reactivate an account will immediately restore this
                          user's access to the app. Make sure this action is
                          appropriate.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    onClick={handleCloseUnbanModal}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitUnban}
                    className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                  >
                    Reactivate User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-30 mx-auto p-5 w-11/12 md:w-3/4 lg:w-1/2 rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-manrope font-semibold text-gray-900">
                  User Details
                </h3>
              </div>

              {/* User Information */}
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="flex items-center space-x-4">
                  <ProfilePicture
                    src={
                      selectedUser.profilePicture ||
                      selectedUser.profileImageUrl
                    }
                    alt={`${selectedUser.firstName} ${selectedUser.lastName}`}
                    className="size-15"
                  />
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </h4>
                    <p className="text-gray-600">
                      @{selectedUser.studentId || "No ID"}
                    </p>
                  </div>
                </div>

                {/* User Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <p className="text-gray-900">{selectedUser.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Number
                    </label>
                    <p className="text-gray-900">
                      {selectedUser.contactNum || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Student ID
                    </label>
                    <p className="text-gray-900">
                      {selectedUser.studentId || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Account Status
                    </label>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedUser.status === "deactivated"
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {selectedUser.status === "deactivated"
                        ? "Deactivated"
                        : "Active"}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Joined Date
                    </label>
                    <p className="text-gray-900">
                      {selectedUser.createdAt
                        ? selectedUser.createdAt.toDate
                          ? new Date(
                              selectedUser.createdAt.toDate()
                            ).toLocaleDateString()
                          : new Date(
                              selectedUser.createdAt
                            ).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Updated
                    </label>
                    <p className="text-gray-900">
                      {selectedUser.updatedAt
                        ? selectedUser.updatedAt.toDate
                          ? new Date(
                              selectedUser.updatedAt.toDate()
                            ).toLocaleDateString()
                          : new Date(
                              selectedUser.updatedAt
                            ).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCloseUserModal}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-sm hover:bg-gray-300 transition-colors"
                  >
                    Close
                  </button>
                  {selectedUser.status === "deactivated" ? (
                    <button
                      onClick={() => {
                        handleCloseUserModal();
                        handleUnbanUser(selectedUser);
                      }}
                      className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                    >
                      Reactivate User
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleCloseUserModal();
                        handleBanUser(selectedUser);
                      }}
                      className="px-4 py-2 text-white bg-red-600 rounded-sm hover:bg-red-700 transition-colors"
                    >
                      Deactivate User
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
