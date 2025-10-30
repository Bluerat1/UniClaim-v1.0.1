import React from "react";
import EmptyProfile from "@/assets/empty_profile.jpg";

interface ProfilePictureProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  priority?: boolean;
  onClick?: () => void;
}

const ProfilePicture: React.FC<ProfilePictureProps> = ({
  src,
  alt,
  className = "",
  fallbackSrc = EmptyProfile,
  priority = false,
  onClick,
}) => {
  const imageSrc = src && src.trim() !== "" ? src : fallbackSrc;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`rounded-full object-cover border border-gray-200 ${className}`}
      loading={priority ? "eager" : "lazy"}
      onClick={onClick}
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.src = fallbackSrc;
      }}
    />
  );
};

export default ProfilePicture;
