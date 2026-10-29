/*
 * Logic thuần của màn Thực hiện nhặt hàng (pages/issue/PickListDetail.jsx): quyền theo vai trò và người được giao
 * (khớp NhatHangServiceImpl), trạng thái từng dòng, dòng cho bảng hàng, 5 bước tiến trình, thẻ đơn ở cột phải,
 * cập nhật sau mỗi lần quét, kết quả hoàn tất nhặt, lọc chữ trong câu của máy chủ.
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test` (chỉ import đường dẫn tương đối).
 */
import { PICK_LIST_EDITABLE, PICK_LIST_STATUS, formatQuantity, toNumber } from "../../../constants/outbound.js";
import { TRANG_THAI_DON } from "../../../constants/trangThaiXuatBan.js";
import { boDau, cauChungTuRong } from "../../chung-tu/bangChungTu.js";
import { khoangVideoNgan } from "../dong-goi/tinhDongGoi.js";

/** Tên chứng từ của màn (chữ của khung lỗi, câu rỗng): viết thường, đầy đủ. */
export const TEN_CHUNG_TU = "phiếu nhặt hàng";

/** Đơn vị một dòng của bảng và dòng phụ đầu khối (như các màn chứng từ khác): "5 biến thể", "Tìm thấy 3 biến thể". */
export const DON_VI_DONG = "biến thể";

/**
 * Loại phiếu nhặt (máy chủ `loaiPhieu`, cũng là tham số lọc `loai` của danh sách): BAN_HANG gom đơn bán; CHUYEN_KHO là
 * phiếu nhặt của phiếu chuyển kho (đặc tả bước 8: duyệt phiếu chuyển thì PX-CK vào danh sách chờ nhặt) — không có đơn,
 * không đóng gói, hoàn tất nhặt thì lô ghi vào phiếu xuất PX-CK và kho xuất bấm Xác nhận xuất ở phiếu chuyển.
 */
export const LOAI_PHIEU_NHAT = Object.freeze({ BAN_HANG: "BAN_HANG", CHUYEN_KHO: "CHUYEN_KHO" });

/** Bộ lọc loại ở danh sách phiếu nhặt: `value` gửi API (`loai`), rỗng = tất cả. */
export const LOC_LOAI_PHIEU_NHAT = [
  { value: "", label: "Loại: Tất cả" },
  { value: LOAI_PHIEU_NHAT.BAN_HANG, label: "Bán hàng" },
  { value: LOAI_PHIEU_NHAT.CHUYEN_KHO, label: "Chuyển kho" },
];

/** Phiếu nhặt của phiếu chuyển kho (không phải gom đơn bán). */
export const laPhieuChuyenKho = (phieu) => phieu?.loaiPhieu === LOAI_PHIEU_NHAT.CHUYEN_KHO;

/** Phiếu chuyển của phiếu nhặt chuyển kho đã xuất kho (Đang vận chuyển trở đi, trừ Đã hủy). */
const PHIEU_CHUYEN_DA_XUAT = ["DANG_VAN_CHUYEN", "CHO_XU_LY_LECH", "HOAN_TAT"];
export const phieuChuyenDaXuat = (phieu) => PHIEU_CHUYEN_DA_XUAT.includes(phieu?.trangThaiPhieuChuyen);

/**
 * Phiếu chuyển bị hủy khi hàng đang đi: hủy lúc Đã duyệt thì máy chủ hủy luôn phiếu nhặt, nên phiếu nhặt đã nhặt xong
 * (không còn mở, không hủy) mà phiếu chuyển Đã hủy nghĩa là hàng đã xuất rồi mới hủy — kho xuất nhập hoàn trả.
 */
export function phieuChuyenHuyKhiDangDi(phieu) {
  const tt = phieu?.trangThai;
  return laPhieuChuyenKho(phieu)
    && phieu.trangThaiPhieuChuyen === "DA_HUY"
    && !PICK_LIST_EDITABLE.includes(tt)
    && !PHIEU_DA_HUY.includes(tt);
}

const tenPhieuChuyen = (phieu) => (phieu?.soPhieuChuyen ? `phiếu chuyển ${phieu.soPhieuChuyen}` : "phiếu chuyển");
const tenPhieuXuat = (phieu) => (phieu?.soPhieuXuat ? `phiếu xuất ${phieu.soPhieuXuat}` : "phiếu xuất kho");

/**
 * Dòng "Đã nhặt xong" của phiếu nhặt chuyển kho: `{ tone, cau }`. Chờ Xác nhận xuất ở phiếu chuyển; phiếu chuyển đã
 * xuất kho; phiếu chuyển đã hủy khi hàng đang đi (kho xuất nhập hoàn trả). Thiếu số phiếu thì bỏ số, không để chỗ trống.
 */
export function dongDaNhatChuyenKho(phieu) {
  if (phieuChuyenHuyKhiDangDi(phieu)) {
    const so = phieu.soPhieuChuyen ? ` ${phieu.soPhieuChuyen}` : "";
    return {
      tone: "neutral",
      cau: `Đã nhặt xong và đã xuất kho. Phiếu chuyển${so} đã hủy khi hàng đang đi, kho xuất nhập hoàn trả.`,
    };
  }
  if (phieuChuyenDaXuat(phieu)) return { tone: "ok", cau: `Đã nhặt xong và ${tenPhieuChuyen(phieu)} đã xuất kho.` };
  return {
    tone: "ok",
    cau: `Đã nhặt xong, lô đã giữ cho ${tenPhieuXuat(phieu)}. Bấm Xác nhận xuất ở ${tenPhieuChuyen(phieu)} để hàng rời kho.`,
  };
}

/**
 * Nguồn của phiếu nhặt cho cột "Đơn / phiếu chuyển" ở danh sách và dòng phụ đầu khối: phiếu chuyển kho → "Chuyển kho"
 * kèm số phiếu chuyển (và kho nhận); phiếu bán → "n đơn" kèm vài mã đơn. Không bao giờ ra "0 đơn" cho phiếu chuyển kho.
 * @returns `{ chuyenKho, nhan, phu, title }`
 */
export function nguonPhieuNhat(phieu) {
  if (laPhieuChuyenKho(phieu)) {
    const so = phieu.soPhieuChuyen || "";
    return {
      chuyenKho: true,
      nhan: "Chuyển kho",
      phu: [so, phieu.tenKhoNhan ? `→ ${phieu.tenKhoNhan}` : ""].filter(Boolean).join(" "),
      title: so,
    };
  }
  const ma = Array.isArray(phieu?.danhSachMaDonHang) ? phieu.danhSachMaDonHang.filter(Boolean) : [];
  const soDon = phieu?.tongDonHang ?? ma.length;
  return {
    chuyenKho: false,
    nhan: `${formatQuantity(soDon)} đơn`,
    phu: ma.length ? `${ma.slice(0, 2).join(", ")}${ma.length > 2 ? ` +${ma.length - 2}` : ""}` : "",
    title: ma.join(", "),
  };
}

/**
 * Lọc chữ trong câu của máy chủ (NhatHangServiceImpl) trước khi hiện: chữ tiếng Anh và cách gọi cũ đổi sang thuật ngữ
 * đã chốt, phần còn lại giữ nguyên văn.
 * - "đợt nhặt hàng Pick List ID: 9" → "phiếu nhặt hàng mã số 9"; "(Pick List ID)" bỏ; "Pick List" → "phiếu nhặt hàng";
 * - "đợt nhặt hàng" → "phiếu nhặt hàng"; " (Self-assignment)" bỏ;
 * - "trong đợt nhặt PL-001" → "trong phiếu nhặt hàng PL-001"; "của đợt này" / "trong đợt đã bị hủy" → "của phiếu nhặt hàng
 *   này" / "trong phiếu nhặt hàng đã bị hủy";
 * - "Đã quét 1x Áo…" → "Đã quét 1 × Áo…";
 * - "trạng thái: da_nhat" → "trạng thái: Đã nhặt" (mã thô của phiếu nhặt).
 * Không phải chuỗi hoặc rỗng: trả nguyên.
 */
export function cauMayChuPhieuNhat(cau) {
  if (typeof cau !== "string" || !cau) return cau;
  return cau
    .replace(/\s*\(\s*Pick\s*List\s*ID\s*\)/gi, "")
    .replace(/(đ|Đ)ợt nhặt hàng\s+Pick\s*List\s*ID\s*:?\s*/g, (_, d) => `${d === "Đ" ? "P" : "p"}hiếu nhặt hàng mã số `)
    .replace(/Pick\s*List\s*ID\s*:?\s*/gi, "phiếu nhặt hàng mã số ")
    .replace(/Pick\s*List/gi, "phiếu nhặt hàng")
    .replace(/(đ|Đ)ợt nhặt hàng/g, (_, d) => `${d === "Đ" ? "P" : "p"}hiếu nhặt hàng`)
    .replace(/(đ|Đ)ợt nhặt(?!\s*hàng)/g, (_, d) => `${d === "Đ" ? "P" : "p"}hiếu nhặt hàng`)
    .replace(/(của|trong)\s+đợt/g, "$1 phiếu nhặt hàng")
    .replace(/\s*\(\s*Self-assignment\s*\)/gi, "")
    .replace(/(\d+(?:[.,]\d+)?)x(?=\s)/g, "$1 ×")
    .replace(/(trạng thái:\s*)([a-z_]+)/g, (goc, dau, ma) => (PICK_LIST_STATUS[ma] ? `${dau}${PICK_LIST_STATUS[ma].label}` : goc));
}

// Câu gốc (chưa lọc chữ) của lỗi quét 400 khi phiếu vừa đổi ở máy khác (NhatHangServiceImpl.quetBarcode)
const MAU_PHIEU_DA_DOI = /đã hoàn tất|đã được xuất kho|đã bị hủy|không có mặt hàng nào cần nhặt/;

/**
 * Lỗi quét có cần tải lại phiếu không: 409 (đổi người nhặt, chưa phân công…), hoặc 400 mà câu gốc của máy chủ báo
 * phiếu đã hoàn tất / đã xuất kho / đã hủy / không còn mặt hàng cần nhặt. Lỗi quét thường gặp (mã không thuộc phiếu,
 * đã nhặt đủ, quét vượt) cũng là 400 nhưng không cần tải lại cả phiếu.
 */
export function loiQuetCanTaiLai(trangThai, cauGoc) {
  if (trangThai === 409) return true;
  return trangThai === 400 && typeof cauGoc === "string" && MAU_PHIEU_DA_DOI.test(cauGoc);
}

/**
 * Bộ lọc câu máy chủ của khung lỗi tải (KhungLoiChungTu → locCauMayChu): đã lọc chữ; câu "… thuộc kho khác" bỏ hẳn vì
 * mô tả chuẩn của màn "Không tìm thấy" ("… không tồn tại hoặc thuộc kho khác với nơi làm việc đang chọn.") đã nói đúng ý.
 */
export function cauMayChuKhongThay(cau) {
  if (!cau || boDau(cau).includes("kho khac")) return null;
  return cauMayChuPhieuNhat(cau);
}

const PHIEU_DA_HUY = ["da_huy", "huy"];

/**
 * Quyền trên phiếu nhặt (spec-picking §A.4, khớp backend):
 * - chỉ người được phân công mới quét, kể cả quản lý kho / quản trị viên;
 * - nhân viên kho chỉ tự nhận phiếu chưa có người; quản lý phân công (lại) được;
 * - hoàn tất: người được giao, hoặc quản lý hoàn tất thay (phiếu phải đã phân công);
 * - phân bổ lô: người được giao, hoặc quản lý (kể cả khi phiếu chưa phân công).
 * `idToi`: id người đang đăng nhập (JWT). Phiếu đã nhặt / đã hủy / dữ liệu cũ: chỉ xem.
 */
export function tinhQuyen(phieu, { laQuanLy = false, idToi = null } = {}) {
  const trangThai = phieu?.trangThai;
  const dangMo = PICK_LIST_EDITABLE.includes(trangThai);
  const daHuy = PHIEU_DA_HUY.includes(trangThai);
  const daPhanCong = phieu?.nguoiNhatId != null;
  const laNguoiNhat = daPhanCong && idToi != null && Number(phieu.nguoiNhatId) === Number(idToi);
  return {
    dangMo,
    daHuy,
    // Đã nhặt xong ("da_nhat") hoặc dữ liệu cũ đã xuất ("da_xuat", "hoan_tat", mã lạ)
    daXongNhat: Boolean(phieu) && !dangMo && !daHuy,
    laQuanLy: Boolean(laQuanLy),
    daPhanCong,
    laNguoiNhat,
    duocQuet: dangMo && laNguoiNhat,
    duocPhanCong: dangMo && (Boolean(laQuanLy) || !daPhanCong),
    duocNhanViec: dangMo && !daPhanCong && idToi != null,
    duocHoanTat: dangMo && daPhanCong && (laNguoiNhat || Boolean(laQuanLy)),
    duocPhanBoLo: dangMo && (laNguoiNhat || Boolean(laQuanLy)),
  };
}

/**
 * Trạng thái một dòng phiếu nhặt: "bo" (Đã bỏ: số cần nhặt về 0 vì đơn chứa dòng đã hủy; backend không xóa dòng),
 * "du" (đã quét đủ), "thieu" (còn thiếu). Backend chặn quét quá số cần nên không có "thừa".
 */
export function trangThaiDong(line) {
  const can = toNumber(line?.soLuongCanNhat);
  const da = toNumber(line?.soLuongDaQuet);
  if (can <= 0) return "bo";
  return da >= can ? "du" : "thieu";
}

/** Lọc nhanh của bảng (useBangChungTu → boLoc): Tất cả / Còn thiếu / Đủ. Dòng "Đã bỏ" chỉ có ở Tất cả. */
export const BO_LOC_DONG = Object.freeze({
  tatCa: null,
  conThieu: (dong) => dong.trangThai === "thieu",
  du: (dong) => dong.trangThai === "du",
});

const SO_SANH_SKU = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/**
 * Đổi `chiTietNhatHangs` sang dòng của bảng chứng từ (xem components/chung-tu/bangChungTu.js) và giữ dòng gốc ở `goc`
 * (hộp Phân bổ lô cần). Thứ tự CỐ ĐỊNH theo mã SKU (rồi id): không phụ thuộc tiến độ, nên dòng không nhảy sau khi quét
 * và các biến thể của một sản phẩm nằm cạnh nhau.
 */
export function dongBangNhat(chiTiet) {
  const ds = Array.isArray(chiTiet) ? chiTiet.filter(Boolean) : [];
  return ds
    .map((line) => {
      const can = toNumber(line.soLuongCanNhat);
      const da = toNumber(line.soLuongDaQuet);
      const trangThai = trangThaiDong(line);
      const lo = (Array.isArray(line.phanBoLo) ? line.phanBoLo : [])
        .filter((p) => p && p.maLo != null)
        .map((p) => ({ maLo: p.maLo, soLuong: toNumber(p.soLuong) }));
      const bo = trangThai === "bo";
      return {
        id: line.id,
        tenSanPham: line.tenSanPham || line.maSku || "",
        sku: line.maSku || "",
        tenMau: line.tenMau || "",
        maMauHex: line.maMauHex || "",
        kichCo: line.tenSize || "",
        anh: line.anhBienTheUrl || null,
        maVach: line.maVachSku || "",
        chuTimThem: line.tenChatLieu || "",
        lo,
        can,
        da,
        trangThai,
        chuaLo: !bo && lo.length === 0,
        // Phân bổ chưa đủ số cần nhặt (tồn theo lô không đủ): chỉ khi đã có ít nhất một lô
        thieuLo: !bo && lo.length > 0 ? Math.max(0, can - toNumber(line.soLuongDaPhanBo)) : 0,
        thuCong: Boolean(line.phanBoThuCong),
        goc: line,
      };
    })
    .sort((a, b) => SO_SANH_SKU.compare(a.sku, b.sku) || toNumber(a.id) - toNumber(b.id));
}

/**
 * Áp kết quả một lần quét (KetQuaQuetBarcodeDto) vào phiếu đang xem, không tải lại cả trang (như bản cũ):
 * dòng khớp `chiTietId` (dự phòng `bienTheId`) nhận số đã quét mới, phiếu "Chờ nhặt" đổi thành "Đang nhặt",
 * cập nhật tổng đã quét, phần trăm và cờ được hoàn tất.
 */
export function capNhatSauQuet(phieu, kq) {
  if (!phieu) return phieu;
  const lines = (phieu.chiTietNhatHangs ?? []).map((line) => {
    const khop = kq?.chiTietId != null ? line.id === kq.chiTietId : line.bienTheSanPhamId === kq?.bienTheId;
    return khop ? { ...line, soLuongDaQuet: kq.soLuongDaQuet } : line;
  });
  return {
    ...phieu,
    trangThai: phieu.trangThai === "cho_nhat" ? "dang_nhat" : phieu.trangThai,
    chiTietNhatHangs: lines,
    tongSoLuongDaQuet: kq?.tongSoLuongDaQuet ?? phieu.tongSoLuongDaQuet,
    phanTramHoanThanh: kq?.phanTramHoanThanh ?? phieu.phanTramHoanThanh,
    coTheHoanTat: kq?.coTheHoanTat ?? phieu.coTheHoanTat,
  };
}

/** Id dòng vừa quét (để tô sáng và chuyển tới trang chứa dòng): `chiTietId`, không có thì dòng cùng biến thể. */
export function idDongDaQuet(phieu, kq) {
  if (kq?.chiTietId != null) return kq.chiTietId;
  if (kq?.bienTheId == null) return null;
  const dong = (phieu?.chiTietNhatHangs ?? []).find((line) => line?.bienTheSanPhamId === kq.bienTheId);
  return dong?.id ?? null;
}

/** Câu báo quét thành công: câu của máy chủ (đã lọc chữ), không có thì "{SKU} +{số} → {đã}/{cần}" như bản cũ. */
export function cauQuetThanhCong(kq, barcode, soLuong) {
  if (kq?.thongBao) return cauMayChuPhieuNhat(kq.thongBao);
  return `${kq?.maSku ?? barcode} +${soLuong} → ${formatQuantity(kq?.soLuongDaQuet)}/${formatQuantity(kq?.soLuongCanNhat)}`;
}

/**
 * Tiến độ nhặt của cả phiếu (cùng cách tính PickProgress): phần trăm của máy chủ kẹp 0–100, không có thì đã / cần.
 * `pct` làm tròn để hiển thị; "sản phẩm" là tổng số cái, không phải số SKU.
 */
export function tinhTienDo(daQuet, canNhat, phanTram) {
  const can = toNumber(canNhat);
  const da = toNumber(daQuet);
  const tho = phanTram !== undefined && phanTram !== null
    ? Math.min(100, Math.max(0, toNumber(phanTram)))
    : can > 0 ? Math.min(100, (da / can) * 100) : 0;
  return { da, can, pct: Math.round(tho), xong: can > 0 && da >= can, conLai: Math.max(0, can - da) };
}

/**
 * Lý do nút "Hoàn tất nhặt" đang khóa (hiện cạnh nút); rỗng khi bấm được. `rong`: phiếu không có dòng nào
 * ("Phiếu nhặt hàng chưa có sản phẩm nào"); còn dòng nhưng mọi dòng đã bỏ: "Phiếu không còn dòng cần nhặt".
 */
export function lyDoKhoaHoanTat({ coTheHoanTat, conLai, dangGui = 0, rong = false }) {
  if (!coTheHoanTat) {
    if (rong) return cauChungTuRong(TEN_CHUNG_TU, { dauCham: false });
    return toNumber(conLai) > 0 ? `Còn ${formatQuantity(conLai)} sản phẩm chưa nhặt` : "Phiếu không còn dòng cần nhặt";
  }
  return dangGui > 0 ? "Đang gửi mã vừa quét" : "";
}

// Thứ tự thẻ đơn ở cột phải: việc cần làm trước (chờ nhặt, chờ đóng gói) → chờ xuất kho → đã xuất → đã hủy
const HANG_DON = {
  [TRANG_THAI_DON.CHO_NHAT_HANG]: 0,
  [TRANG_THAI_DON.CHO_DONG_GOI]: 0,
  [TRANG_THAI_DON.DA_DONG_GOI]: 1,
  [TRANG_THAI_DON.DA_XUAT_MOT_PHAN]: 1,
  [TRANG_THAI_DON.DA_XUAT_KHO]: 2,
  [TRANG_THAI_DON.HOAN_THANH]: 2,
  [TRANG_THAI_DON.BI_HOAN_TRA]: 2,
  [TRANG_THAI_DON.DA_HUY]: 3,
};
const hangDon = (don) => (don.huy ? 3 : HANG_DON[don.trangThai] ?? 0);

/**
 * Các đơn trong phiếu cho cột phải, theo `danhSachMaDonHang` (thiếu thì theo `danhSachDonHang`), thông tin ghép theo
 * `soDonHang`. Đơn bị hủy: `biHuy` của máy chủ, hoặc vừa nhận cảnh báo hủy qua WebSocket (`huySo`: một số đơn hoặc
 * mảng số đơn, `huyHet`) mà chưa tải lại xong. Sắp xếp: việc cần làm trước, đơn hủy cuối; cùng hạng giữ thứ tự gốc.
 * @returns `[{ so, info, huy, trangThai, viTri }]` — `trangThai` là mã đơn bán (đơn hủy: 4), `info` có thể null,
 *   `viTri` là thứ tự gốc.
 */
export function dsDonTrongPhieu(phieu, { huySo = null, huyHet = false } = {}) {
  const thongTin = Array.isArray(phieu?.danhSachDonHang) ? phieu.danhSachDonHang.filter((o) => o?.soDonHang) : [];
  const theoSo = new Map(thongTin.map((o) => [o.soDonHang, o]));
  const ma = Array.isArray(phieu?.danhSachMaDonHang) && phieu.danhSachMaDonHang.length
    ? phieu.danhSachMaDonHang
    : thongTin.map((o) => o.soDonHang);
  const dsHuy = Array.isArray(huySo) ? huySo : huySo != null ? [huySo] : [];
  return ma
    .filter(Boolean)
    .map((so, viTri) => {
      const info = theoSo.get(so) ?? null;
      const huy = Boolean(info?.biHuy) || huyHet || dsHuy.includes(so);
      const trangThai = huy ? TRANG_THAI_DON.DA_HUY : info?.trangThai ?? null;
      return { so, info, huy, trangThai, viTri };
    })
    .sort((a, b) => hangDon(a) - hangDon(b) || a.viTri - b.viTri);
}

const DA_DONG_GOI = [
  TRANG_THAI_DON.DA_DONG_GOI,
  TRANG_THAI_DON.DA_XUAT_MOT_PHAN,
  TRANG_THAI_DON.DA_XUAT_KHO,
  TRANG_THAI_DON.HOAN_THANH,
  TRANG_THAI_DON.BI_HOAN_TRA,
];
const DA_XUAT = [TRANG_THAI_DON.DA_XUAT_KHO, TRANG_THAI_DON.HOAN_THANH, TRANG_THAI_DON.BI_HOAN_TRA];

/** Đếm đơn còn hiệu lực (không hủy), đã đóng gói (từ Chờ xuất kho trở đi) và đã xuất kho. */
export function demDon(dsDon) {
  const hopLe = (Array.isArray(dsDon) ? dsDon : []).filter((d) => !d.huy);
  return {
    tong: hopLe.length,
    soDongGoi: hopLe.filter((d) => DA_DONG_GOI.includes(d.trangThai)).length,
    soXuat: hopLe.filter((d) => DA_XUAT.includes(d.trangThai)).length,
  };
}

/**
 * 5 bước tiến trình (TienTrinhChungTu): Tạo phiếu → Phân công → Nhặt hàng → Đóng gói n/N đơn → Xuất kho n/N đơn.
 * Người nhặt ở cột phải nên bước Phân công chỉ ghi "Đã giao"; đang nhặt mà người xem có vùng quét thì tiến độ chỉ ở
 * vùng quét (bước Nhặt hàng không ghi lại).
 */
export function tinhBuoc(phieu, { quyen, dsDon, tienDo }) {
  if (!phieu) return [];
  const tao = { ma: "tao", nhan: "Tạo phiếu", trangThai: "xong", ngay: phieu.ngayTao, coGio: true };
  const daGiao = quyen.daPhanCong ? "Đã giao" : "";
  const chuTienDo = `${formatQuantity(tienDo.da)}/${formatQuantity(tienDo.can)} sản phẩm`;
  const chua = (ma, nhan) => ({ ma, nhan, trangThai: "chua" });

  if (laPhieuChuyenKho(phieu)) return buocNhatChuyenKho(phieu, { quyen, tao, daGiao, chuTienDo });

  if (quyen.daHuy) {
    return [
      tao,
      { ma: "phanCong", nhan: "Phân công", trangThai: quyen.daPhanCong ? "xong" : "chua", phu: daGiao },
      { ma: "nhat", nhan: "Nhặt hàng", trangThai: "dung", phu: "Đã hủy" },
      chua("dongGoi", "Đóng gói"),
      chua("xuat", "Xuất kho"),
    ];
  }

  if (quyen.daXongNhat) {
    const { tong, soDongGoi, soXuat } = demDon(dsDon);
    const dongGoiXong = tong > 0 && soDongGoi >= tong;
    // Mỗi thanh chỉ MỘT bước đang làm (bước sớm nhất chưa xong); bước sau vẫn ghi "n/N đơn" để thấy tiến độ
    let xuat = "chua";
    if (tong > 0 && soXuat >= tong) xuat = "xong";
    else if (dongGoiXong) xuat = "dangLam";
    return [
      tao,
      { ma: "phanCong", nhan: "Phân công", trangThai: "xong", phu: daGiao },
      { ma: "nhat", nhan: "Nhặt hàng", trangThai: "xong", phu: chuTienDo, ngay: phieu.ngayHoanTat, coGio: true },
      {
        ma: "dongGoi",
        nhan: "Đóng gói",
        trangThai: tong === 0 ? "chua" : dongGoiXong ? "xong" : "dangLam",
        phu: tong ? `${soDongGoi}/${tong} đơn` : "",
      },
      { ma: "xuat", nhan: "Xuất kho", trangThai: xuat, phu: tong ? `${soXuat}/${tong} đơn` : "" },
    ];
  }

  return [
    tao,
    quyen.daPhanCong
      ? { ma: "phanCong", nhan: "Phân công", trangThai: "xong", phu: daGiao }
      : { ma: "phanCong", nhan: "Phân công", trangThai: "dangLam", phu: "Chưa có người nhặt" },
    {
      ma: "nhat",
      nhan: "Nhặt hàng",
      trangThai: quyen.daPhanCong ? "dangLam" : "chua",
      phu: quyen.daPhanCong && !quyen.duocQuet ? `${chuTienDo} · ${tienDo.pct}%` : "",
    },
    chua("dongGoi", "Đóng gói"),
    chua("xuat", "Xuất kho"),
  ];
}

/**
 * 4 bước của phiếu nhặt chuyển kho (không có đơn, không đóng gói): Tạo phiếu (khi duyệt phiếu chuyển) → Phân công →
 * Nhặt hàng → Xuất kho (kho xuất bấm Xác nhận xuất ở phiếu chuyển, theo trạng thái phiếu chuyển). Phiếu chuyển hủy khi
 * hàng đang đi: hàng đã xuất nên bước Xuất kho vẫn xong.
 */
function buocNhatChuyenKho(phieu, { quyen, tao, daGiao, chuTienDo }) {
  const phanCong = (trangThai) => ({ ma: "phanCong", nhan: "Phân công", trangThai, phu: daGiao });
  const xuat = (trangThai, phu) => ({ ma: "xuat", nhan: "Xuất kho", trangThai, phu });

  if (quyen.daHuy) {
    return [
      tao,
      phanCong(quyen.daPhanCong ? "xong" : "chua"),
      { ma: "nhat", nhan: "Nhặt hàng", trangThai: "dung", phu: "Đã hủy" },
      xuat("chua"),
    ];
  }
  if (quyen.daXongNhat) {
    let buocXuat = xuat("dangLam", "Chờ xác nhận ở phiếu chuyển");
    if (phieuChuyenHuyKhiDangDi(phieu)) buocXuat = xuat("xong", "Đã xuất · phiếu chuyển đã hủy");
    else if (phieuChuyenDaXuat(phieu)) buocXuat = xuat("xong", "Đã xuất");
    return [
      tao,
      phanCong("xong"),
      { ma: "nhat", nhan: "Nhặt hàng", trangThai: "xong", phu: chuTienDo, ngay: phieu.ngayHoanTat, coGio: true },
      buocXuat,
    ];
  }
  return [
    tao,
    quyen.daPhanCong
      ? phanCong("xong")
      : { ma: "phanCong", nhan: "Phân công", trangThai: "dangLam", phu: "Chưa có người nhặt" },
    {
      ma: "nhat",
      nhan: "Nhặt hàng",
      trangThai: quyen.daPhanCong ? "dangLam" : "chua",
      phu: quyen.daPhanCong && !quyen.duocQuet ? chuTienDo : "",
    },
    xuat("chua"),
  ];
}

/**
 * Câu hộp xác nhận "Hoàn tất nhặt": phiếu bán tạo phiếu xuất nháp cho từng đơn; phiếu chuyển kho giữ lô cho PX-CK, chưa
 * trừ tồn tới khi xác nhận xuất ở phiếu chuyển.
 */
export function moTaHoanTatNhat(phieu) {
  const ma = phieu?.maPickList ?? "";
  if (laPhieuChuyenKho(phieu)) {
    return `Phiếu nhặt hàng ${ma} sẽ chuyển sang Đã nhặt và khóa phân bổ lô. Lô đã nhặt được giữ cho `
      + `${tenPhieuXuat(phieu)}; hàng chỉ rời kho khi bấm Xác nhận xuất ở ${tenPhieuChuyen(phieu)}.`;
  }
  return `Phiếu nhặt hàng ${ma} sẽ chuyển sang Đã nhặt và khóa phân bổ lô. Hệ thống tạo phiếu xuất kho nháp có sẵn lô cho `
    + "từng đơn (đơn đặt sớm nhận lô cũ trước), các đơn chuyển sang Chờ đóng gói.";
}

/**
 * Thông báo nhanh sau khi hoàn tất nhặt: `{ loai: "success" | "warning", tieuDe, moTa }`. Phiếu bán mà mọi đơn đã hủy
 * (máy chủ đặt Đã hủy) thì cảnh báo; phiếu chuyển kho báo đã giữ lô cho PX-CK.
 */
export function thongBaoHoanTatNhat(res, kq) {
  const tieuDe = `Đã hoàn tất nhặt ${res?.maPickList ?? ""}`.trim();
  if (laPhieuChuyenKho(res)) {
    return {
      loai: "success",
      tieuDe,
      moTa: `Đã giữ lô cho ${res.soPhieuXuat ?? "phiếu xuất"}. Bấm Xác nhận xuất ở phiếu chuyển ${res.soPhieuChuyen ?? ""}.`.replace(/\s+\./, "."),
    };
  }
  if (res?.trangThai === "da_huy") {
    return { loai: "warning", tieuDe: "Phiếu nhặt hàng đã hủy vì mọi đơn đã hủy", moTa: "Không tạo phiếu xuất kho nào." };
  }
  const soTao = kq?.daTao?.length ?? 0;
  return { loai: "success", tieuDe, moTa: soTao ? `Đã tạo phiếu xuất kho nháp cho ${soTao} đơn` : undefined };
}

/** Đơn đã qua bước đóng gói (đã xuất một phần / toàn bộ, hoàn thành, bị hoàn trả): bằng chứng chỉ còn để xem lại. */
const DON_SAU_DONG_GOI = [TRANG_THAI_DON.DA_XUAT_MOT_PHAN, TRANG_THAI_DON.DA_XUAT_KHO, TRANG_THAI_DON.HOAN_THANH, TRANG_THAI_DON.BI_HOAN_TRA];

/**
 * Bằng chứng đóng gói của một đơn: Chờ đóng gói / Chờ xuất kho → đủ hay còn thiếu loại nào (đơn từ 1.000.000 đ cần
 * video, nhỏ hơn cần 2 ảnh — máy chủ tính sẵn `yeuCauVideo`); đơn đã qua đóng gói → `chiXem` (mở lại xem, không báo
 * thiếu: danh sách đơn không có số tệp — tệp có thể còn, đã tự xóa sau hạn lưu, hoặc chưa từng có). Không cần hiện: null.
 */
export function nhanBangChung(don) {
  const tt = don?.trangThai;
  if (DON_SAU_DONG_GOI.includes(tt)) {
    return don.daDuBangChung ? { du: true, chiXem: true, nhan: "Đủ bằng chứng" } : { du: false, chiXem: true, nhan: "Xem lại" };
  }
  if (tt !== TRANG_THAI_DON.CHO_DONG_GOI && tt !== TRANG_THAI_DON.DA_DONG_GOI) return null;
  if (don.daDuBangChung) return { du: true, nhan: "Đủ bằng chứng" };
  return { du: false, nhan: don.yeuCauVideo ? `Cần video ${khoangVideoNgan()}` : "Cần 2 ảnh" };
}

/** Kết quả "Hoàn tất nhặt": đơn được tạo phiếu xuất nháp và đơn bị bỏ qua (đã hủy / đã xuất trước đó). */
export function ketQuaHoanTatNhat(res, phieuCu) {
  const tatCa = res?.danhSachMaDonHang ?? phieuCu?.danhSachMaDonHang ?? [];
  const boQua = Array.isArray(res?.donChuaTaoPhieuXuat) ? res.donChuaTaoPhieuXuat : [];
  return { daTao: tatCa.filter((ma) => !boQua.includes(ma)), boQua };
}

/**
 * Hàng cần để vào khay trả kệ (WebSocket ORDER_CANCELLED_IN_PICK_LIST → `hangCanTraKe: [{ sku, tenSanPham, soLuong }]`),
 * thêm màu / kích cỡ lấy từ dòng phiếu cùng SKU.
 */
export function hangTraKe(ds, chiTiet) {
  const dong = Array.isArray(chiTiet) ? chiTiet : [];
  return (Array.isArray(ds) ? ds : []).filter(Boolean).map((muc, i) => {
    const line = dong.find((l) => l?.maSku && l.maSku === muc.sku);
    return {
      khoa: `${muc.sku ?? ""}-${i}`,
      ten: muc.tenSanPham || line?.tenSanPham || muc.sku || "",
      bienThe: [line?.tenMau, line?.tenSize].filter(Boolean).join(" / "),
      sku: muc.sku || "",
      soLuong: toNumber(muc.soLuong),
    };
  });
}

/**
 * Thêm một cảnh báo hủy (WebSocket) vào danh sách đang hiện, không ghi đè cảnh báo của đơn khác: cùng loại và cùng số
 * đơn thì thay bản cũ (sự kiện gửi lại); "caPhieu" chỉ giữ một.
 * `moi`: `{ loai: "donNhat" | "donDongGoi" | "caPhieu", soDonHang?, hangCanTraKe?, message? }`.
 */
export function themCanhBaoHuy(ds, moi) {
  const cu = Array.isArray(ds) ? ds : [];
  if (!moi?.loai) return cu;
  const trung = (c) => c.loai === moi.loai && (moi.loai === "caPhieu" || c.soDonHang === moi.soDonHang);
  return [...cu.filter((c) => !trung(c)), moi];
}

const THU_TU_CANH_BAO = ["caPhieu", "donNhat", "donDongGoi"];

/**
 * Gộp danh sách cảnh báo hủy thành các dòng để hiện (CanhBaoHuy): mỗi loại một dòng, thứ tự cả phiếu → đơn hủy khi
 * đang nhặt → đơn hủy sau khi nhặt xong. Dòng đơn: `soDonHang` nối các số đơn theo thứ tự nhận, `soDon` số đơn,
 * `hangCanTraKe` của mọi đơn (cùng SKU thì cộng số lượng).
 */
export function gopCanhBaoHuy(ds) {
  const cu = Array.isArray(ds) ? ds : [];
  return THU_TU_CANH_BAO.flatMap((loai) => {
    const nhom = cu.filter((c) => c?.loai === loai);
    if (!nhom.length) return [];
    if (loai === "caPhieu") return [nhom[nhom.length - 1]];
    const dsSo = nhom.map((c) => c.soDonHang).filter(Boolean);
    const theoSku = new Map();
    const hang = [];
    nhom.forEach((c) => {
      (Array.isArray(c.hangCanTraKe) ? c.hangCanTraKe : []).filter(Boolean).forEach((muc) => {
        const daCo = muc.sku ? theoSku.get(muc.sku) : null;
        if (daCo) {
          daCo.soLuong = toNumber(daCo.soLuong) + toNumber(muc.soLuong);
          return;
        }
        const ban = { ...muc };
        if (muc.sku) theoSku.set(muc.sku, ban);
        hang.push(ban);
      });
    });
    return [{ loai, soDonHang: dsSo.join(", "), soDon: dsSo.length, hangCanTraKe: hang }];
  });
}
