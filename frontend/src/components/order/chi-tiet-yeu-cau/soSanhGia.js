/*
 * Hàm thuần cho bảng So sánh báo giá (màn Chi tiết yêu cầu báo giá): nhà cung cấp × biến thể.
 * Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Nguồn giá: cùng response GET /api/v1/yeu-cau-mua-hang/get-by-id/{id} → `donMuaHangs[].chiTietDonMuaHangs[]`
 * (YeuCauMuaHangDto.donMuaHangs là List<DonMuaHangDto>; MapStruct tự sinh ánh xạ cùng tên trường nên có đủ
 * `bienTheSanPham`, `soLuongDat`, `donGia`, `thanhTien` của từng dòng).
 * Dòng báo giá ghép với dòng yêu cầu theo `bienTheSanPham.id` (backend chép dòng yêu cầu sang báo giá khi gửi);
 * yêu cầu có hai dòng cùng biến thể thì ghép lần lượt theo thứ tự.
 *
 * Quy tắc "thấp nhất": chỉ so khi có từ hai nhà cung cấp đã có giá; nhà cung cấp còn thiếu giá dòng nào trong
 * nhóm (sản phẩm hoặc cả yêu cầu) thì không đem so tổng của nhóm đó.
 */
import { docSo } from "../../chung-tu/bangChungTu.js";
import {
  coGiaDong,
  daCoBaoGia,
  ghiChuNhaCungCap,
  laDaChot,
  ngayGuiYeuCau,
  nguoiChotBaoGia,
  thanhTienDong,
} from "../chi-tiet-bao-gia/tinhBaoGia.js";
import { baoGiaHieuLuc, dongYeuCau } from "./tinhYeuCau.js";

/**
 * Dựng dữ liệu so sánh.
 * @returns `{ ncc, dong }`
 *   - `ncc[i]`: báo giá còn hiệu lực `{ id, soDonMua, nhaCungCap, trangThai, chot, ngayGui, ngayBaoGia, ghiChu,
 *     nguoiChot, don }` (giữ thứ tự của máy chủ); `ngayGui`: lúc email yêu cầu gửi được, dữ liệu cũ thì ngày tạo đơn
 *     (tinhBaoGia.ngayGuiYeuCau), `ghiChu`: ghi chú nhà cung cấp gửi kèm báo giá (đặc tả 6.3),
 *     `nguoiChot`: tinhBaoGia.nguoiChotBaoGia (null: ẩn)
 *   - `dong[j]`: dòng yêu cầu (dongYeuCau) kèm `gia[i]` = `{ donGia, thanhTien }` của nhà cung cấp i, `null` nếu nhà
 *     cung cấp chưa gửi báo giá (`ngayBaoGia` trống) hoặc dòng chưa có giá
 */
export function dungSoSanhGia(yc) {
  const ds = baoGiaHieuLuc(yc);
  const hangCho = ds.map((don) => {
    const theoBienThe = new Map();
    // "Đã báo giá" ⇔ có ngayBaoGia: báo giá chưa gửi thì không lấy giá dòng nào
    const cacDong = daCoBaoGia(don) && Array.isArray(don.chiTietDonMuaHangs) ? don.chiTietDonMuaHangs : [];
    for (const ct of cacDong) {
      const khoa = ct?.bienTheSanPham?.id;
      if (khoa == null) continue;
      if (!theoBienThe.has(khoa)) theoBienThe.set(khoa, []);
      theoBienThe.get(khoa).push(ct);
    }
    return theoBienThe;
  });

  const dong = dongYeuCau(yc).map((d) => ({
    ...d,
    gia: hangCho.map((theoBienThe) => {
      const ct = d.bienTheId != null ? theoBienThe.get(d.bienTheId)?.shift() : undefined;
      return ct && coGiaDong(ct) ? { donGia: docSo(ct.donGia), thanhTien: thanhTienDong(ct) } : null;
    }),
  }));

  const ncc = ds.map((don) => ({
    id: don.id,
    soDonMua: don.soDonMua || "",
    nhaCungCap: don.nhaCungCap ?? null,
    trangThai: docSo(don.trangThai),
    chot: laDaChot(don.trangThai),
    ngayGui: ngayGuiYeuCau(don),
    ngayBaoGia: don.ngayBaoGia ?? null,
    ghiChu: ghiChuNhaCungCap(don),
    // Báo giá trong `donMuaHangs` của yêu cầu luôn có yêu cầu gốc là chính yêu cầu này
    nguoiChot: nguoiChotBaoGia(don, { coYeuCauGoc: true }),
    don,
  }));

  return { ncc, dong };
}

/**
 * Ô giá của một dòng theo từng nhà cung cấp.
 * @returns `[{ co, donGia, thanhTien, thapNhat }]` — `thapNhat`: đơn giá thấp nhất trong các nhà cung cấp đã có giá
 *   (chỉ khi có từ hai nhà cung cấp có giá; bằng nhau thì cùng thấp nhất)
 */
export function soSanhDong(gia) {
  const ds = Array.isArray(gia) ? gia : [];
  const coGia = ds.filter((g) => g && g.donGia > 0).map((g) => g.donGia);
  const thap = coGia.length > 1 ? Math.min(...coGia) : null;
  return ds.map((g) => {
    const co = Boolean(g && g.donGia > 0);
    return {
      co,
      donGia: co ? g.donGia : 0,
      thanhTien: co ? g.thanhTien : 0,
      thapNhat: co && thap !== null && g.donGia === thap,
    };
  });
}

/**
 * Tổng tiền theo từng nhà cung cấp trên một nhóm dòng (một sản phẩm, hoặc mọi dòng của yêu cầu).
 * @returns `[{ tong, thieu, soDong, du, khongCo, thapNhat }]`
 *   - `thieu`: số dòng nhà cung cấp chưa có giá · `du`: có dòng và không thiếu dòng nào
 *   - `khongCo`: nhóm rỗng hoặc nhà cung cấp chưa có giá dòng nào
 *   - `thapNhat`: tổng thấp nhất trong các nhà cung cấp đủ giá (từ hai nhà cung cấp đủ giá trở lên)
 */
export function soSanhTong(dongs, soNcc) {
  const ds = Array.isArray(dongs) ? dongs : [];
  const n = Math.max(0, Math.floor(docSo(soNcc)));
  const kq = Array.from({ length: n }, (_, i) => {
    let tong = 0;
    let thieu = 0;
    for (const d of ds) {
      const g = d?.gia?.[i];
      if (g && g.donGia > 0) tong += docSo(g.thanhTien);
      else thieu += 1;
    }
    return { tong, thieu, soDong: ds.length, du: ds.length > 0 && thieu === 0, khongCo: ds.length === 0 || thieu === ds.length };
  });
  const du = kq.filter((x) => x.du).map((x) => x.tong);
  const thap = du.length > 1 ? Math.min(...du) : null;
  return kq.map((x) => ({ ...x, thapNhat: x.du && thap !== null && x.tong === thap }));
}

/**
 * Đếm trên cả yêu cầu: nhà cung cấp đã gửi giá (ít nhất một dòng) và nhà cung cấp đã gửi nhưng còn thiếu dòng.
 * @returns `{ daGui, thieuDong }`
 */
export function demGuiGia(dongs, soNcc) {
  const tong = soSanhTong(dongs, soNcc);
  return {
    daGui: tong.filter((x) => !x.khongCo).length,
    thieuDong: tong.filter((x) => !x.khongCo && x.thieu > 0).length,
  };
}
