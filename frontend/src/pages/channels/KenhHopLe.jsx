import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { timSan } from "@/constants/channel";
import { KhongTimThayTrongKhung } from "@/pages/page-error/NotFound404";

/**
 * Bọc các route /channels/:maKenh/*: mã sàn lạ thì hiện "Không tìm thấy trang" ngay trong khung quản trị (kiểu C);
 * mã viết khác chữ thường (/channels/LAZADA) thì chuyển về đường dẫn chuẩn để tiêu đề trang và menu nhận ra;
 * đổi sàn (Lazada → TikTok Shop) thì dựng lại trang từ đầu để không mang trạng thái của sàn trước.
 * Sàn chờ cấp API (`hoTro: false`) chỉ có màn giới thiệu: trang con nào (thiết lập, sản phẩm, trang quay về sau ủy quyền…)
 * cũng chuyển về đó, vì các trang này gọi API mà máy chủ chưa có.
 */
export default function KenhHopLe() {
  const { maKenh } = useParams();
  const { pathname, search } = useLocation();
  const san = timSan(maKenh);
  if (!san) return <KhongTimThayTrongKhung />;
  const maChuan = san.duongDan.split("/").pop();
  if (maKenh !== maChuan) {
    const doan = pathname.split("/");
    const viTri = doan.indexOf(maKenh);
    // Không tìm thấy đoạn mã trên đường dẫn (không xảy ra với route hiện có) thì giữ nguyên, tránh chuyển vòng
    if (viTri > 0) {
      doan[viTri] = maChuan;
      return <Navigate to={`${doan.join("/")}${search}`} replace />;
    }
  }
  if (!san.hoTro && pathname !== san.duongDan) return <Navigate to={san.duongDan} replace />;
  return <Outlet key={san.maKenh} />;
}
