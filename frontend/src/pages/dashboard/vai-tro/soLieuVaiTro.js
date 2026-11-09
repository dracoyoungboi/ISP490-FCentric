// Số liệu và đường dẫn của màn Tổng quan theo vai trò (quản lý kho, nhân viên kho, mua hàng, bán hàng):
// thuần dữ liệu (không React) để kiểm thử bằng node --test. Dữ liệu vào là GET /api/v1/tong-quan/cua-toi.
//
// Quy tắc đường dẫn: một số mở đúng một danh sách và đúng tab (?trangThai=) của hệ thống, để số trên Tổng quan
// bằng số dòng trên trang. Trang chỉ xem một kho (Đơn chờ xuất, Phiếu nhặt hàng, Chuyển kho nội bộ…) tự lọc theo
// kho làm việc; trang có tham số kho (Yêu cầu nhập hàng, Đơn mua hàng, Báo cáo tồn kho) được truyền ?kho=.
import { bienDong, docNgay, formatSo, formatTienNgan, gioPhut, tachTien } from "../admin/tong-quan/tongQuanFormat.js";
import { duongDanKemThamSo } from "../../../utils/thamSoDuongDan.js";
import { t } from "../../../i18n/t.js";

const hai = (n) => String(n).padStart(2, "0");
const THU_NGAN = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((thu) => t(thu, { context: "thu" }));
const TEN_THU = [t("Chủ nhật"), t("Thứ Hai"), t("Thứ Ba"), t("Thứ Tư"), t("Thứ Năm"), t("Thứ Sáu"), t("Thứ Bảy")];
const MOT_NGAY = 864e5;

/** Tên khối (khoiLoi của API) để báo "Chưa tải được: …". */
export const TEN_KHOI = {
  chiSo: t("Số liệu chính"),
  tonKho: t("Tồn kho"),
  nghiepVu: t("Công việc trong kho"),
  viec: t("Cần bạn xử lý"),
  nhapXuat: t("Nhập và xuất kho"),
  boSung: t("Cần bổ sung"),
  cuaBan: t("Việc của bạn"),
  homNay: t("Hôm nay của bạn"),
  viecChung: t("Việc chung của kho"),
  sapVe: t("Hàng sắp về"),
  quyTrinh: t("Quy trình mua hàng"),
  lich: t("Lịch hàng về"),
  nhaCungCap: t("Nhà cung cấp"),
  canMua: t("Cần mua thêm"),
  theoGio: t("Doanh thu trong ngày"),
  don: t("Đơn của bạn"),
  baoGia: t("Báo giá"),
  banChay: t("Bán chạy"),
};

/* ============================== Ngày giờ ============================== */

/** Số ngày từ ngày a đến ngày b (theo lịch, bỏ giờ). */
export function soNgayGiua(a, b) {
  const x = docNgay(a);
  const y = docNgay(b);
  if (!x || !y) return 0;
  const dx = Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const dy = Date.UTC(y.getFullYear(), y.getMonth(), y.getDate());
  return Math.round((dy - dx) / MOT_NGAY);
}

/** "11/10" */
export function ngayThangNgan(chuoi) {
  const d = docNgay(chuoi);
  return d ? `${hai(d.getDate())}/${hai(d.getMonth() + 1)}` : "";
}

/** Nhãn một ngày trên dải 7 ngày: "Hôm nay" hoặc "T7 11/10". */
export function nhanNgay(ngay, homNay) {
  if (soNgayGiua(ngay, homNay) === 0) return t("Hôm nay");
  const d = docNgay(ngay);
  return d ? `${THU_NGAN[d.getDay()]} ${ngayThangNgan(ngay)}` : "";
}

/** "Hôm nay", "Ngày mai", "Thứ Hai 19/10". */
export function tenNgay(ngay, homNay) {
  const n = soNgayGiua(homNay, ngay);
  if (n === 0) return t("Hôm nay");
  if (n === 1) return t("Ngày mai");
  const d = docNgay(ngay);
  return d ? `${TEN_THU[d.getDay()]} ${ngayThangNgan(ngay)}` : "";
}

/** Mốc ngắn: cùng ngày "9:10", hôm qua "hôm qua 16:40", xa hơn "12/10". */
export function thoiDiemNgan(chuoi, bayGio) {
  if (!chuoi) return "";
  const n = soNgayGiua(chuoi, bayGio);
  if (n <= 0) return gioPhutNgan(chuoi);
  if (n === 1) return t("hôm qua {{chuoi}}", { chuoi: gioPhutNgan(chuoi) });
  return ngayThangNgan(chuoi);
}

/** "9:10" (không thêm số 0 trước giờ). */
export function gioPhutNgan(chuoi) {
  const d = docNgay(chuoi);
  return d ? `${d.getHours()}:${hai(d.getMinutes())}` : "";
}

/** Khoảng chờ từ một mốc đến bây giờ: "45 phút", "2 giờ 15 phút", "3 ngày". */
export function khoangCho(tu, bayGio) {
  const a = docNgay(tu);
  const b = docNgay(bayGio);
  if (!a || !b) return "";
  const phut = Math.max(0, Math.floor((b - a) / 60000));
  if (phut < 60) return t("{{phut}} phút", { phut });
  if (phut < 24 * 60) {
    const gio = Math.floor(phut / 60);
    const du = phut % 60;
    return du ? t("{{gio}} giờ {{du}} phút", { gio, du }) : t("{{gio}} giờ", { gio });
  }
  return t("{{count}} ngày", { count: Math.floor(phut / (24 * 60)) });
}

/* ============================== Số ============================== */

/**
 * Mức thay đổi cho ô số: { chu: "18%", len, tot } (tăng là tốt), "0%" trung tính, null khi kỳ so sánh bằng 0.
 * Chữ không dấu vì đã có mũi tên lên / xuống.
 */
export function bienDongO(hienTai, truoc) {
  const bd = bienDong(hienTai, truoc);
  if (!bd) return null;
  if (bd.tang == null) return { chu: "0%", len: null, tot: null };
  return { chu: bd.chu.replace(/^[+−]/, ""), len: bd.tang, tot: bd.tang };
}

/**
 * Vạch trục Y tròn số: 0 và 4 vạch đều nhau (bước 1 / 2 / 2,5 / 5 × 10ⁿ, nhỏ nhất là 1 vì số lượng và tiền đều là
 * số nguyên — tránh nhãn trùng nhau khi chưa có số liệu).
 */
export function vachTron(max) {
  const tho = Math.max(max, 4) / 4;
  const bac = 10 ** Math.floor(Math.log10(tho));
  const buoc = bac * [1, 2, 2.5, 5, 10].find((b) => b * bac >= tho);
  return [0, buoc, buoc * 2, buoc * 3, buoc * 4];
}

/** Phần trăm làm tròn; null khi mẫu bằng 0. */
export const phanTram = (tu, mau) => (mau > 0 ? Math.round((tu / mau) * 100) : null);

/** Chênh lệch tính bằng điểm phần trăm: { chu: "5 điểm", len, tot }; null khi một trong hai kỳ không có số. */
export function bienDongDiem(pt, ptTruoc) {
  if (pt == null || ptTruoc == null) return null;
  const d = pt - ptTruoc;
  if (d === 0) return { chu: t("0 điểm"), len: null, tot: null };
  return { chu: t("{{d}} điểm", { d: Math.abs(d) }), len: d > 0, tot: d > 0 };
}

/** "Trắng / M" từ màu và cỡ (bỏ phần trống). */
export const tenBienThe = (mau, co) => [mau, co].filter(Boolean).join(" / ");

/** Ô số hiển thị tiền: { so: "18,6", donVi: "triệu ₫" }. */
export const soTien = (v) => tachTien(v);

/* ============================== Quản lý kho ============================== */

/** Bốn ô số đầu trang. Kho bán hàng: doanh thu thay cho nhập kho (kho bán hàng nhận hàng bằng chuyển kho). */
export function theSoQuanLyKho(d, kho, cauHinh, thoiDiem) {
  const cs = d.chiSo;
  const ton = d.tonKho;
  const homNay = thoiDiem;
  const the = [];
  if (cs) {
    if (!kho.laKhoTong && cs.doanhThu) {
      const tt = soTien(cs.doanhThu.homNay);
      the.push({
        key: "doanhThu",
        ten: t("Doanh thu hôm nay"),
        so: tt.so,
        donVi: tt.donVi,
        bd: bdSoVoi(cs.doanhThu.homNay, cs.doanhThu.cungGioTruoc, t("so với cùng giờ tuần trước")),
        phu: t("{{soChungTu}} đơn đã giao", { soChungTu: formatSo(cs.doanhThu.soChungTu) }),
        xuHuong: duongXuHuong(cs.doanhThu.bayNgay, homNay, formatTienNgan),
        to: "/reports/revenue",
      });
    } else {
      the.push({
        key: "nhap",
        ten: t("Nhập kho hôm nay"),
        so: formatSo(cs.nhap.homNay),
        donVi: t("sản phẩm"),
        bd: bdSoVoi(cs.nhap.homNay, cs.nhap.cungGioTruoc, t("so với cùng giờ hôm qua")),
        phu: t("{{soChungTu}} phiếu đã nhập kho", { soChungTu: formatSo(cs.nhap.soChungTu) }),
        xuHuong: duongXuHuong(cs.nhap.bayNgay, homNay, (v) => t("{{soLuong}} sản phẩm", { soLuong: formatSo(v), count: v })),
        to: "/goods-receipts?trangThai=da-nhap-kho",
      });
    }
    the.push({
      key: "xuat",
      ten: t("Xuất kho hôm nay"),
      so: formatSo(cs.xuat.homNay),
      donVi: t("sản phẩm"),
      bd: bdSoVoi(cs.xuat.homNay, cs.xuat.cungGioTruoc, t("so với cùng giờ hôm qua")),
      phu: t("{{soChungTu}} phiếu đã xuất", { soChungTu: formatSo(cs.xuat.soChungTu) }),
      xuHuong: duongXuHuong(cs.xuat.bayNgay, homNay, (v) => t("{{soLuong}} sản phẩm", { soLuong: formatSo(v), count: v })),
      to: "/goods-issues?trangThai=da-xuat",
    });
    const dcx = cs.donChoXuat;
    the.push({
      key: "donChoXuat",
      ten: t("Đơn chưa xuất xong"),
      so: formatSo(dcx.tong),
      donVi: t("đơn"),
      phu: dcx.tong ? null : t("Không có đơn nào đang chờ"),
      chia: dcx.tong
        ? [
            { nhan: t("chờ quá {{gioChoLau}} giờ", { gioChoLau: cauHinh.gioChoLau }), so: dcx.choLau, vanDe: true },
            { nhan: t("trong hạn"), so: dcx.tong - dcx.choLau },
          ]
        : null,
      to: "/sales-orders",
    });
  }
  if (ton) {
    the.push({
      key: "tonKho",
      ten: t("Tồn khả dụng"),
      so: formatSo(ton.khaDung),
      donVi: t("sản phẩm"),
      phu: t("Giá trị {{tien}}", { tien: formatTienNgan(ton.giaTri) }),
      to: `/reports/inventory?kho=${kho.id}`,
    });
  }
  return the;
}

function bdSoVoi(hienTai, truoc, soVoi) {
  const bd = bienDongO(hienTai, truoc);
  return bd ? { ...bd, soVoi } : null;
}

/** Nét 7 ngày: giá trị, nhãn ngày, cách đọc số trong ô nổi. */
function duongXuHuong(bayNgay, homNay, dinhDang) {
  if (!Array.isArray(bayNgay) || bayNgay.length < 2) return null;
  return {
    gt: bayNgay.map((p) => p.giaTri),
    nhan: bayNgay.map((p) => nhanNgay(p.ngay, homNay)),
    dinhDang,
  };
}

/**
 * Sáu ô "Công việc trong kho": số chính mở đúng danh sách; dòng phụ chỉ có khi có số (chữ đỏ = trễ, cam = cần chú ý).
 * "+" tạo chứng từ cho nghiệp vụ quản lý kho được tạo.
 */
export function oNghiepVu(nv, kho, cauHinh) {
  const chip = (dk, c) => (dk ? [c] : []);
  return [
    {
      key: "nhanHang",
      ten: t("Nhận hàng"),
      icon: "nhan",
      so: nv.nhanHang.phieuChoNhap,
      nhanSo: t("phiếu chờ nhập kho"),
      to: "/goods-receipts?trangThai=cho-nhap-kho",
      chip: [
        ...chip(nv.nhanHang.dangVe > 0, { nhan: t("Đơn mua đang về"), so: nv.nhanHang.dangVe, to: `/purchase-orders?trangThai=dang-van-chuyen&kho=${kho.id}` }),
        ...chip(nv.nhanHang.treHan > 0, { nhan: t("Trễ hẹn"), so: nv.nhanHang.treHan, kieu: "tre", to: `/purchase-orders?trangThai=dang-van-chuyen&kho=${kho.id}` }),
        ...chip(nv.nhanHang.dangChuyenDen > 0, { nhan: t("Đang chuyển đến"), so: nv.nhanHang.dangChuyenDen, to: "/transfer-tickets?trangThai=dang-van-chuyen" }),
      ],
      tao: { to: "/goods-receipts/create", nhan: t("Tạo phiếu nhập kho") },
    },
    {
      key: "nhatHang",
      ten: t("Nhặt hàng"),
      icon: "nhat",
      so: nv.nhatHang.choGomPhieu,
      nhanSo: t("đơn chờ tạo phiếu nhặt"),
      to: "/goods-issues/pending-orders",
      chip: [
        ...chip(nv.nhatHang.dangNhat > 0, { nhan: t("Đang nhặt"), so: nv.nhatHang.dangNhat, to: "/goods-issues/pick-lists?trangThai=dang-nhat" }),
        ...chip(nv.nhatHang.chuaPhanCong > 0, { nhan: t("Chưa phân công"), so: nv.nhatHang.chuaPhanCong, kieu: "chuY", to: "/goods-issues/pick-lists?trangThai=cho-nhat" }),
      ],
    },
    {
      key: "dongGoi",
      ten: t("Đóng gói"),
      icon: "dongGoi",
      so: nv.dongGoi.choDongGoi,
      nhanSo: t("đơn chờ đóng gói"),
      to: "/sales-orders?trangThai=cho-dong-goi",
      chip: chip(nv.dongGoi.choLau > 0, {
        nhan: t("Chờ quá {{gioChoLau}} giờ", { gioChoLau: cauHinh.gioChoLau }),
        so: nv.dongGoi.choLau,
        kieu: "chuY",
        to: "/sales-orders?trangThai=cho-dong-goi",
      }),
    },
    {
      key: "xuatKho",
      ten: t("Xuất kho"),
      icon: "xuat",
      so: nv.xuatKho.phieuChoXuat,
      nhanSo: t("phiếu bán chờ xuất"),
      to: "/goods-issues?trangThai=cho-xuat-kho",
      chip: chip(nv.xuatKho.chuyenChoXuat > 0, {
        nhan: t("Phiếu chuyển chờ xuất"),
        so: nv.xuatKho.chuyenChoXuat,
        to: "/transfer-tickets?trangThai=cho-xuat-hang",
      }),
    },
    {
      key: "chuyenKho",
      ten: t("Chuyển kho"),
      icon: "chuyen",
      so: nv.chuyenKho.choDuyet + nv.chuyenKho.choXuatHang + nv.chuyenKho.dangVanChuyen,
      nhanSo: t("phiếu đang mở"),
      to: "/transfer-tickets",
      chip: [
        ...chip(nv.chuyenKho.choDuyet > 0, { nhan: t("Chờ duyệt"), so: nv.chuyenKho.choDuyet, to: "/transfer-tickets?trangThai=cho-duyet" }),
        ...chip(nv.chuyenKho.choXuatHang > 0, { nhan: t("Đã duyệt, chờ xuất"), so: nv.chuyenKho.choXuatHang, to: "/transfer-tickets?trangThai=cho-xuat-hang" }),
        ...chip(nv.chuyenKho.dangVanChuyen > 0, { nhan: t("Đang vận chuyển"), so: nv.chuyenKho.dangVanChuyen, to: "/transfer-tickets?trangThai=dang-van-chuyen" }),
      ],
      tao: { to: "/transfer-tickets/create", nhan: t("Tạo phiếu chuyển kho") },
    },
    {
      key: "kiemKe",
      ten: t("Kiểm kê"),
      icon: "kiemKe",
      so: nv.kiemKeDangMo,
      nhanSo: t("đợt đang kiểm kê"),
      to: "/stock-take?trangThai=dang-kiem-ke",
      chip: [],
      tao: { to: "/stock-take/new", nhan: t("Tạo đợt kiểm kê") },
    },
  ];
}

const VIEC_QLK = {
  duyet_yeu_cau_nhap: { ten: t("Duyệt yêu cầu nhập hàng"), phu: t("Yêu cầu nhập về kho này"), icon: "duyet", tuoi: t("Chờ từ") },
  duyet_phieu_chuyen: { ten: t("Duyệt phiếu chuyển kho"), phu: t("Phiếu chuyển chờ Kho tổng duyệt"), icon: "chuyen", tuoi: t("Chờ từ") },
  // Kho gửi (kho xuất của phiếu) xác nhận biên bản giao nhận kho nhận lập; cũ nhất theo lúc nhận lệch
  xac_nhan_bien_ban_chuyen: { ten: t("Xác nhận biên bản giao nhận"), phu: t("Kho nhận báo thiếu, hỏng hàng kho bạn gửi"), icon: "chuyen", tuoi: t("Chờ từ") },
  // Máy chủ chỉ trả cho người được xử lý chênh lệch theo Cấu hình › Chuyển kho, sau khi kho gửi đã xác nhận biên bản
  xu_ly_chenh_lech_chuyen: { ten: t("Xử lý chênh lệch chuyển kho"), phu: t("Kho gửi đã xác nhận biên bản, chờ xử lý"), icon: "chuyen", tuoi: t("Chờ từ") },
  gom_phieu_nhat: { ten: t("Tạo phiếu nhặt cho đơn chờ xuất"), phu: t("Đơn chưa có phiếu nhặt"), icon: "nhat", tuoi: t("Cũ nhất") },
  phan_cong_nhat: { ten: t("Phân công phiếu nhặt"), phu: t("Phiếu nhặt chưa giao người nhặt"), icon: "nhat", tuoi: t("Cũ nhất") },
  hoan_tat_kiem_ke: { ten: t("Hoàn tất đợt kiểm kê"), phu: t("Đợt kiểm kê đang mở"), icon: "kiemKe", tuoi: t("Mở từ") },
};

/** Dòng "Cần bạn xử lý" của quản lý kho (API đã lọc dòng có số và xếp gấp trước). */
export function dongViecQuanLyKho(viec, kho, thoiDiem) {
  return (viec ?? [])
    .filter((v) => VIEC_QLK[v.loai] && v.so > 0)
    .map((v) => {
      const m = VIEC_QLK[v.loai];
      return {
        key: v.loai,
        loai: m.icon,
        ten: m.ten,
        phu: v.loai === "hoan_tat_kiem_ke" && v.moTa ? v.moTa : m.phu,
        tuoi: v.cuNhat ? `${m.tuoi} ${thoiDiemNgan(v.cuNhat, thoiDiem)}` : null,
        so: v.so,
        gap: Boolean(v.gap),
        to: duongDanViecQuanLyKho(v.loai, kho),
      };
    });
}

function duongDanViecQuanLyKho(loai, kho) {
  switch (loai) {
    case "duyet_yeu_cau_nhap":
      return `/purchase-requests?trangThai=cho-duyet&kho=${kho.id}`;
    case "duyet_phieu_chuyen":
      return "/transfer-tickets?trangThai=cho-duyet";
    case "xac_nhan_bien_ban_chuyen":
    case "xu_ly_chenh_lech_chuyen":
      return "/transfer-tickets?trangThai=cho-xu-ly-chenh-lech";
    case "gom_phieu_nhat":
      return "/goods-issues/pending-orders";
    case "phan_cong_nhat":
      return "/goods-issues/pick-lists?trangThai=cho-nhat";
    default:
      return "/stock-take?trangThai=dang-kiem-ke";
  }
}

/**
 * Hành động của một dòng "Cần bổ sung":
 * - chuyển từ Kho tổng (số Kho tổng có thể chuyển đã kiểm như khi tạo phiếu) → mở sẵn form chuyển kho;
 * - đã có yêu cầu nhập hàng đang mở có mã này → mở yêu cầu đó;
 * - còn lại: chỉ ghi chữ (quản lý kho không tạo yêu cầu nhập hàng; việc mua do nhân viên mua hàng).
 */
export function hanhDongBoSung(d, kho) {
  if (d.deXuat === "chuyen_kho" && kho.khoTongId != null) {
    return {
      kieu: "nut",
      chu: t("Chuyển về {{soLuongDeXuat}}", { soLuongDeXuat: formatSo(d.soLuongDeXuat) }),
      to: duongDanKemThamSo("/transfer-tickets/create", {
        khoXuatId: kho.khoTongId,
        khoNhapId: kho.id,
        bienTheId: d.bienTheId,
        soLuong: d.soLuongDeXuat,
      }),
    };
  }
  if (d.yeuCauMoId != null) {
    return { kieu: "lienKet", chu: d.yeuCauMoMa ? t("Đã có {{yeuCauMoMa}}", { yeuCauMoMa: d.yeuCauMoMa }) : t("Đã có yêu cầu nhập"), to: `/purchase-requests/${d.yeuCauMoId}` };
  }
  return { kieu: "chu", chu: kho.laKhoTong ? t("Cần mua thêm {{soLuongDeXuat}}", { soLuongDeXuat: formatSo(d.soLuongDeXuat) }) : t("Kho tổng không đủ hàng") };
}

/** Dòng phụ của một mã cần bổ sung. */
export function moTaBoSung(d, kho) {
  const con = d.khaDung > 0 ? t("Còn {{khaDung}}", { khaDung: formatSo(d.khaDung) }) : t("Hết hàng");
  if (kho.laKhoTong || d.khaDungKhoTong == null) return t("{{con}} · ngưỡng {{nguong}}", { con, nguong: formatSo(d.nguong) });
  return t("{{con}} · Kho tổng còn {{khaDungKhoTong}}", { con, khaDungKhoTong: formatSo(d.khaDungKhoTong) });
}

/* ============================== Nhân viên kho ============================== */

/** Đường dẫn và chữ nút của một việc chung trong kho. */
export function viecChungDong(v) {
  const sl = v.soLuong > 0 ? t(" · {{soLuong}} sản phẩm", { soLuong: formatSo(v.soLuong), count: v.soLuong }) : "";
  switch (v.loai) {
    // Phiếu chuyển đang trên đường đến kho (id là id phiếu chuyển, mốc là giờ xuất): nhận hàng ở màn phiếu chuyển
    case "phieu_nhap_chuyen_kho":
      return { moTa: t("Từ {{noiGui}}{{sl}}", { noiGui: v.doiTac ?? t("kho khác"), sl }), nut: t("Nhận hàng"), to: `/transfer-tickets/${v.id}/receive`, moc: t("Xuất lúc") };
    case "phieu_nhap":
      return { moTa: `${v.doiTac ?? t("Nhập kho")}${sl}`, nut: t("Kiểm đếm"), to: `/goods-receipts/${v.id}`, moc: t("Tạo lúc") };
    // Phiếu nhặt của phiếu chuyển kho không có đơn: máy chủ gửi số phiếu chuyển ở doiTac (không ghi "0 đơn")
    case "phieu_nhat":
      return {
        moTa: `${v.doiTac ? t("Chuyển kho {{doiTac}}", { doiTac: v.doiTac }) : t("{{soDon}} đơn", { soDon: formatSo(v.soDon), count: v.soDon })}${sl}`,
        nut: t("Mở phiếu"),
        to: `/goods-issues/pick-lists/${v.id}`,
        moc: t("Tạo lúc"),
      };
    case "don_ban":
      return { moTa: `${v.doiTac ?? t("Khách lẻ")}${sl}`, nut: t("Đóng gói"), to: `/goods-issues/packing/${v.id}`, moc: t("Nhặt xong") };
    case "phieu_xuat":
      // Phiếu xuất bán được tạo khi nhặt xong (ngay_tao), sang Chờ xuất khi đóng gói xong (không lưu giờ đóng gói)
      return { moTa: t("Xuất bán{{khach}}{{sl}}", { khach: v.doiTac ? ` · ${v.doiTac}` : "", sl }), nut: t("Xuất kho"), to: `/goods-issues/${v.id}`, moc: t("Nhặt xong") };
    case "phieu_chuyen":
      return { moTa: t("Chuyển đến {{noiNhan}}{{sl}}", { noiNhan: v.doiTac ?? t("kho khác"), sl }), nut: t("Xuất hàng"), to: `/transfer-tickets/${v.id}`, moc: t("Tạo lúc") };
    case "kiem_ke":
      return { moTa: t("{{dot}} · {{soLuong}} dòng kiểm kê", { dot: v.doiTac ?? t("Đợt kiểm kê"), soLuong: formatSo(v.soLuong), count: v.soLuong }), nut: t("Đếm"), to: `/stock-take/${v.id}`, moc: t("Mở từ") };
    default:
      return { moTa: v.doiTac ?? "", nut: t("Mở"), to: "/dashboard", moc: "" };
  }
}

/** Năm nhóm việc chung: tên tab, câu khi trống, danh sách đầy đủ của hệ thống. */
export const NHOM_VIEC_CHUNG = [
  { key: "nhanHang", ten: t("Nhận hàng"), trong: t("Không có phiếu nhập chờ kiểm đếm."), to: "/goods-receipts?trangThai=cho-nhap-kho" },
  { key: "nhatHang", ten: t("Nhặt hàng"), trong: t("Không có phiếu nhặt nào chưa phân công."), to: "/goods-issues/pick-lists?trangThai=cho-nhat" },
  { key: "dongGoi", ten: t("Đóng gói"), trong: t("Không có đơn chờ đóng gói."), to: "/sales-orders?trangThai=cho-dong-goi" },
  { key: "xuatKho", ten: t("Xuất kho"), trong: t("Không có phiếu chờ xuất."), to: "/goods-issues?trangThai=cho-xuat-kho" },
  { key: "kiemKe", ten: t("Kiểm kê"), trong: t("Không có đợt kiểm kê nào đang mở."), to: "/stock-take?trangThai=dang-kiem-ke" },
];

/**
 * Hàng sắp về theo nhóm: "Quá hạn giao" (đơn mua đã trễ), "Đang trên đường" (phiếu chuyển đã xuất),
 * rồi từng ngày giao dự kiến. API đã xếp đúng thứ tự này.
 */
export function nhomHangSapVe(ds, thoiDiem) {
  const nhom = [];
  for (const h of ds ?? []) {
    const tenNhom = h.tre ? t("Quá hạn giao") : h.loai === "phieu_chuyen" ? t("Đang trên đường") : tenNgay(h.ngay, thoiDiem);
    const muc = {
      key: `${h.loai}-${h.id}`,
      doiTac: h.loai === "phieu_chuyen" ? t("Từ {{noiGui}}", { noiGui: h.doiTac ?? t("kho khác") }) : h.doiTac ?? t("Nhà cung cấp"),
      ma: h.ma,
      sl: t("{{soLuong}} sản phẩm", { soLuong: formatSo(h.soLuong), count: h.soLuong }),
      ben: h.tre ? t("Trễ {{count}} ngày", { count: soNgayGiua(h.ngay, thoiDiem) }) : h.loai === "phieu_chuyen" && h.ngay ? t("Xuất {{ngay}}", { ngay: ngayThangNgan(h.ngay) }) : "",
      tre: h.tre,
      to: h.loai === "phieu_chuyen" ? `/transfer-tickets/${h.id}` : `/purchase-orders/${h.id}`,
    };
    const g = nhom.find((x) => x.ten === tenNhom);
    if (g) g.ds.push(muc);
    else nhom.push({ ten: tenNhom, tre: Boolean(h.tre), ds: [muc] });
  }
  return nhom;
}

/* ============================== Nhân viên mua hàng ============================== */

export function theSoMuaHang(cs, cauHinh, thoiDiem) {
  if (!cs) return [];
  const dat = soTien(cs.datMua.tong);
  const pt = phanTram(cs.giaoDungHan.dungHan, cs.giaoDungHan.denHan);
  const ptTruoc = phanTram(cs.giaoDungHan.dungHanTruoc, cs.giaoDungHan.denHanTruoc);
  const bg = cs.choBaoGia;
  return [
    {
      key: "datMua",
      ten: t("Đã đặt mua"),
      so: dat.so,
      donVi: dat.donVi,
      bd: bdSoVoi(cs.datMua.tong, cs.datMua.kyTruoc, t("so với 30 ngày trước")),
      phu: t("Đơn mua đã chốt, 30 ngày qua"),
      xuHuong: {
        gt: cs.datMua.tamTuan.map((p) => p.giaTri),
        nhan: cs.datMua.tamTuan.map((p) => (soNgayGiua(p.ngay, thoiDiem) <= 6 ? t("7 ngày gần nhất") : t("Tuần từ {{ngay}}", { ngay: ngayThangNgan(p.ngay) }))),
        dinhDang: formatTienNgan,
      },
      to: "/purchase-orders",
    },
    {
      key: "dangVe",
      ten: t("Hàng đang về"),
      so: formatSo(cs.dangVe.soLuong),
      donVi: t("sản phẩm"),
      phu: t("{{soDon}} đơn mua còn hàng chưa nhận", { soDon: formatSo(cs.dangVe.soDon) }),
      to: "/purchase-orders",
    },
    {
      key: "giaoDungHan",
      ten: t("Giao đúng hạn"),
      so: pt == null ? "—" : formatSo(pt),
      donVi: pt == null ? "" : "%",
      bd: bienDongDiem(pt, ptTruoc) ? { ...bienDongDiem(pt, ptTruoc), soVoi: t("so với 30 ngày trước") } : null,
      phu: cs.giaoDungHan.denHan
        ? t("{{dungHan}}/{{denHan}} đơn đến hạn trong 30 ngày qua", { dungHan: formatSo(cs.giaoDungHan.dungHan), denHan: formatSo(cs.giaoDungHan.denHan) })
        : t("Chưa có đơn đến hạn trong 30 ngày qua"),
      thanh: pt,
      to: null,
    },
    {
      key: "choBaoGia",
      ten: t("Chờ nhà cung cấp báo giá"),
      so: formatSo(bg.tong),
      donVi: t("lượt hỏi giá"),
      phu: bg.tong ? t("Đã gửi cho {{soNhaCungCap}} nhà cung cấp", { soNhaCungCap: formatSo(bg.soNhaCungCap) }) : t("Không có lượt hỏi giá nào đang chờ"),
      chia: bg.tong
        ? [
            { nhan: t("chờ quá {{ngayChoBaoGia}} ngày", { ngayChoBaoGia: cauHinh.ngayChoBaoGia }), so: bg.quaHan, vanDe: true },
            { nhan: t("trong hạn"), so: bg.tong - bg.quaHan },
          ]
        : null,
      to: "/quotation-requests?trangThai=da-gui-yeu-cau-bao-gia",
    },
  ];
}

/** Bốn bước mua hàng; bước có việc chờ chính nhân viên mua hàng làm được đánh dấu "đến lượt bạn". */
export function buocQuyTrinh(q, cauHinh) {
  return [
    {
      key: "daDuyet",
      ten: t("Yêu cầu nhập đã duyệt"),
      so: q.daDuyet,
      donVi: t("yêu cầu"),
      phu: t("Chưa gửi hỏi giá"),
      viec: t("Gửi yêu cầu báo giá"),
      to: "/purchase-requests?trangThai=da-duyet",
      gap: q.daDuyet > 0,
    },
    {
      key: "choBaoGia",
      ten: t("Đang hỏi giá"),
      so: q.choBaoGia,
      donVi: t("yêu cầu"),
      chuY: q.choBaoGiaQuaHan > 0 ? t("{{choBaoGiaQuaHan}} chờ quá {{ngayChoBaoGia}} ngày", { choBaoGiaQuaHan: formatSo(q.choBaoGiaQuaHan), ngayChoBaoGia: cauHinh.ngayChoBaoGia }) : null,
      phu: t("Chờ nhà cung cấp báo giá"),
      viec: t("Xem yêu cầu báo giá"),
      to: "/quotation-requests?trangThai=da-gui-yeu-cau-bao-gia",
      gap: false,
    },
    {
      key: "choChotDon",
      ten: t("Chờ chốt đơn"),
      so: q.choChotDon,
      donVi: t("yêu cầu"),
      phu: t("Đã có báo giá"),
      viec: t("Chọn nhà cung cấp"),
      to: "/quotation-requests?trangThai=da-gui-yeu-cau-bao-gia",
      gap: q.choChotDon > 0,
    },
    {
      key: "dangGiao",
      ten: t("Đang giao"),
      so: q.dangGiao,
      donVi: t("đơn mua"),
      tre: q.dangGiaoTre > 0 ? t("{{dangGiaoTre}} trễ hạn", { dangGiaoTre: formatSo(q.dangGiaoTre) }) : null,
      phu: t("Theo dõi ngày giao"),
      viec: t("Xem đơn đang giao"),
      to: "/purchase-orders?trangThai=dang-van-chuyen",
      gap: false,
    },
  ];
}

/**
 * Lịch hàng về: ô "Trễ" (đơn đã quá ngày giao) và 7 ngày từ hôm nay. Mỗi ô: số đơn và danh sách đơn của ngày đó.
 */
export function lichTheoNgay(lich, thoiDiem) {
  const homNay = docNgay(thoiDiem);
  const tre = { key: "tre", tre: true, ds: [] };
  const ngay = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(homNay.getFullYear(), homNay.getMonth(), homNay.getDate() + i);
    const iso = `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
    ngay.push({ key: iso, iso, thu: THU_NGAN[d.getDay()], ten: TEN_THU[d.getDay()], ngay: d.getDate(), homNay: i === 0, ds: [] });
  }
  for (const d of lich ?? []) {
    const muc = {
      key: d.id,
      ma: d.ma,
      doiTac: d.nhaCungCap ?? t("Nhà cung cấp"),
      sl: t("{{conLai}} sản phẩm còn lại", { conLai: formatSo(d.conLai) }),
      tt: d.tre ? t("Trễ {{count}} ngày", { count: soNgayGiua(d.ngayGiao, thoiDiem) }) : null,
      to: `/purchase-orders/${d.id}`,
    };
    if (d.tre) tre.ds.push(muc);
    else ngay.find((n) => n.iso === d.ngayGiao)?.ds.push(muc);
  }
  return [tre, ...ngay].map((n) => ({ ...n, so: n.ds.length }));
}

/** Đường dẫn tạo yêu cầu nhập hàng mở sẵn mã và số lượng đề xuất (kho nhận là Kho tổng). */
export function duongDanYeuCauNhap(d, khoTongId) {
  return duongDanKemThamSo("/purchase-requests/create", {
    khoId: khoTongId,
    bienTheId: d.bienTheId,
    soLuong: d.soLuongDeXuat,
    ten: d.tenSanPham,
  });
}

/* ============================== Nhân viên bán hàng ============================== */

export function theSoBanHang(cs, thoiDiem) {
  if (!cs) return [];
  const dt = soTien(cs.doanhThu.homNay);
  const tb = cs.trungBinhDon;
  const tbTien = tb.homNay == null ? null : soTien(tb.homNay);
  const don = cs.donCuaToi;
  return [
    {
      key: "doanhThu",
      ten: t("Doanh thu hôm nay"),
      so: dt.so,
      donVi: dt.donVi,
      bd: bdSoVoi(cs.doanhThu.homNay, cs.doanhThu.cungGioTruoc, t("so với cùng giờ tuần trước")),
      phu: t("{{soChungTu}} đơn đã giao", { soChungTu: formatSo(cs.doanhThu.soChungTu) }),
      xuHuong: duongXuHuong(cs.doanhThu.bayNgay, thoiDiem, formatTienNgan),
      to: null,
    },
    {
      key: "donHomNay",
      ten: t("Đơn hôm nay"),
      so: formatSo(cs.donHomNay.soDon),
      donVi: t("đơn"),
      bd: bdSoVoi(cs.donHomNay.soDon, cs.donHomNay.cungGioTruoc, t("so với cùng giờ tuần trước")),
      phu: t("Tại quầy {{taiQuay}} · đơn khác {{donKhac}}", { taiQuay: formatSo(cs.donHomNay.taiQuay), donKhac: formatSo(cs.donHomNay.soDon - cs.donHomNay.taiQuay) }),
      xuHuong: duongXuHuong(cs.donHomNay.bayNgay, thoiDiem, (v) => t("{{soDon}} đơn", { soDon: formatSo(v), count: v })),
      // Danh sách đơn của nhân viên bán hàng chỉ gồm đơn do mình tạo, không chứa đủ số đơn của kho
      to: null,
    },
    {
      key: "trungBinhDon",
      ten: t("Trung bình mỗi đơn"),
      so: tbTien ? tbTien.so : "—",
      donVi: tbTien ? tbTien.donVi : "",
      bd: tb.homNay == null ? null : bdSoVoi(tb.homNay, tb.bayNgayTruoc, t("so với 7 ngày trước")),
      phu: tb.homNay == null ? t("Chưa có đơn giao hôm nay") : null,
      xuHuong: duongXuHuong(tb.bayNgay, thoiDiem, formatTienNgan),
      to: null,
    },
    {
      key: "donCuaToi",
      ten: t("Đơn của bạn chưa xong"),
      so: formatSo(don.tong),
      donVi: t("đơn"),
      phu: don.tong ? t("Giá trị {{tien}}", { tien: formatTienNgan(don.giaTri) }) : t("Không có đơn nào đang chờ"),
      chia: don.tong
        ? [
            { nhan: t("cần chú ý"), so: don.canChuY, vanDe: true },
            { nhan: t("đang xử lý"), so: don.tong - don.canChuY },
          ]
        : null,
      to: null,
    },
  ];
}

/**
 * Doanh thu cộng dồn theo giờ: hôm nay (đến bây giờ) và cùng thứ tuần trước. Trục từ giờ có bán sớm nhất (hoặc giờ
 * hiện tại) đến hết giờ có bán muộn nhất của hai ngày, ít nhất 8 giờ – 22 giờ, hai đầu trục rơi vào vạch; điểm cuối của
 * hôm nay đặt đúng phút hiện tại. Số tuần trước ở điểm đó lấy đúng số "cùng giờ tuần trước" của máy chủ (cungGioTruoc,
 * cùng số với ô Doanh thu) khi có, kẹp trong khoảng đầu giờ – cuối giờ; không có thì nội suy theo phút trong giờ.
 */
export function diemTheoGio(tg, thoiDiem, cungGioTruoc = null) {
  const bayGio = docNgay(thoiDiem);
  const phut = bayGio ? bayGio.getMinutes() : 0;
  const nay = tg.homNay ?? [];
  const truoc = tg.tuanTruoc ?? [];
  const coSo = (a) => a.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const gioCo = [...coSo(nay), ...coSo(truoc)];
  // Vạch 2 giờ một (trục dài hơn 16 giờ thì 4 giờ một để nhãn không chen nhau ở màn hẹp); hai đầu trục rơi vào vạch
  // để luôn có nhãn ở cả hai đầu
  const dauGoc = Math.min(8, tg.gioHienTai, ...gioCo);
  const cuoiGoc = Math.max(21, tg.gioHienTai + 1, ...gioCo.map((g) => g + 1));
  const buoc = cuoiGoc - dauGoc > 16 ? 4 : 2;
  const dau = Math.floor(dauGoc / buoc) * buoc;
  const cuoi = Math.min(24, Math.ceil(cuoiGoc / buoc) * buoc);
  const cong = (a, den) => a.slice(0, Math.max(0, den)).reduce((s, v) => s + (v || 0), 0);
  const ds = [];
  for (let g = dau; g <= cuoi; g++) {
    ds.push({ gio: g, truoc: cong(truoc, g), nay: g <= tg.gioHienTai ? cong(nay, g) : null });
  }
  // Điểm "bây giờ" (giữa giờ hiện tại)
  if (phut > 0) {
    const x = tg.gioHienTai + phut / 60;
    const dauGio = cong(truoc, tg.gioHienTai);
    const cuoiGio = cong(truoc, tg.gioHienTai + 1);
    const noiSuy = dauGio + ((truoc[tg.gioHienTai] || 0) * phut) / 60;
    // Số của máy chủ luôn nằm giữa đầu giờ và cuối giờ; kẹp lại để đường tuần trước không bao giờ đi xuống
    const diem = { gio: x, truoc: cungGioTruoc == null ? noiSuy : Math.min(cuoiGio, Math.max(dauGio, cungGioTruoc)), nay: cong(nay, tg.gioHienTai + 1), bayGio: true };
    const viTri = ds.findIndex((d) => d.gio > x);
    ds.splice(viTri < 0 ? ds.length : viTri, 0, diem);
  } else {
    // Đúng giờ tròn: điểm của giờ hiện tại đã gồm cả phần bán trong giờ này (nếu có)
    const d = ds.find((x) => x.gio === tg.gioHienTai);
    if (d) {
      d.nay = cong(nay, tg.gioHienTai + 1);
      if (cungGioTruoc != null) d.truoc = Math.min(cong(truoc, tg.gioHienTai + 1), Math.max(d.truoc, cungGioTruoc));
      d.bayGio = true;
    }
  }
  const diemBayGio = ds.find((d) => d.bayGio);
  return {
    ds,
    dau,
    cuoi,
    buoc,
    homNay: cong(nay, nay.length),
    truocCungGio: diemBayGio ? diemBayGio.truoc : 0,
    truocCaNgay: cong(truoc, 24),
  };
}

/** Vạch trục giờ: mỗi `buoc` giờ từ đầu đến cuối trục (hai đầu đã rơi vào vạch). */
export function vachGio(dau, cuoi, buoc = 2) {
  const ds = [];
  for (let g = dau; g <= cuoi; g += buoc) ds.push(g);
  return ds;
}

/** Nhãn giờ trên trục / bảng: 9 → "9:00", 15,5 → "15:30". */
export function nhanGio(g) {
  const h = Math.floor(g);
  const m = Math.round((g - h) * 60);
  return `${h}:${hai(m)}`;
}

/** Ghi chú của một đơn của bạn. */
export function chuYDon(o, thoiDiem) {
  if (o.chuY === "nhap") return t("Chưa gửi kho");
  if (o.chuY === "cho_lau") return t("Chờ {{ngayDat}}", { ngayDat: khoangCho(o.ngayDat, thoiDiem) });
  return null;
}

/** "Gửi sáng nay" / "Gửi hôm qua" / "Gửi 4 ngày trước". */
export function guiLuc(ngayTao, thoiDiem) {
  const n = soNgayGiua(ngayTao, thoiDiem);
  if (n <= 0) return t("Gửi lúc {{ngayTao}}", { ngayTao: gioPhutNgan(ngayTao) });
  if (n === 1) return t("Gửi hôm qua");
  return t("Gửi {{count}} ngày trước", { count: n });
}

/** Bỏ dấu để so khớp gợi ý (gõ không dấu cũng được). */
export function boDau(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Giá bán của sản phẩm tra tồn: "199.000 ₫" hoặc "199.000 – 219.000 ₫". */
export function giaBan(sp) {
  if (sp.giaThapNhat == null) return "";
  const f = (v) => formatSo(v);
  return sp.giaCaoNhat != null && sp.giaCaoNhat !== sp.giaThapNhat ? `${f(sp.giaThapNhat)} – ${f(sp.giaCaoNhat)} ₫` : `${f(sp.giaThapNhat)} ₫`;
}

export { gioPhut };
