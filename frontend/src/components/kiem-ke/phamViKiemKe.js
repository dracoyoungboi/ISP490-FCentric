// Hàm thuần cho màn Tạo / sửa đợt kiểm kê (StockTakeCreate): phân loại kệ, lần kiểm gần nhất của khu, việc còn thiếu
// trước khi bắt đầu, câu mô tả phạm vi đang chọn.
import { TT_DOT } from "./kiemKe.js";

/** Lý do hay dùng: bấm để điền vào ô Lý do kiểm kê (vẫn sửa được). */
export const LY_DO_NHANH = Object.freeze(["Kiểm kê định kỳ", "Lệch tồn với kênh bán", "Sau đợt nhập hàng lớn", "Nghi thất thoát"]);

/** Câu nhắc gỡ vướng mắc: dùng chung cho lý do cạnh nút Bắt đầu và danh sách việc ở cột phải. */
export const GO_VUONG_MAC = "Gỡ các vướng mắc ở phần Xem trước";

/**
 * Thêm / gỡ một lý do nhanh trong ô Lý do kiểm kê: chưa có thì nối thêm ("; " khi ô đã có chữ), đã có thì gỡ ra
 * (kể cả khi nằm giữa câu tự gõ) rồi dọn dấu "; " thừa.
 */
export function batTatLyDo(cu, chu, toiDa = Infinity) {
  const hienTai = String(cu ?? "");
  if (hienTai.includes(chu)) {
    return hienTai
      .split(chu)
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s*;\s*(?:;\s*)+/g, "; ")
      .replace(/^[\s;]+|[\s;]+$/g, "");
  }
  const t = hienTai.trim();
  return (t ? `${t}; ${chu}` : chu).slice(0, toiDa);
}

/** Khu vực tick được: bỏ nhóm "Khác" mà máy chủ trả cho kệ chưa thuộc khu nào (id null hoặc 0). */
export const laKhuThat = (kv) => kv?.id != null && Number(kv.id) !== 0;

/** Các đợt khác (không phải đợt đang sửa) đang giữ kệ. */
export function dotKhacGiuKe(k, dotDangSuaId) {
  if (!k?.khoa) return [];
  return (k.dot ?? []).filter((d) => d && d.id !== dotDangSuaId);
}

/**
 * Loại kệ để tô dải kệ thu nhỏ và chip kệ: "bao_tri" | "ban" (đợt khác đang giữ) | "co_hang" | "trong".
 * Cùng thứ tự ưu tiên với lý do không chọn được của màn (bảo trì trước, rồi đợt khác).
 */
export function loaiKe(k, dotDangSuaId) {
  if (k?.trangThai === "BAO_TRI") return "bao_tri";
  if (dotKhacGiuKe(k, dotDangSuaId).length) return "ban";
  return Number(k?.dangChua) > 0 ? "co_hang" : "trong";
}

/**
 * "đợt 1105-001" (+n khi nhiều đợt cùng giữ) — ghi ngay trên chip kệ bận. Mã đợt dạng KK-yyyyMMdd-001 đếm lại mỗi ngày,
 * nên giữ cả ngày tháng + số thứ tự (8 ký tự cuối), 3 số cuối không phân biệt được đợt của các ngày khác nhau.
 */
export function nhanDotGiu(ds) {
  if (!ds?.length) return "";
  const ma = String(ds[0].ma ?? ds[0].id ?? "");
  const duoi = ma.length > 8 ? ma.slice(-8) : ma;
  return `đợt ${duoi}${ds.length > 1 ? ` +${ds.length - 1}` : ""}`;
}

/**
 * Lần kiểm gần nhất của từng khu (Map id khu → Date), tính từ các đợt ĐÃ DUYỆT của cùng kho: đợt theo khu vực tính cho
 * các khu của đợt, đợt toàn bộ kho tính cho mọi khu (`khuIds`). Đợt theo kệ / danh mục không tính (không phủ hết khu).
 */
export function kiemGanNhatTheoKhu(dsDot, khoId, khuIds = []) {
  const kq = new Map();
  const ghi = (id, luc) => {
    const cu = kq.get(id);
    if (!cu || luc > cu) kq.set(id, luc);
  };
  for (const d of Array.isArray(dsDot) ? dsDot : []) {
    if (Number(d?.trangThai) !== TT_DOT.DA_DUYET || Number(d?.kho?.id) !== Number(khoId) || !d.ngayDuyet) continue;
    const luc = new Date(d.ngayDuyet);
    if (Number.isNaN(luc.getTime())) continue;
    if (d.loaiKiemKe === "theo_khu_vuc") {
      (d.khuVuc ?? []).forEach((kv) => {
        if (laKhuThat(kv)) ghi(Number(kv.id), luc);
      });
    } else if (d.loaiKiemKe === "toan_bo") {
      khuIds.forEach((id) => ghi(Number(id), luc));
    }
  }
  return kq;
}

/**
 * Lần kiểm gần nhất (ngày duyệt) theo danh mục: `Map(danhMucId → Date)`. Đợt theo danh mục tính cho mọi danh mục đã chốt
 * (`danhMucChot`: danh mục đã chọn + mọi danh mục con lúc bắt đầu); đợt toàn kho tính cho mọi danh mục (`tatCaIds`).
 */
export function kiemGanNhatTheoDanhMuc(dsDot, khoId, tatCaIds = []) {
  const kq = new Map();
  const ghi = (id, luc) => {
    const cu = kq.get(id);
    if (!cu || luc > cu) kq.set(id, luc);
  };
  for (const d of Array.isArray(dsDot) ? dsDot : []) {
    if (Number(d?.trangThai) !== TT_DOT.DA_DUYET || Number(d?.kho?.id) !== Number(khoId) || !d.ngayDuyet) continue;
    const luc = new Date(d.ngayDuyet);
    if (Number.isNaN(luc.getTime())) continue;
    if (d.loaiKiemKe === "theo_danh_muc") {
      const ds = d.danhMucChot?.length ? d.danhMucChot : d.danhMuc ? [d.danhMuc] : [];
      ds.forEach((dm) => dm?.id != null && ghi(Number(dm.id), luc));
    } else if (d.loaiKiemKe === "toan_bo") {
      tatCaIds.forEach((id) => ghi(Number(id), luc));
    }
  }
  return kq;
}

/** dd/MM (khác năm nay thì dd/MM/yy để không nhầm lần kiểm năm trước là gần đây). */
export function ngayNgan(luc) {
  if (!(luc instanceof Date) || Number.isNaN(luc.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  const ngay = `${p(luc.getDate())}/${p(luc.getMonth() + 1)}`;
  return luc.getFullYear() === new Date().getFullYear() ? ngay : `${ngay}/${p(luc.getFullYear() % 100)}`;
}

/**
 * Danh sách việc trước khi bắt đầu (cột phải), cùng điều kiện với lý do khóa nút Bắt đầu của màn:
 * `[{ ma, xong, dang, chu }]` — `dang`: đang tính (hiện vòng quay thay cho ô tròn).
 * Chưa có kho chỉ xảy ra khi đang tải, tải lỗi (`loiKho`) hoặc người dùng không có kho nào (có kho thì màn tự chọn kho
 * đầu), nên câu khớp lý do cạnh nút thay vì "Chọn kho".
 */
export function viecTruocBatDau({ khoId, dangTaiKho, loiKho = false, thieuPhamVi, tenGui, lyDo, dangXem, loiXem, kqXem }) {
  const viec = [];
  if (khoId == null) {
    viec.push({
      ma: "kho",
      xong: false,
      dang: dangTaiKho,
      chu: dangTaiKho ? "Đang tải danh sách kho…" : loiKho ? "Chưa tải được danh sách kho" : "Chưa có kho để kiểm kê",
    });
  }
  viec.push({ ma: "pham-vi", xong: !thieuPhamVi, chu: thieuPhamVi || "Đã chọn phạm vi" });
  if (!tenGui) viec.push({ ma: "ten", xong: false, chu: "Nhập tên đợt" });
  const coLyDo = Boolean(String(lyDo ?? "").trim());
  viec.push({ ma: "ly-do", xong: coLyDo, chu: coLyDo ? "Đã có lý do kiểm kê" : "Nhập lý do kiểm kê" });
  const soVanDe = Array.isArray(kqXem?.vanDe) ? kqXem.vanDe.length : 0;
  const vuong =
    khoId == null || thieuPhamVi
      ? { xong: false, chu: "Kiểm tra vướng mắc (sau khi chọn phạm vi)" }
      : dangXem
        ? { xong: false, dang: true, chu: "Đang kiểm tra vướng mắc…" }
        : loiXem
          ? { xong: false, chu: "Chưa xem trước được phạm vi" }
          : kqXem?.coTheBatDau
            ? { xong: true, chu: "Không vướng mắc" }
            : { xong: false, chu: `${GO_VUONG_MAC}${soVanDe ? ` (${soVanDe})` : ""}` };
  viec.push({ ma: "vuong-mac", ...vuong });
  return viec;
}

const gon = (ds, toiDa = 3) => {
  const ten = (ds ?? []).filter(Boolean);
  if (!ten.length) return "";
  return ten.length <= toiDa ? ten.join(", ") : `${ten.slice(0, toiDa).join(", ")} +${ten.length - toiDa}`;
};

/** Phạm vi đang chọn trên biểu mẫu thành một cụm: "Khu A, Khu B" · "3 kệ (A-01, A-02, B-07)" · "danh mục Áo (kể cả danh mục con)". */
export function moTaPhamViChon({ loai, tenKho, tenKhu = [], maKe = [], tenDanhMuc, coDanhMucCon = false }) {
  if (loai === "theo_khu_vuc") return tenKhu.length ? gon(tenKhu) : "chưa chọn khu vực";
  if (loai === "theo_ke") return maKe.length ? `${maKe.length} kệ (${gon(maKe)})` : "chưa chọn kệ";
  if (loai === "theo_danh_muc") return tenDanhMuc ? `danh mục ${tenDanhMuc}${coDanhMucCon ? " (kể cả danh mục con)" : ""}` : "chưa chọn danh mục";
  return `toàn bộ ${tenKho || "kho"}`;
}
