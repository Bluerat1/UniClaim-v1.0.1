import React from "react";
import ProfilePicture from "./ProfilePicture";

interface ProfilePictureSeenIndicatorProps {
  readBy: Array<{
    uid: string;
    profilePicture?: string | null;
    firstName: string;
    lastName: string;
  }>;
  currentUserId: string;
  maxVisible?: number;
  size?: "xs" | "sm";
}

const ProfilePictureSeenIndicator: React.FC<ProfilePictureSeenIndicatorProps> = ({
  readBy,
  currentUserId,
  maxVisible = 3,
  size = "xs",
}) => {
  // Filter out the current user from read receipts and remove duplicates
  const readers = readBy.filter(
    (reader, index, self) =>
      reader.uid !== currentUserId && index === self.findIndex(r => r.uid === reader.uid)
  );

  // Don't show anything if no one else has read the message
  if (readers.length === 0) {
    return null;
  }

  // Show only the first maxVisible readers
  const visibleReaders = readers.slice(0, maxVisible);
  const hiddenCount = Math.max(0, readers.length - maxVisible);

  // Size configurations
  const sizeClasses = {
    xs: { container: "w-4 h-4", text: "text-[10px]" },
    sm: { container: "w-5 h-5", text: "text-xs" },
  };

  return (
    <div className="flex-row items-center">
      {/* Profile pictures stack */}
      <div className="flex-row">
        {visibleReaders.map((reader, index) => (
          <div
            key={reader.uid}
            className={`relative ${index > 0 ? "-ml-1" : ""}`}
            style={{
              zIndex: visibleReaders.length - index,
            }}
          >
            <ProfilePicture
              src={reader.profilePicture}
              alt={`${reader.firstName} ${reader.lastName}`}
              className={`${sizeClasses[size].container} border border-white`}
            />
          </div>
        ))}
      </div>

      {/* Additional count indicator */}
      {hiddenCount > 0 && (
        <div
          className={`ml-1 px-1.5 rounded-full bg-gray-100 ${sizeClasses[size].text}`}
          style={{
            minHeight: size === "xs" ? 16 : 20,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <span className={`text-gray-600 font-medium ${sizeClasses[size].text}`}>
            +{hiddenCount}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfilePictureSeenIndicator;
