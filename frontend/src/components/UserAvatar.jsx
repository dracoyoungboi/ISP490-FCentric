import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getInitials, hashUserId } from "@/utils/avatar";

const SIZE_MAP = {
  xs: { root: "size-8", fallback: "text-xs" },
  sm: { root: "size-10", fallback: "text-sm" },
  md: { root: "size-14", fallback: "text-base" },
  lg: { root: "h-24 w-24", fallback: "text-2xl" },
};

// Màu nền initials ỔN ĐỊNH theo userId (hash -> palette, không random):
// cùng một người luôn cùng một màu trên mọi trang, mọi lần refresh.
// Class viết tường minh để Tailwind sinh đủ các màu.
const FALLBACK_STYLES = [
  "bg-bo-primary-soft text-bo-primary",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

// Shared user avatar: ảnh từ avatarUrl (DTO/DB) → fallback initials với màu
// nền ổn định. Ảnh lỗi tải tự rơi về initials (Radix AvatarFallback).
export default function UserAvatar({ userId, name, avatarUrl, size = "sm", className = "" }) {
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.sm;
  const fallbackStyle =
    FALLBACK_STYLES[hashUserId(userId) % FALLBACK_STYLES.length] || FALLBACK_STYLES[0];

  return (
    <Avatar className={cn(sizeClasses.root, className)}>
      {avatarUrl ? (
        <AvatarImage
          src={avatarUrl}
          alt={name ? `Ảnh đại diện của ${name}` : "Ảnh đại diện"}
        />
      ) : null}
      <AvatarFallback
        className={cn("font-bold", sizeClasses.fallback, fallbackStyle)}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
