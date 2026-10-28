/*
 * Hàm thuần của màn Chi tiết đơn bán hàng (`/sales-orders/:id`): loại đơn, dòng hàng, tiền, quyền của nút, lý do khóa
 * hủy, tiến trình, dòng thông báo, hệ quả khi hủy, thanh toán. Không React, không alias "@/…" để chạy `node --test`.
 *
 * Dữ liệu vào là DonBanHangDetailResponse của GET /don-ban-hang/{id}/detail:
 *   `{ donBanHang, chiTiet, phieuXuatKhoList, phieuNhatHangId, maPickList, trangThaiPhieuNhat, thanhToanTaiQuay }`.
 * Quy tắc khớp backend (DonBanHangController, DonBanHangService.cancel, OmnichannelOrderSyncJob) — xem từng hàm.
 */
import { TRANG_THAI_DON, TRANG_THAI_PHIEU_XUAT } from "../../../constants/trangThaiXuatBan.js";
import { docSo, nhanMauKichCo, soVN } from "../../chung-tu/bangChungTu.js";
import { laDaXuat } from "../../outbound/phieu-xuat/phieuXuat.js";

const TT = TRANG_THAI_DON;

/** Phiếu nhặt còn khóa đơn (khớp PHIEU_NHAT_DANG_HOAT_DONG của DonBanHangService). */
export const PHIEU_NHAT_KHOA_DON = Object.freeze(["cho_nhat", "dang_nhat", "da_nhat"]);

/**
 * Phương thức thu tiền (thanhToanTaiQuay.phuongThuc, phiếu thu đơn bán thường) → tên hiển thị. CASH là mã tiền mặt tại
 * quầy; TIEN_MAT / CHUYEN_KHOAN: phiếu thu / hoàn ghi tay của đơn bán thường (chuyển khoản kèm mã giao dịch trên sao kê).
 */
export const PHUONG_THUC_TAI_QUAY = Object.freeze({
  CASH: "Tiền mặt",
  TIEN_MAT: "Tiền mặt",
  PAYOS: "Chuyển khoản qua PayOS",
  CHUYEN_KHOAN: "Chuyển khoản",
});

/** Mã lý do Shopify hủy đơn (cancel_reason) → tiếng Việt. */
export const LY_DO_SAN_HUY = Object.freeze({
  customer: "khách hủy",
  fraud: "nghi gian lận",
  inventory: "hết hàng",
  declined: "thanh toán bị từ chối",
  staff: "nhân viên Shopify hủy",
  other: "lý do khác",
});

// Đơn sàn bị sàn hủy: OmnichannelOrderSyncJob ghi lyDoTuChoi = "Hủy từ sàn Shopify: <cancel_reason>"
const MAU_SAN_HUY = /^Hủy từ sàn\s+([^:]+):\s*(.*)$/i;
// Ghi chú tự sinh của đơn sàn: "Đơn hàng đồng bộ tự động từ Shopify #1021" (trùng mã đơn nên không hiện)
const MAU_GHI_CHU_TU_SINH = /^Đơn hàng đồng bộ tự động từ\s/i;

const coChu = (x) => x != null && String(x).trim() !== "";
const pad2 = (n) => String(n).padStart(2, "0");

/** Mốc giờ ngắn "16:21 · 17/10" (theo giờ máy, cùng kiểu mốc của tiến trình); trống hoặc sai → "". */
export function gioNgay(value) {
  if (value == null || value === "") return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

/** Đơn bán tại quầy: có lần thu tiền tại quầy (đơn POS không có kênh bán). */
export const laDonTaiQuay = (ct) => ct?.thanhToanTaiQuay != null;

/** Đơn đồng bộ từ sàn (Shopify): có kênh bán hoặc mã đơn bên sàn. */
export const laDonSan = (don) => Boolean(don?.kenhBanHang) || coChu(don?.maDonHangKenh);

/** Tên sàn để ghép câu ("Shopify"); thiếu thì "sàn". */
export const tenKenhCua = (don) => String(don?.kenhBanHang?.tenKenh ?? "").trim() || "sàn";

/** Ghi chú tự sinh khi đồng bộ đơn sàn ("Đơn hàng đồng bộ tự động từ Shopify #…") — trùng mã đơn nên ẩn. */
export const laGhiChuTuSinh = (ghiChu) => MAU_GHI_CHU_TU_SINH.test(String(ghiChu ?? "").trim());

/**
 * Lý do sàn hủy đơn, đọc từ `lyDoTuChoi` ("Hủy từ sàn Shopify: customer"). Không phải sàn hủy → null.
 * @returns {{ tenSan: string, ma: string, chu: string } | null} `chu`: lý do tiếng Việt.
 */
export function lyDoSanHuy(lyDoTuChoi) {
  const khop = MAU_SAN_HUY.exec(String(lyDoTuChoi ?? "").trim());
  if (!khop) return null;
  const ma = khop[2].trim().toLowerCase();
  return { tenSan: khop[1].trim(), ma, chu: LY_DO_SAN_HUY[ma] ?? LY_DO_SAN_HUY.other };
}

/**
 * Mã báo giá gốc suy từ mã đơn như backend (DonBanHangService.cancel): "SO202610217-1" → "BG202610217".
 * Không suy với đơn tại quầy và đơn sàn (cùng tiền tố SO nhưng không từ báo giá). Không khớp → null.
 */
export function maBaoGiaGoc(soDonHang, { laPos = false, laSan = false } = {}) {
  const so = String(soDonHang ?? "").trim();
  if (laPos || laSan || !/^SO/.test(so)) return null;
  return so.split("-")[0].replace(/^SO/, "BG");
}

/**
 * Tách tên dòng của máy chủ "Tên sản phẩm / Màu / Cỡ" (ChiTietDonBanHangMapper.tenHienThi: thiếu phần nào bỏ phần đó).
 * Tách từ phải để tên sản phẩm có " / " vẫn giữ nguyên. Chỉ có một phần sau tên thì không biết là màu hay cỡ:
 * xếp vào màu (dòng hàng không có mã màu nên không vẽ chấm màu).
 */
export function tachTenDong(ten) {
  const phan = String(ten ?? "").split(" / ").map((p) => p.trim());
  if (phan.length >= 3) return { tenSanPham: phan.slice(0, -2).join(" / "), tenMau: phan.at(-2), kichCo: phan.at(-1) };
  if (phan.length === 2) return { tenSanPham: phan[0], tenMau: phan[1], kichCo: "" };
  return { tenSanPham: phan[0] ?? "", tenMau: "", kichCo: "" };
}

/**
 * Dòng chứng từ (bangChungTu.js) từ `chiTiet` của đơn bán / báo giá: gom theo id sản phẩm khi máy chủ trả `sanPhamId`
 * (máy chủ cũ: theo tên), màu / mã màu / cỡ / ảnh, `nhanBienThe` "Màu / Cỡ", số lượng đặt, đơn giá và thành tiền.
 */
export function dongHangBan(chiTiet) {
  return (Array.isArray(chiTiet) ? chiTiet : []).filter(Boolean).map((ct, i) => {
    // Máy chủ mới trả sẵn tên gốc, màu, mã màu, cỡ, ảnh; máy chủ cũ chỉ có "Tên / Màu / Cỡ" → tách như trước
    const coTruong = Boolean(ct.tenSanPhamGoc || ct.tenMau || ct.kichCo);
    const ten = coTruong
      ? { tenSanPham: ct.tenSanPhamGoc || tachTenDong(ct.tenSanPham).tenSanPham, tenMau: ct.tenMau || "", kichCo: ct.kichCo || "" }
      : tachTenDong(ct.tenSanPham);
    const soLuong = docSo(ct.soLuongDat);
    const donGia = docSo(ct.donGia);
    return {
      id: ct.id ?? `dong-${i}`,
      khoaNhom: ct.sanPhamId ?? null,
      tenSanPham: ten.tenSanPham || ct.sku || "",
      tenMau: ten.tenMau,
      maMauHex: ct.maMauHex || "",
      kichCo: ten.kichCo,
      anh: ct.anh || null,
      nhanBienThe: nhanMauKichCo(ten),
      sku: ct.sku || "",
      soLuong,
      donGia,
      thanhTien: ct.thanhTien != null ? docSo(ct.thanhTien) : soLuong * donGia,
    };
  });
}

// Câu hệ thống tự ghi vào ghi chú phiếu xuất (NhatHangServiceImpl, PhieuXuatKhoService.taoLaiPhieuXuat), có thể nối
// " - <ghi chú của kho>" phía sau khi xác nhận xuất: bỏ phần câu hệ thống, giữ ghi chú của người
const DAU_GHI_CHU_PHIEU_TU_SINH = [
  /^Phiếu xuất tự động từ đợt nhặt hàng\s+\S+\s*(?:-\s*)?/i,
  /^Tạo lại sau khi phiếu xuất trước bị hủy\s*(?:-\s*)?/i,
];

/**
 * Ghi chú của kho lúc xuất (phần còn lại sau tachGhiChuPhieuXuat, `conLai`), đã bỏ câu hệ thống tự sinh; không còn gì → null.
 */
export function ghiChuKhiXuat(conLai) {
  const dong = String(conLai ?? "")
    .split("\n")
    .map((d) => DAU_GHI_CHU_PHIEU_TU_SINH.reduce((s, mau) => s.replace(mau, ""), d.trim()).trim())
    .filter(Boolean);
  return dong.length ? dong.join("\n") : null;
}

/** Phiếu xuất của đơn, mới nhất trước (id lớn hơn là phiếu tạo sau). */
export function dsPhieuXuat(ct) {
  return [...(Array.isArray(ct?.phieuXuatKhoList) ? ct.phieuXuatKhoList : [])]
    .filter(Boolean)
    .sort((a, b) => docSo(b.id) - docSo(a.id));
}

/** Phiếu xuất còn đang mở của đơn (Nháp = đang đóng gói, Chờ xuất = đã đóng gói), mới nhất. */
export function phieuXuatDangMo(ct) {
  return dsPhieuXuat(ct).find((p) => [TRANG_THAI_PHIEU_XUAT.NHAP, TRANG_THAI_PHIEU_XUAT.CHO_XUAT].includes(Number(p.trangThai))) ?? null;
}

/** Phiếu xuất đã xuất kho gần nhất (theo ngày xuất, không có thì theo id). */
export function phieuDaXuatCuoi(ct) {
  const daXuat = dsPhieuXuat(ct).filter(laDaXuat);
  const moc = (p) => (p.ngayXuat ? new Date(p.ngayXuat).getTime() || 0 : 0);
  return daXuat.sort((a, b) => moc(b) - moc(a) || docSo(b.id) - docSo(a.id))[0] ?? null;
}

/**
 * Tiền của đơn: hiện NGUYÊN 3 số máy chủ trả (không tự cộng). Xác nhận xuất kho ghi đè phí vận chuyển bằng cước thực tế
 * mà không tính lại tổng → `lechTong`. Đơn sàn: tiền hàng = current_subtotal_price của Shopify, có thể khác tổng các dòng
 * (giảm giá, dòng chưa liên kết SKU bị bỏ qua) → `lechDong`, `chenhDong` (số dương).
 */
export function tienDonBan(don, dong, { laSan = false } = {}) {
  const tienHang = docSo(don?.tienHang);
  const phi = docSo(don?.phiVanChuyen);
  const tongCong = docSo(don?.tongCong);
  const tongDong = (Array.isArray(dong) ? dong : []).reduce((s, d) => s + docSo(d?.thanhTien), 0);
  const chenh = tongDong - tienHang;
  return {
    tienHang,
    phi,
    tongCong,
    lechTong: Math.abs(tienHang + phi - tongCong) >= 0.5,
    lechDong: laSan && Array.isArray(dong) && dong.length > 0 && Math.abs(chenh) >= 0.5,
    chenhDong: Math.abs(chenh),
  };
}

/** Câu chú thích dưới Tổng cộng khi tiền hàng + phí ≠ tổng cộng. */
export function cauLechTong({ laSan, tenKenh = "sàn" }) {
  return laSan
    ? `Tổng cộng theo ${tenKenh} (gồm thuế, phí nếu có).`
    : "Phí vận chuyển đã đổi theo cước thực tế lúc xuất kho; tổng cộng giữ số lúc tạo đơn.";
}

/**
 * Lý do khóa "Hủy đơn" theo ĐÚNG thứ tự backend kiểm (DonBanHangService.cancel); hủy được thì "".
 * 1. Đã xuất kho / hoàn thành / hoàn trả. 2. Có phiếu xuất đã xuất. 3. Đơn trong phiếu nhặt còn hoạt động.
 * 4. Chờ đóng gói / chờ xuất kho (phiếu xuất tạo tay, không qua phiếu nhặt).
 */
export function lyDoKhoaHuy(ct) {
  const tt = Number(ct?.donBanHang?.trangThai);
  if ([TT.DA_XUAT_KHO, TT.HOAN_THANH, TT.BI_HOAN_TRA].includes(tt)) {
    return "Đơn đã xuất kho, hoàn thành hoặc đã hoàn trả, không thể hủy";
  }
  // Backend chỉ kiểm phiếu xuất ở mã 3 (existsByDonBanHangIdAndTrangThai(id, DA_XUAT))
  if (dsPhieuXuat(ct).some((p) => Number(p.trangThai) === TRANG_THAI_PHIEU_XUAT.DA_XUAT)) {
    return "Đơn đã có phiếu xuất hoàn thành, không thể hủy";
  }
  const pl = String(ct?.maPickList ?? "").trim();
  const coPhieuNhat = ct?.phieuNhatHangId != null || Boolean(pl);
  if (coPhieuNhat && (ct?.trangThaiPhieuNhat == null || PHIEU_NHAT_KHOA_DON.includes(ct.trangThaiPhieuNhat))) {
    return `Đơn đang nằm trong phiếu nhặt hàng${pl ? ` ${pl}` : ""} nên không thể hủy.`;
  }
  if (tt === TT.CHO_DONG_GOI || tt === TT.DA_DONG_GOI) {
    return `Đơn đang ở khâu ${tt === TT.CHO_DONG_GOI ? "chờ đóng gói" : "chờ xuất kho"} nên không thể hủy. Vui lòng liên hệ kho.`;
  }
  return "";
}

/**
 * Nút và mục menu theo vai trò × trạng thái (khớp @RequireAuth của DonBanHangController và PhieuXuatKhoController):
 * - `laBan` (quản trị viên, nhân viên bán hàng): in hóa đơn (ẩn khi Đã hủy), gửi sang kho (Nháp), hủy (⋯), đã giao
 *   (Đã xuất kho), ghi nhận hoàn trả (⋯, Đã xuất một phần / Đã xuất kho).
 * - `laKho` (quản trị viên, quản lý kho, nhân viên kho): đóng gói (Chờ đóng gói), xuất kho (Chờ xuất kho, có phiếu
 *   chờ xuất), tạo lại phiếu xuất (Chờ nhặt hàng / Đã xuất một phần, phiếu nhặt Đã nhặt, không còn phiếu xuất mở).
 * Đơn tại quầy (tạo thẳng ở Hoàn thành) không có hủy.
 */
export function thaoTacDonBan(ct, { laBan = false, laKho = false } = {}) {
  const tt = Number(ct?.donBanHang?.trangThai);
  const laPos = laDonTaiQuay(ct);
  const pxMo = phieuXuatDangMo(ct);
  const daNhat = ct?.trangThaiPhieuNhat === "da_nhat";
  const menuHuy = laBan && !laPos && [TT.NHAP, TT.CHO_NHAT_HANG, TT.CHO_DONG_GOI, TT.DA_DONG_GOI, TT.DA_XUAT_MOT_PHAN].includes(tt);
  return {
    coIn: laBan && tt !== TT.DA_HUY,
    menuHoanTra: laBan && (tt === TT.DA_XUAT_MOT_PHAN || tt === TT.DA_XUAT_KHO),
    menuHuy,
    lyDoKhoaHuy: menuHuy ? lyDoKhoaHuy(ct) : "",
    nutGuiKho: laBan && tt === TT.NHAP,
    nutDaGiao: laBan && tt === TT.DA_XUAT_KHO,
    nutDongGoi: laKho && tt === TT.CHO_DONG_GOI,
    nutXuat: laKho && tt === TT.DA_DONG_GOI && Boolean(pxMo),
    nutTaoLai: laKho && (tt === TT.CHO_NHAT_HANG || tt === TT.DA_XUAT_MOT_PHAN) && daNhat && !pxMo,
    pxMo,
  };
}

const NHAN_BUOC = ["Tạo đơn", "Gửi kho", "Nhặt hàng", "Đóng gói", "Xuất kho", "Giao hàng"];
// Bước đang làm theo trạng thái đơn (chỉ số trong NHAN_BUOC); Hoàn thành = mọi bước xong
const BUOC_DANG = { [TT.NHAP]: 1, [TT.CHO_NHAT_HANG]: 2, [TT.CHO_DONG_GOI]: 3, [TT.DA_DONG_GOI]: 4, [TT.DA_XUAT_MOT_PHAN]: 4, [TT.DA_XUAT_KHO]: 5, [TT.HOAN_THANH]: 6 };
const BUOC_DONG_GOI = 3;
const BUOC_NHAT = 2;
const BUOC_XUAT = 4;
const BUOC_GIAO = 5;

/**
 * Các bước tiến trình (TienTrinhChungTu): Tạo đơn → Gửi kho → Nhặt hàng → Đóng gói → Xuất kho → Giao hàng.
 * - Đơn tại quầy: không có tiến trình.
 * - Đã hủy: không có lịch sử thao tác nên chỉ đặt bước dừng khi dữ liệu cho biết — sàn hủy lúc đã có phiếu xuất (bị
 *   thu hồi) → Đóng gói; sàn hủy lúc đơn trong phiếu nhặt → Nhặt hàng; còn lại (hủy lúc Nháp / Chờ nhặt) ẩn tiến trình.
 * - Bị hoàn trả: mọi bước xong, bước cuối "Bị hoàn trả". Trạng thái lạ: không có tiến trình.
 */
export function buocDonBan(ct) {
  const don = ct?.donBanHang;
  if (!don || laDonTaiQuay(ct)) return [];
  const tt = Number(don.trangThai);
  const tenKenh = tenKenhCua(don);
  const pxXuat = phieuDaXuatCuoi(ct);

  let dung = -1;
  if (tt === TT.DA_HUY) {
    const sanHuy = lyDoSanHuy(don.lyDoTuChoi);
    if (sanHuy && dsPhieuXuat(ct).some((p) => Number(p.trangThai) === TRANG_THAI_PHIEU_XUAT.DA_HUY)) dung = BUOC_DONG_GOI;
    else if (sanHuy && coChu(ct.maPickList)) dung = BUOC_NHAT;
    else return [];
  } else if (tt !== TT.BI_HOAN_TRA && BUOC_DANG[tt] == null) {
    return [];
  }

  return NHAN_BUOC.map((nhan, i) => {
    const b = { ma: `b${i}`, nhan, trangThai: "chua" };
    if (tt === TT.DA_HUY) {
      b.trangThai = i < dung ? "xong" : i === dung ? "dung" : "chua";
      if (i === dung) {
        b.nhan = "Đã hủy";
        b.phu = `${tenKenh} hủy đơn`;
      }
    } else if (tt === TT.BI_HOAN_TRA) {
      b.trangThai = i < BUOC_GIAO ? "xong" : "dung";
      if (i === BUOC_GIAO) {
        b.nhan = "Bị hoàn trả";
        b.phu = "Khách trả lại";
      }
    } else {
      const d = BUOC_DANG[tt];
      b.trangThai = i < d ? "xong" : i === d ? "dangLam" : "chua";
    }
    if (i === 0) {
      b.ngay = don.ngayTao ?? don.ngayDatHang ?? null;
      b.coGio = true;
    }
    if (i === BUOC_XUAT && tt === TT.DA_XUAT_MOT_PHAN) b.phu = "Còn phần chưa xuất";
    else if (i === BUOC_XUAT && b.trangThai === "xong" && pxXuat?.ngayXuat) {
      b.ngay = pxXuat.ngayXuat;
      b.coGio = true;
    }
    if (i === BUOC_GIAO && tt === TT.HOAN_THANH) b.phu = "Khách đã nhận";
    return b;
  });
}

/**
 * Các dòng thông báo trong khối (chỉ khi có việc phải biết) `{ ma, tone, chu, lienKet? }`; `lienKet: "donChoXuat"` →
 * nút "Mở Đơn chờ xuất" (chỉ vai trò kho). `tenKho`: kho xuất của đơn. Câu theo bản demo đã chốt.
 */
export function thongBaoDonBan(ct, { laBan = false, laKho = false } = {}) {
  const don = ct?.donBanHang;
  if (!don) return [];
  const tt = Number(don.trangThai);
  const ds = [];
  const them = (ma, tone, chu, lienKet) => ds.push({ ma, tone, chu, lienKet: lienKet ?? null });
  const tenKho = don.khoXuat?.tenKho || "kho xuất";
  const laSan = laDonSan(don);
  const tenKenh = tenKenhCua(don);
  const pl = String(ct.maPickList ?? "").trim();
  const daNhat = ct.trangThaiPhieuNhat === "da_nhat";

  if (laDonTaiQuay(ct)) {
    them("taiQuay", "neutral", `Đã thu tiền và trừ tồn ở ${tenKho} ngay lúc bán.`);
  } else if (tt === TT.NHAP) {
    if (!laBan) them("nhap", "neutral", "Đơn nháp, bán hàng chưa gửi sang kho.");
    else if (laSan) them("nhap", "info", `Đơn ${tenKenh} tự về ${tenKho}. Chọn kho gần khách rồi gửi sang kho.`);
    else them("nhap", "info", `Đơn nháp đã trừ vào tồn có thể bán của ${tenKho}, chưa giữ lô. Gửi sang kho để kho bắt đầu nhặt hàng.`);
  } else if (tt === TT.CHO_NHAT_HANG && !pl) {
    them("choGom", "neutral", `Đơn đang ở Đơn chờ xuất của ${tenKho}, chờ kho gom vào phiếu nhặt hàng.`, laKho ? "donChoXuat" : null);
  } else if (tt === TT.CHO_NHAT_HANG && daNhat) {
    const px = dsPhieuXuat(ct).find((p) => Number(p.trangThai) === TRANG_THAI_PHIEU_XUAT.DA_HUY);
    const soPx = px?.soPhieuXuat ? `Phiếu xuất ${px.soPhieuXuat}` : "Phiếu xuất";
    them(
      "pxHuy",
      "warn",
      laKho
        ? `${soPx} đã bị hủy sau khi nhặt xong. Tạo lại phiếu xuất để dùng lại lô đã nhặt rồi đóng gói lại.`
        : `${soPx} đã bị hủy sau khi nhặt xong. Kho cần tạo lại phiếu xuất để giao tiếp đơn.`,
    );
  } else if (tt === TT.DA_XUAT_MOT_PHAN) {
    if (daNhat) {
      them(
        "conLai",
        "warn",
        laKho
          ? "Đơn còn phần chưa xuất. Tạo lại phiếu xuất để xuất nốt bằng lô đã nhặt."
          : "Đơn còn phần chưa xuất. Kho cần tạo lại phiếu xuất cho phần còn lại.",
      );
    } else {
      them("conLai", "neutral", `Đơn còn phần chưa xuất, đang ở Đơn chờ xuất của ${tenKho}.`);
    }
  } else if (tt === TT.DA_HUY) {
    const sanHuy = lyDoSanHuy(don.lyDoTuChoi);
    if (sanHuy) {
      const pxThuHoi = dsPhieuXuat(ct).find((p) => Number(p.trangThai) === TRANG_THAI_PHIEU_XUAT.DA_HUY);
      const thuHoi = pxThuHoi?.soPhieuXuat ? ` Phiếu xuất ${pxThuHoi.soPhieuXuat} đã được thu hồi.` : "";
      them("sanHuy", "neutral", `${sanHuy.tenSan} đã hủy đơn, lý do: ${sanHuy.chu}.${thuHoi}`);
      // Phiếu nhặt chỉ còn đơn bị hủy thì máy chủ chuyển phiếu sang da_huy nhưng vẫn sinh lệnh cất hàng về kệ
      if (laKho && pl && ["dang_nhat", "da_nhat", "da_huy"].includes(ct.trangThaiPhieuNhat)) {
        them("hoanKe", "warn", `Hàng đã lấy cho đơn này cần cất về khu hoàn kệ theo phiếu nhặt ${pl}.`);
      }
    } else {
      them("daHuy", "neutral", "Đơn đã hủy. Số hàng của đơn đã trả về tồn có thể bán.");
    }
  } else if (tt === TT.BI_HOAN_TRA) {
    them("hoanTra", "warn", "Khách đã trả lại hàng. Hàng chưa vào lại tồn kho.");
  }
  return ds;
}

/** Câu thông báo khi tiền hàng của đơn sàn khác tổng các dòng. */
export function cauLechDong({ tenKenh = "sàn", chenh }) {
  return `Tiền hàng lấy theo ${tenKenh}, khác tổng các dòng ${soVN(chenh)} ₫ (giảm giá trên ${tenKenh} hoặc dòng chưa liên kết SKU).`;
}

/**
 * Hệ quả của "Hủy đơn" (hiện trong hộp xác nhận), đúng việc backend làm: trả hàng về tồn có thể bán; báo giá gốc đang
 * Đã chốt đơn về Chờ phản hồi (`baoGia`: `{ ma, chacChan }` — `chacChan` khi đã tra được báo giá ở Đã chốt đơn, không thì
 * ghi "nếu đang Đã chốt đơn" vì người xem không tra được trạng thái); đơn sàn: gửi yêu cầu hủy sang
 * sàn sau khi lưu, lỗi thì đơn vẫn hủy ở FCentric, không tự hoàn tiền.
 */
export function hauQuaHuy(ct, { baoGia = null } = {}) {
  const don = ct?.donBanHang;
  const tenKho = don?.khoXuat?.tenKho || "kho xuất";
  const ds = [`Trả số hàng của đơn về tồn có thể bán của ${tenKho}.`];
  if (baoGia?.ma) {
    ds.push(baoGia.chacChan
      ? `Báo giá ${baoGia.ma} đang Đã chốt đơn sẽ trở lại Chờ phản hồi.`
      : `Báo giá ${baoGia.ma} (nếu đang Đã chốt đơn) sẽ trở lại Chờ phản hồi.`);
  }
  if (laDonSan(don)) {
    const tenKenh = tenKenhCua(don);
    ds.push(`Gửi yêu cầu hủy sang ${tenKenh} sau khi lưu. Nếu ${tenKenh} báo lỗi, đơn vẫn hủy ở FCentric.`);
    if (don?.trangThaiThanhToan === "da_thanh_toan") ds.push(`Không tự hoàn tiền cho khách: hoàn tiền trên ${tenKenh}.`);
  }
  return ds;
}

/**
 * Phần thanh toán cạnh tổng tiền:
 * - Đơn tại quầy: "Đã thanh toán", phương thức (`phuongThuc` đã dịch) và giờ thu (`ngayThu`), `laTienMat` → có Khách đưa /
 *   Tiền thừa. Trả kết hợp (QR payOS kèm tiền mặt khách trả trước): `ketHop` = { tienMat, qr }.
 * - Đơn sàn: trạng thái chụp lúc đồng bộ (`maTrangThai` da_thanh_toan / chua_thanh_toan).
 * - Đơn thường (máy chủ báo `thanhToan.donThuong`): trạng thái theo phiếu ghi nhận thu (đặt cọc, thu nhiều lần),
 *   `laDonThuong` → khối phải thu / đã thu / còn lại và nút Ghi nhận thanh toán. Đơn cũ chưa theo dõi: trạng thái trống.
 * - Máy chủ cũ không trả `thanhToan`: câu trung tính, không có thẻ.
 */
export function thanhToanDonBan(ct) {
  const don = ct?.donBanHang;
  const ttq = ct?.thanhToanTaiQuay;
  const tt = ct?.thanhToan;
  if (ttq) {
    const ma = String(ttq.phuongThuc ?? "").trim().toUpperCase();
    const tienMat = Number(ttq.tienMatTruoc) > 0 ? Number(ttq.tienMatTruoc) : 0;
    const tong = Number(ttq.soTienThu) || 0;
    return {
      maTrangThai: "da_thanh_toan",
      phuongThuc: tienMat > 0 ? "Tiền mặt + QR payOS" : PHUONG_THUC_TAI_QUAY[ma] ?? (ttq.phuongThuc || "—"),
      ngayThu: ttq.ngayThu ?? null,
      laTienMat: ma === "CASH",
      ketHop: tienMat > 0 ? { tienMat, qr: Math.max(tong - tienMat, 0) } : null,
      chu: null,
    };
  }
  if (laDonSan(don)) {
    return {
      maTrangThai: don?.trangThaiThanhToan === "da_thanh_toan" ? "da_thanh_toan" : "chua_thanh_toan",
      chu: `Theo ${tenKenhCua(don)} lúc đồng bộ đơn.`,
    };
  }
  if (tt?.donThuong) {
    const coThu = (tt.phieu ?? []).some((p) => p.trangThai === "HIEU_LUC");
    return {
      maTrangThai: tt.trangThai || null,
      laDonThuong: true,
      thuThua: Number(tt.thuThua) > 0 ? Number(tt.thuThua) : 0,
      chu: !tt.trangThai ? "Đơn tạo trước khi có ghi nhận thanh toán: chưa theo dõi."
        : coThu ? "Theo phiếu thu bên dưới." : "Chưa ghi nhận khoản thu nào.",
    };
  }
  return { maTrangThai: null, chu: "Hệ thống chưa theo dõi thanh toán của đơn bán thường." };
}
