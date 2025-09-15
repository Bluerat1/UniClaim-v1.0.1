// Notification preferences component for web app
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { notificationService } from "../services/firebase/notifications";

// Inline type definition to avoid import issues
interface NotificationPreferences {
  newPosts: boolean;
  messages: boolean;
  claimUpdates: boolean;
  adminAlerts: boolean;
  locationFilter: boolean;
  categoryFilter: string[];
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  soundEnabled: boolean;
}
import {
  HiBell,
  HiClock,
  HiLocationMarker,
  HiTag,
  HiVolumeUp,
  HiVolumeOff,
} from "react-icons/hi";
import { FiX } from "react-icons/fi";
import { SoundUtils } from "../utils/soundUtils";

interface NotificationPreferencesComponentProps {
  onClose: () => void;
}

export default function NotificationPreferencesModal({
  onClose,
}: NotificationPreferencesComponentProps) {
  const { userData } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newPosts: true,
    messages: true,
    claimUpdates: true,
    adminAlerts: true,
    locationFilter: false,
    categoryFilter: [],
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
    soundEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioStatus, setAudioStatus] = useState<any>(null);
  const [testingSound, setTestingSound] = useState(false);

  // Available categories for filtering
  const availableCategories = [
    "Electronics",
    "Clothing",
    "Accessories",
    "Books",
    "Bags",
    "Keys",
    "Documents",
    "Jewelry",
    "Sports Equipment",
    "Other",
  ];

  useEffect(() => {
    loadPreferences();
    updateAudioStatus();
  }, [userData?.uid]);

  // Update audio status periodically
  useEffect(() => {
    const interval = setInterval(updateAudioStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateAudioStatus = () => {
    const status = SoundUtils.getAudioStatus();
    setAudioStatus(status);
  };

  const testNotificationSound = async () => {
    setTestingSound(true);
    try {
      const success = await SoundUtils.testNotificationSound();
      if (success) {
        setError(null);
      } else {
        setError("Test sound failed - check your browser audio settings");
      }
    } catch (err: any) {
      setError("Test sound failed: " + (err.message || "Unknown error"));
    } finally {
      setTestingSound(false);
    }
  };

  const loadPreferences = async () => {
    if (!userData?.uid) return;

    try {
      setLoading(true);
      const userPreferences =
        await notificationService.getNotificationPreferences(userData.uid);
      setPreferences(userPreferences);
    } catch (err: any) {
      setError(err.message || "Failed to load preferences");
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!userData?.uid) return;

    try {
      setSaving(true);
      setError(null);
      await notificationService.updateNotificationPreferences(
        userData.uid,
        preferences
      );
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCategoryToggle = (category: string) => {
    setPreferences((prev) => ({
      ...prev,
      categoryFilter: prev.categoryFilter.includes(category)
        ? prev.categoryFilter.filter((c) => c !== category)
        : [...prev.categoryFilter, category],
    }));
  };

  const handleQuietHoursChange = (
    field: "enabled" | "start" | "end",
    value: boolean | string
  ) => {
    setPreferences((prev) => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading preferences...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <HiBell className="mr-2 text-yellow-500" />
            Notification Preferences
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Notification Types */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Notification Types
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HiBell className="mr-2 text-green-600" />
                  <span className="text-gray-700 text-sm">New Posts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.newPosts}
                    onChange={() => handleToggle("newPosts")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HiBell className="mr-2 text-blue-600" />
                  <span className="text-gray-700 text-sm">Messages</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.messages}
                    onChange={() => handleToggle("messages")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HiBell className="mr-2 text-yellow-600" />
                  <span className="text-gray-700 text-sm">Claim Updates</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.claimUpdates}
                    onChange={() => handleToggle("claimUpdates")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <HiBell className="mr-2 text-red-600" />
                  <span className="text-gray-700 text-sm">Admin Alerts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.adminAlerts}
                    onChange={() => handleToggle("adminAlerts")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <HiTag className="mr-2 text-yellow-500" />
              Category Filter
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Only receive notifications for posts in these categories (leave
              empty for all categories)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {availableCategories.map((category) => (
                <label key={category} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={preferences.categoryFilter.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sound Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Sound Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {preferences.soundEnabled ? (
                    <HiVolumeUp className="mr-2 text-yellow-500" />
                  ) : (
                    <HiVolumeOff className="mr-2 text-gray-400" />
                  )}
                  <span className="text-gray-700">Notification Sounds</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.soundEnabled}
                    onChange={() => handleToggle("soundEnabled")}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>

              {/* Audio Status */}
              {audioStatus && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Audio System Status
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        audioStatus.isReady
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {audioStatus.isReady ? "Ready" : "Not Ready"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {audioStatus.message}
                  </p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      Browser: {audioStatus.browserInfo?.name}{" "}
                      {audioStatus.browserInfo?.version}
                    </div>
                    <div>
                      Web Audio API:{" "}
                      {audioStatus.browserInfo?.supportsWebAudio
                        ? "Supported"
                        : "Not Supported"}
                    </div>
                    <div>
                      Autoplay Policy: {audioStatus.browserInfo?.autoplayPolicy}
                    </div>
                    <div>
                      Requires User Gesture:{" "}
                      {audioStatus.browserInfo?.requiresUserGesture
                        ? "Yes"
                        : "No"}
                    </div>
                  </div>
                </div>
              )}

              {/* Test Sound Button */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700 text-sm lg:text-base">
                    Test Notification Sound
                  </span>
                  <p className="text-xs lg:text-sm text-gray-500">
                    Click to test if notification sounds are working
                  </p>
                </div>
                <button
                  onClick={testNotificationSound}
                  disabled={testingSound || !preferences.soundEnabled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    testingSound || !preferences.soundEnabled
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-yellow-500 text-white hover:bg-yellow-600"
                  }`}
                >
                  {testingSound ? "Testing..." : "Test Sound"}
                </button>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <HiClock className="mr-2 text-yellow-500" />
              Quiet Hours
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Enable quiet hours</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.quietHours.enabled}
                    onChange={(e) =>
                      handleQuietHoursChange("enabled", e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-navyblue rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navyblue"></div>
                </label>
              </div>

              {preferences.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.start}
                      onChange={(e) =>
                        handleQuietHoursChange("start", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={preferences.quietHours.end}
                      onChange={(e) =>
                        handleQuietHoursChange("end", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={savePreferences}
            disabled={saving}
            className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
