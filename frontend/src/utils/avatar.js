import { useEffect, useState } from "react";

// Avatar helpers: initials fallback, màu nền ổn định theo userId, cache hồ sơ
// người dùng đang đăng nhập (ảnh đại diện + họ tên) và CustomEvent để mọi
// avatar đang mount đồng bộ ngay khi ảnh thay đổi — không có global store.

export const AVATAR_EVENT = "fcentrics:avatar-updated";

// djb2 — deterministic, no Math.random
export function hashUserId(userId) {
  const str = String(userId ?? "");
  let hash = 5381;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// 1 word → first 2 chars; ≥2 words → first + last initial; empty → "U"
export function getInitials(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return `${first}${last}`.toUpperCase() || "U";
}

// ===== Cache hồ sơ người dùng ĐANG ĐĂNG NHẬP (không phải lựa chọn ảnh cũ) =====
// Nguồn hiển thị cho header trước khi có DTO đầy đủ; dữ liệu thật luôn nằm ở
// DB (login response + GET /me), nên sống sót refresh, đăng nhập lại và cả
// trình duyệt khác. Kèm userId trong cache để không bao giờ hiển thị ảnh của
// tài khoản này cho tài khoản khác.

const CURRENT_USER_KEY = "fcentrics_current_user_profile";

function readStoredProfile() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Trả hồ sơ cached chỉ khi khớp đúng userId (chống hiện nhầm ảnh khi đổi tài khoản)
export function getCurrentUserProfile(userId) {
  if (userId == null) return null;
  const profile = readStoredProfile();
  if (profile && String(profile.id) === String(userId)) return profile;
  return null;
}

// Ghi cache + broadcast để mọi UserAvatar đang mount cập nhật ngay lập tức
export function setCurrentUserProfile(dto) {
  if (!dto || dto.id == null) return;
  try {
    localStorage.setItem(
      CURRENT_USER_KEY,
      JSON.stringify({ id: dto.id, avatarUrl: dto.avatarUrl || null, hoTen: dto.hoTen || null })
    );
  } catch {
    /* localStorage unavailable (private mode) */
  }
  window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: { userId: dto.id } }));
}

export function clearCurrentUserProfile() {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    /* localStorage unavailable (private mode) */
  }
}

// Ảnh đại diện của người đang đăng nhập, tự re-render khi AVATAR_EVENT bắn ra
export function useCurrentUserAvatarUrl(userId) {
  const [avatarUrl, setAvatarUrl] = useState(
    () => getCurrentUserProfile(userId)?.avatarUrl ?? null
  );

  useEffect(() => {
    const handleAvatarEvent = (event) => {
      const eventUserId = event?.detail?.userId;
      if (userId != null && eventUserId != null && String(eventUserId) === String(userId)) {
        setAvatarUrl(getCurrentUserProfile(userId)?.avatarUrl ?? null);
      }
    };
    window.addEventListener(AVATAR_EVENT, handleAvatarEvent);
    return () => window.removeEventListener(AVATAR_EVENT, handleAvatarEvent);
  }, [userId]);

  return avatarUrl;
}
