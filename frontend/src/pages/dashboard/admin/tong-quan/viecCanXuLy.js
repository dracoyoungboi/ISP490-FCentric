// Danh sách "Cần xử lý" của màn Tổng quan: thuần dữ liệu (không React) để kiểm thử bằng node --test.
import { SAN_BAN_HANG } from "../../../../constants/channel.js";
import { t } from "../../../../i18n/t.js";

const UU_TIEN = { bad: 0, warn: 1, info: 2 };

/**
 * Đơn chờ xuất, Phiếu nhặt hàng và Chuyển kho nội bộ chỉ xem kho làm việc (selected_kho_id).
 * Dòng của các trang này mang theo kho: bấm vào thì đổi kho làm việc sang kho đó rồi mở trang,
 * để số trên dòng bằng số dòng trên trang. Xem "Tất cả kho" thì tách một dòng cho mỗi kho có việc
 * (backend trả viecCanXuLy.theoKho).
 */
const VIEC_THEO_KHO_LAM_VIEC = new Set(["donChoXuatKho", "phieuNhatChuaPhanCong", "phieuChuyenChoDuyet", "phieuChuyenChoXuatHang"]);

function tachTheoKho(dong, v, khoId) {
  if (!VIEC_THEO_KHO_LAM_VIEC.has(dong.loai)) return [dong];
  if (khoId != null) return [{ ...dong, kho: khoId }];
  if (!Array.isArray(v.theoKho)) return [dong];
  return v.theoKho
    .filter((k) => (k[dong.loai] ?? 0) > 0)
    .map((k) => ({ ...dong, key: `${dong.loai}-${k.khoId}`, so: k[dong.loai], phu: k.tenKho, kho: k.khoId }));
}

/**
 * Phiếu xuất bán hàng chưa xuất kho, hai trạng thái — mỗi dòng mở đúng tab của danh sách phiếu xuất (mã tab ở
 * constants/phieuXuatKho.js PHIEU_XUAT_KHO_TABS: Nháp mã 0 → "nhap", Chờ xuất mã 6 → "cho-xuat-kho"; không import vì tệp
 * đó dùng bí danh "@/", node --test không nạp được). Máy chủ chỉ đếm phiếu loai_xuat = ban_hang (tab Nháp còn có phiếu
 * chuyển kho) nên mọi dòng kèm ?loai=ban-hang (bộ lọc loại phiếu của PhieuXuatKhoList) cho số dòng khớp số đếm.
 * Máy chủ cũ chỉ trả tổng phieuXuatChoXuatKho: một dòng, mở tab Tất cả.
 */
function viecPhieuXuat(v) {
  if (v.phieuXuatChoDongGoi == null && v.phieuXuatChoXuat == null) {
    return [{ loai: "phieuXuatChoXuatKho", ten: t("Phiếu xuất chưa xuất kho"), phu: t("Đơn bán chờ đóng gói hoặc chờ xuất"), so: v.phieuXuatChoXuatKho, muc: "warn", to: "/goods-issues?loai=ban-hang" }];
  }
  return [
    { loai: "phieuXuatChoDongGoi", ten: t("Phiếu xuất chờ đóng gói"), phu: t("Đơn bán đã nhặt, chưa đóng gói"), so: v.phieuXuatChoDongGoi, muc: "warn", to: "/goods-issues?trangThai=nhap&loai=ban-hang" },
    { loai: "phieuXuatChoXuat", ten: t("Phiếu xuất chờ xuất kho"), phu: t("Đã đóng gói, chờ xác nhận xuất"), so: v.phieuXuatChoXuat, muc: "warn", to: "/goods-issues?trangThai=cho-xuat-kho&loai=ban-hang" },
  ];
}

/** Trang sản phẩm của kênh, mở sẵn tab Lỗi; kênh chưa có trang riêng (kể cả sàn chờ cấp API) thì mở danh sách kênh. */
export function duongDanLoiDongBo(maKenh) {
  const san = SAN_BAN_HANG.find((s) => s.hoTro && s.maKenh === maKenh);
  return san?.duongDan ? `${san.duongDan}/products?trangThai=loi` : "/channels";
}

/**
 * Việc đang chờ: chỉ giữ dòng có số > 0, xếp gấp trước (bad → warn → info). Một dòng = một trạng thái chứng từ,
 * mở đúng danh sách và đúng tab (?trangThai=). Hết hàng / sắp hết hàng không nằm ở đây (đã có ở thẻ Tồn kho, tránh
 * trùng số). Lỗi đồng bộ kênh và tài khoản bị khóa là việc chung của hệ thống, chỉ hiện khi xem Tất cả kho.
 * Máy chủ cũ chưa trả loiDongBo / donMuaQuaHan thì hai dòng đó không hiện.
 */
export function danhSachViec(v, khoId) {
  const tatCaKho = khoId == null;
  const loiKenh = tatCaKho && Array.isArray(v.loiDongBo) ? v.loiDongBo : [];
  const ds = [
    ...loiKenh.map((k) => ({
      key: `loiDongBo-${k.kenhId}`,
      loai: "loiDongBo",
      ten: t("Lỗi đồng bộ {{tenKenh}}", { tenKenh: k.tenKenh }),
      phu: t("Sản phẩm chưa đẩy được tồn lên kênh"),
      so: k.soLoi,
      muc: "bad",
      to: duongDanLoiDongBo(k.maKenh),
    })),
    { loai: "donMuaQuaHan", ten: t("Đơn mua quá hạn giao"), phu: t("Quá ngày giao dự kiến"), so: v.donMuaQuaHan, muc: "bad", to: `/purchase-orders?trangThai=dang-van-chuyen${tatCaKho ? "" : `&kho=${khoId}`}` },
    { loai: "donChoXuatKho", ten: t("Đơn chờ nhặt hàng"), phu: t("Chưa tạo phiếu nhặt"), so: v.donChoXuatKho, muc: "warn", to: "/goods-issues/pending-orders" },
    // Phiếu bán hàng Nháp (chờ đóng gói) và Chờ xuất tách hai dòng, mỗi dòng mở đúng tab (danh sách chỉ lọc một trạng thái)
    ...viecPhieuXuat(v),
    { loai: "phieuChuyenChoDuyet", ten: t("Phiếu chuyển kho chờ duyệt"), phu: t("Quản lý Kho tổng duyệt, lập lệnh điều động"), so: v.phieuChuyenChoDuyet, muc: "warn", to: "/transfer-tickets?trangThai=cho-duyet" },
    // Quản trị viên luôn xử lý được chênh lệch và xem phiếu chuyển của mọi kho: không tách theo kho. Máy chủ cũ chưa trả thì không hiện
    { loai: "phieuChuyenChoXuLyLech", ten: t("Phiếu chuyển chờ xử lý chênh lệch"), phu: t("Nhận lệch: kho gửi xác nhận biên bản, rồi chọn ghi giảm hoặc giao bù"), so: v.phieuChuyenChoXuLyLech, muc: "warn", to: "/transfer-tickets?trangThai=cho-xu-ly-chenh-lech" },
    { loai: "phieuNhatChuaPhanCong", ten: t("Phiếu nhặt chưa phân công"), phu: t("Chưa giao người nhặt"), so: v.phieuNhatChuaPhanCong, muc: "warn", to: "/goods-issues/pick-lists" },
    // Mở đúng tab Chờ duyệt (và đúng kho đang xem) để số trên dòng bằng số dòng trên trang
    { loai: "yeuCauNhapChoDuyet", ten: t("Yêu cầu nhập hàng chờ duyệt"), phu: t("Mua hàng"), so: v.yeuCauNhapChoDuyet, muc: "warn", to: `/purchase-requests?trangThai=cho-duyet${tatCaKho ? "" : `&kho=${khoId}`}` },
    { loai: "donNhapChuaGuiKho", ten: t("Đơn nháp chưa gửi kho"), phu: t("Bán hàng"), so: v.donNhapChuaGuiKho, muc: "info", to: "/sales-orders?trangThai=nhap" },
    { loai: "phieuNhapChoNhapKho", ten: t("Phiếu nhập chờ nhập kho"), phu: t("Hàng đã về, chờ kiểm đếm"), so: v.phieuNhapChoNhapKho, muc: "info", to: "/goods-receipts?trangThai=cho-nhap-kho" },
    { loai: "phieuChuyenChoXuatHang", ten: t("Phiếu chuyển chờ xuất hàng"), phu: t("Đã duyệt, chờ xuất"), so: v.phieuChuyenChoXuatHang, muc: "info", to: "/transfer-tickets?trangThai=cho-xuat-hang" },
    { loai: "dotKiemKeDangMo", ten: t("Đợt kiểm kê đang mở"), phu: t("Kiểm kê"), so: v.dotKiemKeDangMo, muc: "info", to: "/stock-take?trangThai=dang-kiem-ke" },
    ...(tatCaKho ? [{ loai: "taiKhoanBiKhoa", ten: t("Tài khoản bị khóa"), phu: t("Người dùng"), so: v.taiKhoanBiKhoa, muc: "info", to: "/users?trangThai=0" }] : []),
  ];
  return ds
    .map((d) => ({ key: d.loai, ...d }))
    .filter((d) => (d.so ?? 0) > 0)
    // nhom = số của cả việc, thuTu = vị trí trong danh sách: xếp như cũ; các dòng tách theo kho
    // của cùng một việc đứng liền nhau, kho nhiều việc hơn đứng trước
    .flatMap((d, thuTu) => tachTheoKho({ ...d, nhom: d.so, thuTu }, v, khoId))
    .sort((a, b) => UU_TIEN[a.muc] - UU_TIEN[b.muc] || b.nhom - a.nhom || a.thuTu - b.thuTu || b.so - a.so);
}
