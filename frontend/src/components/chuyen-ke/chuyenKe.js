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
