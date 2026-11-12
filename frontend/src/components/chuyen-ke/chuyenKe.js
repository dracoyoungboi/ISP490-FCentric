// Lõi tính của màn Chuyển kệ nội bộ (UC-7.4): hàm thuần, không phụ thuộc React (chạy được bằng node --test).

/** Mã quét / gõ để so khớp: bỏ khoảng trắng hai đầu, không phân biệt hoa thường. */
const chuanMa = (x) => String(x ?? "").trim().toLowerCase();

/** Kệ có giới hạn sức chứa không (null / 0 = không giới hạn). */
export const coGioiHan = (ke) => ke?.sucChua != null && ke.sucChua > 0;

/** Số còn chỗ của kệ: Infinity khi kệ không giới hạn sức chứa (BR-BIN-05). */
export const conTrongCua = (ke) => (coGioiHan(ke) ? Math.max(0, ke.conTrong ?? ke.sucChua - (ke.dangChua ?? 0)) : Infinity);

/** Số nguyên không âm từ ô nhập; rỗng / sai thì 0. */
export function soNguyen(giaTri) {
  const n = Math.floor(Number(String(giaTri ?? "").replace(/[.\s]/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Giỏ hàng chọn chuyển: `{ [loHangId]: soLuong }` → mảng dòng đã chọn (theo thứ tự trên kệ), bỏ dòng 0. */
export function dongDaChon(dsDong, chon) {
  return (dsDong ?? [])
    .map((d) => ({ ...d, soLuong: Math.min(soNguyen(chon?.[d.loHangId]), d.khaDung ?? 0) }))
    .filter((d) => d.soLuong > 0);
}

export const tongSoLuong = (ds) => (ds ?? []).reduce((s, d) => s + (d.soLuong ?? 0), 0);

/**
 * Phân bổ tổng cần cất vào các kệ đích theo thứ tự quét (luồng chính + A3.1 tách cất): mỗi kệ nhận tối đa phần còn
 * trống. Kệ có `vuot` (quản lý kho cho cất vượt) nhận tối đa `toiDa` — phần đang thiếu lúc duyệt; tăng số sau đó thì phần
 * thêm lại cần kệ khác (hỏi lại A3). Trả `{ phan: [{ ...dich, nhan }], conLai }`.
 */
export function phanBoKeDich(tong, dsDich) {
  let conLai = Math.max(0, tong);
  const phan = (dsDich ?? []).map((d) => {
    const gioiHan = d.vuot ? Math.max(conTrongCua(d.ke), d.toiDa ?? Infinity) : conTrongCua(d.ke);
    const nhan = Math.min(conLai, gioiHan);
    conLai -= nhan;
    return { ...d, nhan };
  });
  return { phan, conLai };
}

/**
 * Dòng gửi máy chủ: rót các lô đã chọn (theo thứ tự) lần lượt vào các kệ đích theo phần mỗi kệ nhận. Một lô có thể tách
 * sang nhiều kệ, một kệ nhận nhiều lô. Trả `[{ loHangId, keDichId, soLuong }]`.
 */
export function taoDongGui(dsChon, phan) {
  const kq = [];
  const hang = (dsChon ?? []).map((d) => ({ loHangId: d.loHangId, con: d.soLuong }));
  let i = 0;
  for (const p of phan ?? []) {
    let canKe = p.nhan;
    while (canKe > 0 && i < hang.length) {
      const lay = Math.min(canKe, hang[i].con);
      if (lay > 0) kq.push({ loHangId: hang[i].loHangId, keDichId: p.ke.id, soLuong: lay });
      hang[i].con -= lay;
      canKe -= lay;
      if (hang[i].con === 0) i += 1;
    }
  }
  return kq;
}

/** So khớp mã quét với một dòng trên kệ: mã vạch biến thể, mã SKU hoặc mã lô (không phân biệt hoa thường). */
export function khopMa(dong, ma) {
  const m = chuanMa(ma);
  if (!m) return false;
  return [dong.maVach, dong.maSku, dong.maLo].some((x) => x != null && chuanMa(x) === m);
}

/**
 * Dòng nhận lần quét sản phẩm / lô: trong các dòng khớp mã, dòng còn có thể cộng thêm (chưa chọn hết khả dụng) đầu
 * tiên theo FIFO (danh sách đã xếp lô cũ trước). Không còn dòng nào cộng được thì trả dòng khớp đầu tiên (để báo).
 */
export function dongTheoMaQuet(dsDong, chon, ma) {
  const khop = (dsDong ?? []).filter((d) => khopMa(d, ma));
  return khop.find((d) => soNguyen(chon?.[d.loHangId]) < (d.khaDung ?? 0)) ?? khop[0] ?? null;
}

/**
 * Lý do kệ không dùng được ở vai trò `vaiTro` ("nguon" | "dich"); null = dùng được. Kệ nguồn chỉ bị chặn khi đang kiểm kê
 * (như máy chủ): kệ bảo trì / trạng thái khác vẫn chuyển hàng đi được để giải phóng kệ.
 */
export function lyDoKhongDung(ke, vaiTro) {
  if (!ke?.khoa) return null;
  if (vaiTro === "nguon" && ke.khoa !== "KIEM_KE") return null;
  return ke.khoa;
}

/** Ghi chú tối đa của phiếu chuyển kệ (cột phieu_chuyen_ke.ghi_chu VARCHAR(255)). */
export const TOI_DA_GHI_CHU = 255;

/**
 * Lý do chọn nhanh (BA 6.1 "Ghi chú": dồn kệ, đón hàng mới, bảo trì; mục 1.1: đảo vị trí theo sức mua). Giá trị lưu
 * vào ghi chú của phiếu nên giữ tiếng Việt; màn dịch lúc hiện ra.
 */
// i18n-giu-nguyen: giá trị lưu vào ghi chú phiếu
export const LY_DO_CHUYEN_KE = ["Dồn kệ", "Đón hàng mới", "Bảo trì kệ", "Đảo vị trí bán chạy"];

/** Ghi chú gửi máy chủ: "Lý do · ghi chú thêm", cắt về {@link TOI_DA_GHI_CHU}; rỗng thì null. */
export function ghepGhiChu(lyDo, ghiChu) {
  const s = [lyDo, String(ghiChu ?? "").trim()].filter(Boolean).join(" · ");
  return s ? s.slice(0, TOI_DA_GHI_CHU) : null;
}

/** Danh sách kệ dùng gần đây (mới nhất trước, không trùng, tối đa `toiDa`). */
export function themKeGanDay(ds, ma, toiDa = 5) {
  const m = String(ma ?? "").trim();
  if (!m) return ds ?? [];
  return [m, ...(ds ?? []).filter((x) => x !== m)].slice(0, toiDa);
}

const SO_GOI_Y_GAN_DAY = 5;
const SO_GOI_Y_CO_HANG = 5;
const SO_GOI_Y_LOC = 30;

/**
 * Lý do một kệ không chọn được ở vai trò `vaiTro` trong danh sách gợi ý mã kệ (null = chọn được):
 * KIEM_KE (cả hai vai trò) · BAO_TRI / DAY / KHAC (kệ đích) · TRONG (kệ nguồn không có hàng).
 */
export function lyDoKhoaGoiY(ke, vaiTro) {
  const tt = ke?.trangThai;
  if (tt === "KHOA_KIEM_KE") return "KIEM_KE";
  if (vaiTro === "dich") {
    if (tt === "BAO_TRI") return "BAO_TRI";
    if (tt && tt !== "HOAT_DONG" && tt !== "DAY_HANG") return "KHAC";
    if (ke.sucChua && ke.dangChua >= ke.sucChua) return "DAY";
    return null;
  }
  return (ke?.dangChua ?? 0) <= 0 ? "TRONG" : null;
}

/**
 * Danh sách gợi ý mã kệ cho ô quét (thay datalist của trình duyệt). `ds`: kệ của kho `{ id, maViTri, khuVuc, trangThai,
 * sucChua, dangChua }`; `q`: chữ đang gõ; `vaiTro`: "nguon" | "dich"; `keNguonId`: bỏ kệ nguồn khỏi gợi ý kệ đích;
 * `can`: số còn phải cất (chia nhóm đủ chỗ / thiếu chỗ); `ganDay`: mã kệ dùng gần đây (mới nhất trước).
 * Trả `{ nhom: [{ ma, ten, ds }], chonDuoc: [kệ theo thứ tự hiện], tong }`; mỗi kệ có thêm `khoa` (lyDoKhoaGoiY),
 * `conTrong` (null = không giới hạn), `thieu`, `ganDay`.
 * - Chưa gõ: kệ nguồn = dùng gần đây + kệ đang có hàng nhiều nhất; kệ đích = để trống (cột Kệ đích đã có gợi ý).
 * - `tatCa`: chưa gõ vẫn liệt kê như đang gõ (bảng chọn kệ trên điện thoại).
 * - Đang gõ: lọc theo mã (không phân biệt hoa thường), kệ nguồn gom theo khu; kệ đích chia 3 nhóm đủ chỗ / thiếu chỗ /
 *   không nhận hàng.
 */
export function locGoiYKe(ds, { q = "", vaiTro = "nguon", keNguonId = null, can = 0, ganDay = [], tatCa = false } = {}) {
  const tim = String(q ?? "").trim().toLowerCase();
  const thuTuGanDay = new Map((ganDay ?? []).map((m, i) => [String(m).toLowerCase(), i]));
  const moRong = (ds ?? [])
    .filter((k) => k && k.id !== keNguonId)
    .map((k) => {
      const conTrong = k.sucChua ? Math.max(0, k.sucChua - (k.dangChua ?? 0)) : null;
      const khoa = lyDoKhoaGoiY(k, vaiTro);
      return {
        ...k,
        khoa,
        conTrong,
        thieu: vaiTro === "dich" && !khoa && conTrong != null && can > 0 && conTrong < can,
        ganDay: thuTuGanDay.has(String(k.maViTri).toLowerCase()),
      };
    });
  const theoMa = (a, b) => String(a.maViTri).localeCompare(String(b.maViTri), "vi", { numeric: true });
  let nhom = [];
  if (!tim && !tatCa) {
    if (vaiTro === "dich") return { nhom: [], chonDuoc: [], tong: 0 };
    const gan = moRong
      .filter((k) => k.ganDay)
      .sort((a, b) => thuTuGanDay.get(String(a.maViTri).toLowerCase()) - thuTuGanDay.get(String(b.maViTri).toLowerCase()))
      .slice(0, SO_GOI_Y_GAN_DAY);
    const coHang = moRong
      .filter((k) => !k.ganDay && !k.khoa)
      .sort((a, b) => (b.dangChua ?? 0) - (a.dangChua ?? 0) || theoMa(a, b))
      .slice(0, SO_GOI_Y_CO_HANG);
    nhom = [
      { ma: "gan-day", ten: "GAN_DAY", ds: gan },
      { ma: "co-hang", ten: "CO_HANG", ds: coHang },
    ];
  } else {
    const khop = moRong.filter((k) => String(k.maViTri).toLowerCase().includes(tim));
    // Khớp từ đầu mã lên trước, rồi theo mã
    khop.sort((a, b) => Number(!String(a.maViTri).toLowerCase().startsWith(tim)) - Number(!String(b.maViTri).toLowerCase().startsWith(tim)) || theoMa(a, b));
    const gioiHan = khop.slice(0, SO_GOI_Y_LOC);
    if (vaiTro === "dich") {
      const du = gioiHan.filter((k) => !k.khoa && !k.thieu).sort((a, b) => (a.conTrong ?? Infinity) - (b.conTrong ?? Infinity) || theoMa(a, b));
      nhom = [
        { ma: "du-cho", ten: "DU_CHO", ds: du },
        { ma: "thieu-cho", ten: "THIEU_CHO", ds: gioiHan.filter((k) => !k.khoa && k.thieu) },
        { ma: "khong-nhan", ten: "KHONG_NHAN", ds: gioiHan.filter((k) => k.khoa) },
      ];
    } else {
      const theoKhu = new Map();
      for (const k of gioiHan) {
        const khu = k.khuVuc || "";
        if (!theoKhu.has(khu)) theoKhu.set(khu, []);
        theoKhu.get(khu).push(k);
      }
      nhom = [...theoKhu.entries()].map(([khu, d]) => ({ ma: `khu-${khu}`, ten: khu, khu: true, ds: d }));
    }
    const ketQua = nhom.filter((n) => n.ds.length);
    return { nhom: ketQua, chonDuoc: ketQua.flatMap((n) => n.ds).filter((k) => !k.khoa), tong: khop.length };
  }
  const ketQua = nhom.filter((n) => n.ds.length);
  return { nhom: ketQua, chonDuoc: ketQua.flatMap((n) => n.ds).filter((k) => !k.khoa), tong: ketQua.reduce((s, n) => s + n.ds.length, 0) };
}
