import type { Post } from "@/types/Post";
import { useEffect, useState } from "react";

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

const TicketCard = ({ post, onClick }: PostCardProps) => {
  const [imageError, setImageError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Handle image display with proper validation
  const firstImg = (() => {
    // Check if images array exists and has elements
    if (!post.images || post.images.length === 0) {
      return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDIwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiNGM0Y0RjYiLz48dGV4dCB4PSIxMDAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOENBOUE5IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==";
    }

    const firstImage = post.images[0];

    // If it's a string (URL), use it directly
    if (typeof firstImage === "string") {
      return firstImage;
    }

    // If it's a File object, create object URL
    if (firstImage && typeof firstImage === "object" && "type" in firstImage) {
      const url = URL.createObjectURL(firstImage as File | Blob);
      setObjectUrl(url);
      return url;
    }

    // Fallback for any other case
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDIwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiNGM0Y0RjYiLz48dGV4dCB4PSIxMDAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOENBOUE5IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==";
  })();

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded hover:shadow-md/3 transition-all bg-white relative"
    >
      <div className="relative">
        <img
          src={imageError ? "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE0MCIgdmlld0JveD0iMCAwIDIwMCAxNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNDAiIGZpbGw9IiNGM0Y0RjYiLz48dGV4dCB4PSIxMDAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOENBOUE5IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==" : firstImg}
          alt="ticket_thumbnail"
          className="w-full h-70 object-cover rounded-t"
          onError={() => setImageError(true)}
        />
        <div className="absolute top-2 right-2 flex flex-row gap-2">
          {post.type === "found" && post.foundAction && (
            <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
              {post.foundAction === "keep"
                ? "Keep"
                : post.foundAction === "turnover to OSA"
                ? "OSA"
                : "Campus Security"}
            </span>
          )}
          <span
            className={`text-xs font-semibold capitalize px-2 py-1 rounded ${
              post.status === "resolved"
                ? "bg-green-100 text-green-700"
                : post.status === "unclaimed"
                ? "bg-orange-100 text-orange-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {post.status || "pending"}
          </span>
        </div>
      </div>

      <div className="p-3">
        <div className="mb-2">
          <span className="font-semibold text-lg">{post.title}</span>
        </div>
        <div className="flex flex-col gap-3 mb-2">
          <p className="text-xs text-gray-500">
            Last seen location: {post.location}
          </p>
          <p className="text-xs text-gray-400">
            {post.createdAt
              ? new Date(post.createdAt).toLocaleString()
              : "Unknown date"}
          </p>
        </div>

        <span className="text-sm text-gray-600 line-clamp-1 font-inter">
          {post.description}
        </span>
      </div>
    </div>
  );
};

export default TicketCard;
