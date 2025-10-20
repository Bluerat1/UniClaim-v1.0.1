import AdminPostModal from "./AdminPostModal";
import type { Post } from "@/types/Post";

interface AdminUnclaimedPostModalProps {
  post: Post;
  onClose: () => void;
  onPostActivate?: (postId: string) => void;
  onPostDelete?: (postId: string) => void;
}

export default function AdminUnclaimedPostModal({
  post,
  onClose,
  onPostActivate,
  onPostDelete,
}: AdminUnclaimedPostModalProps) {
  return (
    <AdminPostModal
      post={post}
      onClose={onClose}
      showUnclaimedFeatures={true}
      onActivatePost={onPostActivate}
      onDelete={(post) => onPostDelete?.(post.id)}
    />
  );
}
