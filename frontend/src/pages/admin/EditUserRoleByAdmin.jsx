import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Đường dẫn cũ /users/:id/edit-role. Phân quyền nay làm trong ngăn kéo ngay trên trang Chi tiết người dùng
 * (PB2, chốt 18/10/2026), nên chuyển sang /users/:id?phan-quyen=1 và giữ nguyên `state` (nút quay lại danh sách).
 */
export default function EditUserRoleByAdmin() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/users/${id}?phan-quyen=1`} replace state={location.state} />;
}
