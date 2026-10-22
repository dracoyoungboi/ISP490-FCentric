/*
 * Bản đếm tạm của màn kiểm kê, lưu trên máy (localStorage) — Q3 cách 1, chốt 21/10/2026. Máy chủ chưa có API lưu số đếm
 * dở: số chỉ gửi khi bấm Hoàn thành, nên tải lại trang / mất mạng không được mất số đã đếm.
 *
 * - Khóa `kiemKe:{dotId}:{nguoiDungId}`: mỗi tài khoản một bản trên máy (máy dùng chung không lẫn số của người khác).
 * - Giá trị `{ maDotKiemKe, ngayTao, capNhat, dong: [{ chiTietId, loHangId, so, luc, lucHien }] }` (`luc`: giờ dùng so với
 *   lịch sử giao dịch; `lucHien`: giờ đếm thật trên máy, để in ra tệp CSV): kèm mã + ngày tạo đợt để không
 *   nạp nhầm bản của một đợt khác trùng id (dữ liệu đã làm lại); khi khôi phục chỉ nhận dòng còn khớp chi tiết hiện tại.
 * - Đếm mù nhớ theo tài khoản: khóa `kiemKe:demMu:{nguoiDungId}`.
 * Mọi lần đọc / ghi bọc try/catch (chế độ ẩn danh, bị chặn lưu, đầy bộ nhớ): lỗi thì trả kết quả "không lưu được", màn vẫn
 * chạy. `kho` là đối tượng kiểu Storage (truyền vào để test bằng node).
 */

const MAU_KHOA = /^kiemKe:(\d+):(\d+)$/;

export const khoaBanTam = (dotId, nguoiDungId) => `kiemKe:${dotId}:${nguoiDungId}`;
export const khoaDemMu = (nguoiDungId) => `kiemKe:demMu:${nguoiDungId}`;

/** localStorage của trình duyệt, hoặc null khi không truy cập được. */
export function layKhoLuu() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Trình duyệt có cho ghi không (Safari ẩn danh đọc được nhưng ghi báo lỗi): thử ghi rồi xóa một khóa tạm. */
export function thuLuu(kho) {
  if (!kho) return false;
  try {
    kho.setItem("kiemKe:thu", "1");
    kho.removeItem("kiemKe:thu");
    return true;
  } catch {
    return false;
  }
}

function docJson(kho, khoa) {
  const chu = kho.getItem(khoa);
  if (!chu) return null;
  const gt = JSON.parse(chu);
  return gt && typeof gt === "object" ? gt : null;
}

/** Đọc bản tạm. `{ banTam, loi }`: loi = true khi trình duyệt chặn đọc. Bản hỏng (JSON sai) coi như không có. */
export function docBanTam(kho, dotId, nguoiDungId) {
  if (!kho || dotId == null || nguoiDungId == null) return { banTam: null, loi: !kho };
  try {
    return { banTam: docJson(kho, khoaBanTam(dotId, nguoiDungId)), loi: false };
  } catch (error) {
    // JSON hỏng: không phải lỗi chặn lưu
    return { banTam: null, loi: !(error instanceof SyntaxError) };
  }
}

/**
 * Ghi số đếm hiện tại (`soDem` = { [chiTietId]: { so, luc } }) cho `dot`; không còn số nào thì xóa bản. `dong`: dòng của
 * đợt (để ghi kèm loHangId). Trả true khi lưu được.
 */
export function ghiBanTam(kho, { dot, nguoiDungId, soDem, dong, bayGio = Date.now() }) {
  if (!kho || dot?.id == null || nguoiDungId == null) return false;
  const loCua = new Map((Array.isArray(dong) ? dong : []).map((d) => [String(d.id), d.loHangId ?? null]));
  const ds = Object.entries(soDem ?? {})
    .filter(([id, muc]) => loCua.has(String(id)) && muc && muc.so != null)
    .map(([id, muc]) => ({
      chiTietId: Number(id),
      loHangId: loCua.get(String(id)),
      so: Number(muc.so),
      luc: muc.luc ?? null,
      lucHien: muc.lucHien ?? null,
    }));
  try {
    const khoa = khoaBanTam(dot.id, nguoiDungId);
    if (!ds.length) kho.removeItem(khoa);
    else kho.setItem(khoa, JSON.stringify({ maDotKiemKe: dot.maDotKiemKe ?? null, ngayTao: dot.ngayTao ?? null, capNhat: bayGio, dong: ds }));
    return true;
  } catch {
    return false;
  }
}

export function xoaBanTam(kho, dotId, nguoiDungId) {
  if (!kho || dotId == null || nguoiDungId == null) return false;
  try {
    kho.removeItem(khoaBanTam(dotId, nguoiDungId));
    return true;
  } catch {
    return false;
  }
}

const cungDot = (banTam, dot) =>
  Boolean(banTam) && banTam.maDotKiemKe === (dot?.maDotKiemKe ?? null) && banTam.ngayTao === (dot?.ngayTao ?? null);

/**
 * Số đếm khôi phục từ bản tạm: chỉ khi bản thuộc đúng đợt (mã + ngày tạo) và chỉ các dòng còn khớp chi tiết hiện tại
 * (cùng chiTietId và loHangId). `{ soDem, soDong, capNhat }`.
 */
export function khoiPhucSoDem(banTam, dot, dong) {
  const rong = { soDem: {}, soDong: 0, capNhat: null };
  if (!cungDot(banTam, dot) || !Array.isArray(banTam.dong)) return rong;
  const loCua = new Map((Array.isArray(dong) ? dong : []).map((d) => [String(d.id), d.loHangId ?? null]));
  const soDem = {};
  for (const muc of banTam.dong) {
    const id = String(muc?.chiTietId ?? "");
    if (!loCua.has(id)) continue;
    if (String(loCua.get(id) ?? "") !== String(muc.loHangId ?? "")) continue;
    const so = Number(muc.so);
    if (!Number.isInteger(so) || so < 0) continue;
    const soMs = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    soDem[id] = { so, luc: soMs(muc.luc), lucHien: soMs(muc.lucHien) };
  }
  const soDong = Object.keys(soDem).length;
  return { soDem, soDong, capNhat: soDong ? banTam.capNhat ?? null : null };
}

function cacKhoa(kho) {
  const ra = [];
  for (let i = 0; i < kho.length; i += 1) {
    const k = kho.key(i);
    if (k) ra.push(k);
  }
  return ra;
}

/** Số tài khoản KHÁC có bản đếm dở (còn số) của đợt này trên máy. */
export function demBanTamNguoiKhac(kho, dotId, nguoiDungId) {
  if (!kho || dotId == null) return 0;
  try {
    let n = 0;
    for (const k of cacKhoa(kho)) {
      const m = MAU_KHOA.exec(k);
      if (!m || m[1] !== String(dotId) || m[2] === String(nguoiDungId)) continue;
      try {
        const gt = docJson(kho, k);
        if (Array.isArray(gt?.dong) && gt.dong.length) n += 1;
      } catch {
        // bản hỏng: bỏ qua
      }
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Dọn bản tạm khi mở danh sách kiểm kê (`dsDot`: danh sách đợt vừa tải): xóa bản của đợt không còn, bản không khớp đợt
 * (mã / ngày tạo khác — id bị dùng lại), bản rỗng hoặc hỏng. GIỮ bản của đợt đã hoàn thành còn số: màn chi tiết cần nó để
 * báo "n lô bạn đã đếm không có trong lần hoàn thành đó" và cho tải CSV trước khi xóa. Trả số bản đã xóa.
 */
export function donBanTam(kho, dsDot) {
  if (!kho || !Array.isArray(dsDot)) return 0;
  const theoId = new Map(dsDot.filter((d) => d?.id != null).map((d) => [String(d.id), d]));
  let n = 0;
  try {
    for (const k of cacKhoa(kho)) {
      const m = MAU_KHOA.exec(k);
      if (!m) continue;
      let gt = null;
      try {
        gt = docJson(kho, k);
      } catch {
        gt = null;
      }
      const dot = theoId.get(m[1]);
      const giu = dot && cungDot(gt, dot) && Array.isArray(gt.dong) && gt.dong.length > 0;
      if (!giu) {
        kho.removeItem(k);
        n += 1;
      }
    }
  } catch {
    // trình duyệt chặn: thôi dọn
  }
  return n;
}

export function docDemMu(kho, nguoiDungId) {
  if (!kho || nguoiDungId == null) return false;
  try {
    return kho.getItem(khoaDemMu(nguoiDungId)) === "1";
  } catch {
    return false;
  }
}

export function ghiDemMu(kho, nguoiDungId, bat) {
  if (!kho || nguoiDungId == null) return false;
  try {
    if (bat) kho.setItem(khoaDemMu(nguoiDungId), "1");
    else kho.removeItem(khoaDemMu(nguoiDungId));
    return true;
  } catch {
    return false;
  }
}
