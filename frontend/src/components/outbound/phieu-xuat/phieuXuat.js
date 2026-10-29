/*
 * Hàm thuần của màn Chi tiết phiếu xuất kho (không React, chạy được bằng `node --test`):
 * nhận diện phiếu bán tại quầy, tách ghi chú (giao vận, mã phiếu chuyển), các bước tiến trình, quyền của nút,
 * ghép lô đã lấy của từng dòng với tên lô, khóa tải lại lô. Gọi song song có giới hạn: chung-tu/chayGioiHan.js.
 * Không import alias "@/…" để chạy được ngoài Vite.
 */
import { PHIEU_XUAT_CHUA_XUAT, TRANG_THAI_PHIEU_XUAT } from "../../../constants/trangThaiXuatBan.js";
import { cauChungTuRong, docSo, soVN } from "../../chung-tu/bangChungTu.js";

export const LOAI_XUAT = Object.freeze({ BAN_HANG: "ban_hang", CHUYEN_KHO: "chuyen_kho" });

/**
 * Phiếu bán tại quầy (POS) ghi ngày tạo và ngày xuất trong cùng một lệnh nên hai mốc gần như trùng nhau
 * (CSDL làm tròn tới giây). Phiếu đi qua nhặt → đóng gói → xuất kho luôn cách nhau nhiều phút.
 */
export const LECH_TAO_XUAT_POS_MS = 2000;

/** Ghi chú backend đặt cho phiếu POS: "Xuất kho POS cho đơn <số đơn>" (PosCheckoutTransaction). */
const DAU_GHI_CHU_POS = /^Xuất kho POS\b/;

/** Thông tin giao vận backend ghép vào ghi chú khi xác nhận xuất kho (PhieuXuatKhoService.xacNhanXuatKho). */
const MAU_GIAO_VAN = /\[Vận chuyển: (.*?) - Vận đơn: (.*?)(?: - Cước: ([^\]]*?))?\]/;

/**
 * Ghi chú của phiếu xuất chuyển kho PX-CK: máy chủ ghi "Phiếu xuất của phiếu chuyển <mã>, lệnh điều động <số>" khi duyệt
 * phiếu chuyển (PhieuChuyenKhoService); phiếu tạo tay trước khi nâng cấp ghi "Xuất thủ công cho phiếu chuyển: <mã>".
 */
const MAU_PHIEU_CHUYEN = /(?:Xuất thủ công cho phiếu chuyển:|Phiếu xuất của phiếu chuyển)\s*([^\s,|]+)(?:,\s*lệnh điều động\s+[^\s,|]+)?/;

/** Lọc nhanh của bảng Sản phẩm xuất: "thieuLo" = dòng chưa lấy đủ số cần xuất (duSoLuong của máy chủ). */
export const BO_LOC_DONG_XUAT = Object.freeze({ tatCa: null, thieuLo: (dong) => !dong.du });

const DA_XUAT = new Set([TRANG_THAI_PHIEU_XUAT.DA_XUAT, 5]);

function thoiDiem(value) {
  if (value == null || value === "") return null;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Chuỗi trống hoặc "N/A" (backend ghi khi thiếu đơn vị vận chuyển / mã vận đơn) → null. */
function giaTriHoacNull(value) {
  const chu = String(value ?? "").trim();
  return !chu || /^n\/a$/i.test(chu) ? null : chu;
}

/** Phiếu đã xuất kho (3; 5 là mã cũ cùng nghĩa). */
export const laDaXuat = (phieu) => DA_XUAT.has(Number(phieu?.trangThai));

/**
 * Phiếu bán tại quầy (POS): tạo thẳng ở Đã xuất, không qua nhặt / đóng gói nên không có tiến trình.
 * API chi tiết không trả dữ liệu đóng gói, nên nhận diện bằng hai dấu hiệu chỉ phiếu POS có:
 * phiếu bán hàng ở Đã xuất và (ghi chú bắt đầu "Xuất kho POS" hoặc ngày tạo ≈ ngày xuất, lệch ≤ LECH_TAO_XUAT_POS_MS).
 * Không chắc thì coi là phiếu bán hàng thường (vẫn hiện tiến trình).
 */
export function laPhieuPos(phieu) {
  if (!phieu || phieu.loaiXuat !== LOAI_XUAT.BAN_HANG || !laDaXuat(phieu)) return false;
  if (DAU_GHI_CHU_POS.test(String(phieu.ghiChu ?? "").trim())) return true;
  const tao = thoiDiem(phieu.ngayTao);
  const xuat = thoiDiem(phieu.ngayXuat);
  return tao != null && xuat != null && Math.abs(xuat - tao) <= LECH_TAO_XUAT_POS_MS;
}

/** Bỏ phần khớp `khop` khỏi `chu`, dọn dấu nối " | " phía trước và dấu nối `noiSau` phía sau; hai phần còn lại xuống dòng. */
function boDoan(chu, khop, noiSau) {
  const truoc = chu.slice(0, khop.index).replace(/\s*\|\s*$/, "").trim();
  const sau = chu.slice(khop.index + khop[0].length).replace(noiSau, "").trim();
  return [truoc, sau].filter(Boolean).join("\n");
}

/**
 * Tách ghi chú phiếu xuất (backend chỉ lưu dạng chữ):
 * - `giaoVan`: `{ donViVanChuyen, maVanDon, cuoc }` từ "[Vận chuyển: … - Vận đơn: … - Cước: …]" ("N/A" → null);
 *   null khi không có hoặc mọi trường đều trống.
 * - `maPhieuChuyen`: mã phiếu chuyển kho từ "Phiếu xuất của phiếu chuyển …" (hoặc "Xuất thủ công cho phiếu chuyển: …").
 * - `ghiChu`: phần còn lại (mỗi đoạn một dòng), null khi không còn gì. Không tách được gì thì giữ NGUYÊN ghi chú.
 */
export function tachGhiChuPhieuXuat(ghiChu) {
  const goc = String(ghiChu ?? "").trim();
  const kq = { giaoVan: null, maPhieuChuyen: null, ghiChu: goc || null };
  if (!goc) return kq;

  let conLai = goc;
  let daTach = false;

  const gv = MAU_GIAO_VAN.exec(conLai);
  if (gv) {
    const donViVanChuyen = giaTriHoacNull(gv[1]);
    const maVanDon = giaTriHoacNull(gv[2]);
    const cuocChu = giaTriHoacNull(gv[3]);
    const cuoc = cuocChu != null && Number.isFinite(Number(cuocChu)) ? Number(cuocChu) : null;
    if (donViVanChuyen || maVanDon || cuoc != null) kq.giaoVan = { donViVanChuyen, maVanDon, cuoc };
    // Ghi chú bàn giao nối sau dấu " - "
    conLai = boDoan(conLai, gv, /^\s*-\s*/);
    daTach = true;
  }

  const pc = MAU_PHIEU_CHUYEN.exec(conLai);
  if (pc) {
    kq.maPhieuChuyen = pc[1];
    conLai = boDoan(conLai, pc, /^\s*\|\s*/);
    daTach = true;
  }

  kq.ghiChu = daTach ? conLai || null : goc;
  return kq;
}

/**
 * Các bước tiến trình (TienTrinhChungTu) — 3 bước, mốc giờ lấy từ ngayTao / ngayXuat:
 * - Bán hàng: Nhặt hàng (phiếu sinh khi nhặt xong) → Đóng gói → Xuất kho.
 * - Chuyển kho (PX-CK, máy chủ tạo khi duyệt phiếu chuyển): Tạo phiếu → Chọn lô (`soDongDuLo`/`soDong` dòng đủ lô) →
 *   Xác nhận xuất (làm ở màn phiếu chuyển kho, kèm người vận chuyển và giấy đi đường).
 * - Đã hủy: bước cuối chưa làm thành "Đã hủy". Backend không lưu phiếu bán hàng bị hủy trước hay sau đóng gói,
 *   nên bước Đóng gói để xám (không khẳng định) và "Đã hủy" đứng ở bước Xuất kho.
 * - Phiếu POS (`laPos`), loại xuất khác hai loại trên và mã trạng thái lạ: không có tiến trình (mảng rỗng).
 */
export function tinhBuocPhieuXuat({ phieu, laPos = false, soDong = 0, soDongDuLo = 0 } = {}) {
  if (!phieu || laPos) return [];
  const tt = Number(phieu.trangThai);
  const daXuat = laDaXuat(phieu);

  if (phieu.loaiXuat === LOAI_XUAT.CHUYEN_KHO) {
    const tao = { ma: "tao", nhan: "Tạo phiếu", trangThai: "xong", ngay: phieu.ngayTao, coGio: true };
    const phuLo = `${soVN(soDongDuLo)}/${soVN(soDong)} dòng đủ lô`;
    const duLo = soDong > 0 && soDongDuLo >= soDong;
    const chua = { ma: "xuat", nhan: "Xác nhận xuất", trangThai: "chua" };
    if (tt === TRANG_THAI_PHIEU_XUAT.NHAP) {
      return duLo
        ? [
          tao,
          { ma: "chonLo", nhan: "Chọn lô", trangThai: "xong", phu: phuLo },
          { ma: "xuat", nhan: "Xác nhận xuất", trangThai: "dangLam", phu: "Ở phiếu chuyển kho" },
        ]
        : [tao, { ma: "chonLo", nhan: "Chọn lô", trangThai: "dangLam", phu: phuLo }, chua];
    }
    if (daXuat) {
      return [
        tao,
        { ma: "chonLo", nhan: "Chọn lô", trangThai: "xong", phu: phuLo },
        { ma: "xuat", nhan: "Xác nhận xuất", trangThai: "xong", ngay: phieu.ngayXuat, coGio: true },
      ];
    }
    if (tt === TRANG_THAI_PHIEU_XUAT.DA_HUY) {
      return [tao, { ma: "huy", nhan: "Đã hủy", trangThai: "dung", phu: "Trước khi xuất" }, chua];
    }
    return [];
  }

  // Loại khác (vd. dòng phiếu chuyển cũ "khac" còn trong phieu_xuat_kho trước khi dọn): không đoán tiến trình
  if (phieu.loaiXuat !== LOAI_XUAT.BAN_HANG) return [];
  const nhat = { ma: "nhat", nhan: "Nhặt hàng", trangThai: "xong", ngay: phieu.ngayTao, coGio: true };
  if (tt === TRANG_THAI_PHIEU_XUAT.NHAP) {
    return [
      nhat,
      { ma: "dongGoi", nhan: "Đóng gói", trangThai: "dangLam", phu: "Chờ đóng gói" },
      { ma: "xuat", nhan: "Xuất kho", trangThai: "chua" },
    ];
  }
  if (tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT) {
    return [
      nhat,
      { ma: "dongGoi", nhan: "Đóng gói", trangThai: "xong" },
      { ma: "xuat", nhan: "Xuất kho", trangThai: "dangLam", phu: "Chờ xác nhận" },
    ];
  }
  if (daXuat) {
    return [
      nhat,
      { ma: "dongGoi", nhan: "Đóng gói", trangThai: "xong" },
      { ma: "xuat", nhan: "Xuất kho", trangThai: "xong", ngay: phieu.ngayXuat, coGio: true },
    ];
  }
  if (tt === TRANG_THAI_PHIEU_XUAT.DA_HUY) {
    return [
      nhat,
      { ma: "dongGoi", nhan: "Đóng gói", trangThai: "chua" },
      { ma: "huy", nhan: "Đã hủy", trangThai: "dung", phu: "Trước khi xuất kho" },
    ];
  }
  return [];
}

/**
 * Phiếu nhặt của PX-CK (máy chủ gửi `phieuNhatId`, `maPhieuNhat`, `trangThaiPhieuNhat` ở chi tiết phiếu xuất): lô do
 * phiếu nhặt ghi khi hoàn tất nhặt, không chọn tay. Phiếu nhặt đã hủy, phiếu bán, phiếu cũ (chọn lô tay) → null.
 * @returns {{ id, ma: string | null, trangThai } | null}
 */
export function phieuNhatCuaPhieuXuat(phieu) {
  if (phieu?.loaiXuat !== LOAI_XUAT.CHUYEN_KHO || phieu.phieuNhatId == null) return null;
  if (phieu.trangThaiPhieuNhat === "da_huy") return null;
  return { id: phieu.phieuNhatId, ma: phieu.maPhieuNhat || null, trangThai: phieu.trangThaiPhieuNhat ?? null };
}

/**
 * Nút của phiếu theo loại, trạng thái và vai trò (khớp backend):
 * - `coHuy`: quản trị viên / quản lý kho, phiếu bán hàng chưa xuất, chưa hủy (PUT /phieu-xuat-kho/{id}/cancel). Phiếu
 *   xuất chuyển kho không hủy riêng: hủy phiếu chuyển thì máy chủ hủy theo (máy chủ chặn hủy ở đây).
 * - `suaLo` + `nhanNutLo`: chuyển kho chọn lô khi Nháp (mọi vai trò kho) — trừ khi có phiếu nhặt (`phieuNhat`, máy chủ
 *   từ chối chọn lô tay); bán hàng chỉ quản lý sửa lô khi Nháp / Chờ xuất.
 * - `nutChinh`: "dongGoi" (bán hàng Nháp, có đơn) | "xuatKho" (bán hàng Chờ xuất) | "phieuChuyen" (chuyển kho Nháp: mở
 *   phiếu chuyển để xác nhận xuất) | null.
 * - `phieuNhat`: phiếu nhặt của PX-CK (phieuNhatCuaPhieuXuat) hoặc null.
 * - `coIn`: mọi trạng thái trừ Đã hủy.
 */
export function quyenPhieuXuat({ phieu, laQuanLy = false, laPos = false } = {}) {
  const tt = Number(phieu?.trangThai);
  const laCk = phieu?.loaiXuat === LOAI_XUAT.CHUYEN_KHO;
  const chuaXuat = tt === TRANG_THAI_PHIEU_XUAT.NHAP || tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT;
  const phieuNhat = phieuNhatCuaPhieuXuat(phieu);
  let nutChinh = null;
  if (laCk) {
    if (tt === TRANG_THAI_PHIEU_XUAT.NHAP) nutChinh = "phieuChuyen";
  } else if (tt === TRANG_THAI_PHIEU_XUAT.NHAP) {
    if (phieu?.donBanHang?.id) nutChinh = "dongGoi";
  } else if (tt === TRANG_THAI_PHIEU_XUAT.CHO_XUAT) {
    nutChinh = "xuatKho";
  }
  return {
    coHuy: Boolean(laQuanLy) && !laPos && !laCk && PHIEU_XUAT_CHUA_XUAT.includes(tt),
    suaLo: laCk ? tt === TRANG_THAI_PHIEU_XUAT.NHAP && !phieuNhat : Boolean(laQuanLy) && chuaXuat,
    nhanNutLo: laCk ? "Chọn lô" : "Sửa lô",
    nutChinh,
    phieuNhat,
    coIn: tt !== TRANG_THAI_PHIEU_XUAT.DA_HUY,
  };
}

/** Lý do khóa nút xuất / vận chuyển, null khi được bấm. */
export function lyDoKhoaXuat({ laCk = false, soDong = 0, soThieu = 0 } = {}) {
  if (!soDong) return cauChungTuRong("phiếu xuất kho", { dauCham: false });
  if (soThieu > 0) return laCk ? `Còn ${soVN(soThieu)} dòng chưa chọn đủ lô` : `Còn ${soVN(soThieu)} dòng chưa đủ lô`;
  return null;
}

/**
 * Câu của dòng thông báo thiếu lô (phiếu chưa xuất còn dòng chưa đủ lô). PX-CK có phiếu nhặt (`phieuNhat`): lô do phiếu
 * nhặt ghi, nên nhắc nhặt theo phiếu nhặt thay vì chọn lô (nơi gọi kèm liên kết mở phiếu nhặt).
 */
export function cauThieuLo({ laCk = false, laQuanLy = false, soThieu = 0, phieuNhat = null } = {}) {
  const n = soVN(soThieu);
  if (laCk && phieuNhat) {
    return `Còn ${n} dòng chưa đủ lô. Nhặt hàng theo phiếu nhặt${phieuNhat.ma ? ` ${phieuNhat.ma}` : ""}; hoàn tất nhặt thì lô tự ghi vào phiếu này.`;
  }
  if (laCk) return `Còn ${n} dòng chưa chọn đủ lô. Chọn lô xong mới xác nhận xuất ở phiếu chuyển kho được.`;
  return laQuanLy
    ? `Còn ${n} dòng chưa đủ lô nên chưa xuất kho được. Bấm Sửa lô ở dòng thiếu để chọn lô còn hàng.`
    : `Còn ${n} dòng chưa đủ lô nên chưa xuất kho được. Báo quản lý kho sửa lô cho các dòng thiếu.`;
}

/**
 * Lô đã lấy của một dòng (GET …/picked-lots/{ctId} → `[{ loHangId, soLuongDaPick }]`) ghép tên lô
 * (GET …/available-lots → `[{ loHangId, maLo }]`), như trang in. Thiếu tên thì "#id" (như trang in); bỏ dòng số lượng 0.
 * @returns {{ loHangId, maLo: string, soLuong: number }[]}
 */
export function ghepLoDong(daLay, dsLo) {
  const ten = new Map(
    (Array.isArray(dsLo) ? dsLo : [])
      .filter((l) => l?.loHangId != null && l.maLo)
      .map((l) => [String(l.loHangId), String(l.maLo)]),
  );
  return (Array.isArray(daLay) ? daLay : [])
    .filter((p) => p && p.loHangId != null && docSo(p.soLuongDaPick) > 0)
    .map((p) => ({
      loHangId: p.loHangId,
      maLo: ten.get(String(p.loHangId)) || `#${p.loHangId}`,
      soLuong: docSo(p.soLuongDaPick),
    }));
}

/**
 * Khóa tải lại lô của các dòng: chỉ đổi khi phiếu, trạng thái hay số đã lấy của một dòng đổi. Tải lại ngầm (quay lại tab)
 * mà phiếu không đổi thì không gọi lại 1–2 lời gọi cho mỗi dòng. Mỗi dòng ghi "ctId:bienTheId:soLuongDaPick".
 */
export function khoaTaiLo(phieuId, trangThai, chiTiet) {
  if (phieuId == null || !Array.isArray(chiTiet) || chiTiet.length === 0) return "";
  const dong = chiTiet.map((ct) => `${ct.id}:${ct.bienTheSanPhamId ?? ""}:${docSo(ct.soLuongDaPick)}`).join(",");
  return `${phieuId}|${trangThai ?? ""}|${dong}`;
}

/** Ngược của khoaTaiLo: `{ phieuId, dong: [{ id, bienTheSanPhamId }] }` (id giữ dạng số khi là số). */
export function docKhoaTaiLo(khoa) {
  if (!khoa) return { phieuId: null, dong: [] };
  const [phieuId, , dsDong = ""] = String(khoa).split("|");
  const so = (x) => (x !== "" && Number.isFinite(Number(x)) ? Number(x) : x || null);
  return {
    phieuId: so(phieuId),
    dong: dsDong
      .split(",")
      .filter(Boolean)
      .map((muc) => {
        const [id, bienThe] = muc.split(":");
        return { id: so(id), bienTheSanPhamId: so(bienThe) };
      }),
  };
}
