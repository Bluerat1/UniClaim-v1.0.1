import type { Post } from "@/types/Post";

interface PostCardProps {
  post: Post;
  onClick: () => void;
}

const TicketCard = ({ post, onClick }: PostCardProps) => {
  const firstImg =
    typeof post.images[0] === "string"
      ? post.images[0]
      : URL.createObjectURL(post.images[0]);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded hover:shadow-md/3 transition-all bg-white relative"
    >
      <div className="relative">
        <img
          src={firstImg}
          alt="ticket_thumbnail"
          className="w-full h-70 object-cover rounded-t"
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
        <div className="flex gap-3 mb-2">
          <p className="text-xs text-gray-500">
            Last seen location: {post.location}
          </p>
          <p className="text-xs text-gray-400">
            {post.createdAt
              ? new Date(post.createdAt).toLocaleString()
              : "Unknown date"}
          </p>
        </div>

        {/* Status-specific information */}
        {post.status === "resolved" && (
          <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded">
            <p className="text-xs text-green-700 font-medium">
              ✅ Handover completed - This ticket cannot be edited or deleted
            </p>
          </div>
        )}

        <span className="text-sm text-gray-600 line-clamp-3 font-inter">
          {post.description}
        </span>
      </div>
    </div>
  );
};

export default TicketCard;
