import React, { useState, useEffect } from "react";
import { useAnnouncements } from "@/context/AnnouncementContext";
import { useToast } from "@/context/ToastContext";
import type {
  Announcement,
  CreateAnnouncementData,
} from "@/services/firebase/announcements";
import PageWrapper from "@/components/PageWrapper";
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineEyeOff,
} from "react-icons/hi";
import { HiOutlineSpeakerWave } from "react-icons/hi2";

export default function AdminAnnouncementsPage() {
  const {
    announcements,
    loading,
    error,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementStatus,
    refreshAnnouncements,
  } = useAnnouncements();

  const { showToast } = useToast();

  // State for modals and forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateAnnouncementData>({
    message: "",
    priority: "normal",
    isActive: true,
    expiresAt: undefined,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load announcements on mount
  useEffect(() => {
    refreshAnnouncements();
  }, [refreshAnnouncements]);

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.message.trim()) {
      errors.message = "Message is required";
    } else if (formData.message.length > 200) {
      errors.message = "Message must be 200 characters or less";
    }

    if (formData.expiresAt && new Date(formData.expiresAt) <= new Date()) {
      errors.expiresAt = "Expiration date must be in the future";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle create announcement
  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);
      await createAnnouncement(formData);

      showToast("success", "Announcement created successfully");
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      showToast("error", "Failed to create announcement");
      console.error("Error creating announcement:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit announcement
  const handleEditAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAnnouncement || !validateForm()) return;

    try {
      setIsSubmitting(true);
      await updateAnnouncement(selectedAnnouncement.id, formData);

      showToast("success", "Announcement updated successfully");
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      showToast("error", "Failed to update announcement");
      console.error("Error updating announcement:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete announcement
  const handleDeleteAnnouncement = async () => {
    if (!selectedAnnouncement) return;

    try {
      await deleteAnnouncement(selectedAnnouncement.id);
      showToast("success", "Announcement deleted successfully");
      setShowDeleteModal(false);
      setSelectedAnnouncement(null);
    } catch (error) {
      showToast("error", "Failed to delete announcement");
      console.error("Error deleting announcement:", error);
      s;
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (announcement: Announcement) => {
    try {
      await toggleAnnouncementStatus(announcement.id);
      showToast(
        `Announcement ${
          announcement.isActive ? "deactivated" : "activated"
        } successfully`,
        "success"
      );
    } catch (error) {
      showToast("error", "Failed to toggle announcement status");
      console.error("Error toggling announcement status:", error);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      message: "",
      priority: "normal",
      isActive: true,
      expiresAt: undefined,
    });
    setFormErrors({});
  };

  // Open edit modal
  const openEditModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      message: announcement.message,
      priority: announcement.priority,
      isActive: announcement.isActive,
      expiresAt: announcement.expiresAt
        ? announcement.expiresAt.toDate()
        : undefined,
    });
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowDeleteModal(true);
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedAnnouncement(null);
    resetForm();
  };

  // Format date for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "No expiration";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  // Get priority badge color
  const getPriorityBadgeColor = (priority: string) => {
    return priority === "urgent"
      ? "bg-red-100 text-red-800"
      : "bg-blue-100 text-blue-800";
  };

  // Get status badge color
  const getStatusBadgeColor = (isActive: boolean) => {
    return isActive
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <PageWrapper title="Announcements">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Announcements">
      <div className="w-full mx-auto">
        {/* Page Header */}
        <div className="hidden px-4.5 py-3 sm:px-6 lg:px-8 lg:flex items-center justify-between fixed left-20 top-18 right-0 z-10 bg-gray-50 border-b border-zinc-200">
          <div className="">
            <h1 className="text-base font-medium text-gray-900">
              Announcements Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage system-wide announcements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <HiOutlinePlus className="w-4 h-4" />
              New Announcement
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden py-4 px-4.5 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Announcements
              </h1>
              <p className="text-sm text-gray-500">
                Manage system announcements
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <HiOutlinePlus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="lg:mt-30 p-4 sm:p-6 lg:p-8">
          {/* Error state */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Announcements List */}
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center py-12">
                <HiOutlineSpeakerWave className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No announcements
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new announcement.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand hover:bg-yellow-600"
                  >
                    <HiOutlinePlus className="w-4 h-4 mr-2" />
                    New Announcement
                  </button>
                </div>
              </div>
            ) : (
              announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadgeColor(
                            announcement.priority
                          )}`}
                        >
                          {announcement.priority.toUpperCase()}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(
                            announcement.isActive
                          )}`}
                        >
                          {announcement.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <p className="text-gray-900 font-medium my-4">
                        {announcement.message}
                      </p>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Created: {formatDate(announcement.createdAt)}</p>
                        {announcement.expiresAt && (
                          <p>Expires: {formatDate(announcement.expiresAt)}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleStatus(announcement)}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.isActive
                            ? "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                        }`}
                        title={
                          announcement.isActive ? "Deactivate" : "Activate"
                        }
                      >
                        {announcement.isActive ? (
                          <HiOutlineEyeOff className="w-5 h-5" />
                        ) : (
                          <HiOutlineEye className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={() => openEditModal(announcement)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => openDeleteModal(announcement)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {showCreateModal
                  ? "Create New Announcement"
                  : "Edit Announcement"}
              </h2>

              <form
                onSubmit={
                  showCreateModal
                    ? handleCreateAnnouncement
                    : handleEditAnnouncement
                }
              >
                <div className="space-y-4">
                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Message <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
                        formErrors.message
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      placeholder="Enter announcement message..."
                    />
                    {formErrors.message && (
                      <p className="mt-1 text-sm text-red-600">
                        {formErrors.message}
                      </p>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    >
                      <option value="normal">Normal</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Active Status */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-brand focus:ring-brand border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-700">
                      Active (visible to users)
                    </label>
                  </div>

                  {/* Expiration Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiration Date (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      name="expiresAt"
                      value={
                        formData.expiresAt
                          ? formData.expiresAt.toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          expiresAt: value ? new Date(value) : undefined,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                    {formErrors.expiresAt && (
                      <p className="mt-1 text-sm text-red-600">
                        {formErrors.expiresAt}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-brand text-white hover:bg-yellow-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Saving..."
                      : showCreateModal
                      ? "Create"
                      : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedAnnouncement && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Delete Announcement
              </h2>
              <p className="text-gray-600 mb-5 text-base">
                Are you sure you want to delete this announcement? This action
                cannot be undone.
              </p>
              <div className="bg-gray-50 border border-gray-100 p-3 rounded-md mb-6">
                <p className="text-sm text-gray-700">
                  {selectedAnnouncement.message}
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAnnouncement}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
