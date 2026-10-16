// Dữ liệu mẫu cho khu vực, vị trí kệ và mặt bằng kho (FO-094).
// Chạy khi máy chủ chưa có API (cờ *_DA_CO_MAY_CHU còn false); tắt bằng VITE_NHAP_KHO_MOCK=false.
// Mỗi kho có một bản riêng trong bộ nhớ trình duyệt, tải lại trang là về ban đầu.
// Kho mở đầu tiên có sẵn mặt bằng mẫu; các kho mở sau chưa vẽ mặt bằng (để xem được bước "Tạo mặt bằng").
// Hình dạng dữ liệu bám đúng hợp đồng trong services/viTriKhoService.js.
import { clone, mockDelay, mockError } from "./mockHelpers";

const p2 = (n) => String(n).padStart(2, "0");

const KHU_MAU = [
  { maKhuVuc: "KHU-A", tenKhuVuc: "Khu A – Áo", loaiKhu: "Lưu trữ", ghiChu: "Áo thun, sơ mi, áo khoác" },
  { maKhuVuc: "KHU-B", tenKhuVuc: "Khu B – Quần", loaiKhu: "Lưu trữ", ghiChu: "Quần jean, quần short" },
  { maKhuVuc: "CACH-LY", tenKhuVuc: "Khu cách ly", loaiKhu: "Cách ly", ghiChu: "Hàng lỗi chờ trả nhà cung cấp" },
  { maKhuVuc: "DONG-GOI", tenKhuVuc: "Khu đóng gói", loaiKhu: "Đóng gói", ghiChu: null },
];

// [chỉ số khu, dãy, số hàng, số tầng, sức chứa, đang chứa theo thứ tự hàng → tầng]
const DAY_MAU = [
  [0, "A", 4, 3, 40, [40, 31, 12, 28, 40, 6, 22, 0, 18, 35, 9, 0]],
  [0, "C", 2, 2, 30, [10, 30, 4, 0]],
  [1, "B", 3, 3, 60, [44, 60, 0, 12, 50, 8, 0, 21, 33]],
  [2, "Q", 2, 1, 20, [6, 0]],
];
const BAO_TRI_MAU = new Set(["A-03-02", "B-01-03"]);

// Lô mẫu đặt lên các kệ đang có hàng
const LO_MAU = [
  ["LO-20261016-01", "Áo thun Oversize · Đen / M"],
  ["LO-20261012-02", "Áo thun Oversize · Trắng / L"],
  ["LO-20261008-01", "Sơ mi Oxford · Xanh nhạt / M"],
  ["LO-20261002-03", "Quần jean slim · Xanh đậm / 30"],
  ["LO-20260928-02", "Quần short Active · Đen / L"],
];

const store = new Map();
let idTiep = 1;

function taoKho(coMatBang) {
  const khuVucs = KHU_MAU.map((k) => ({ id: idTiep++, ...k }));
  const viTris = [];
  for (const [khu, day, soHang, soTang, sucChua, chua] of DAY_MAU) {
    for (let h = 1; h <= soHang; h++) {
      for (let t = 1; t <= soTang; t++) {
        const maViTri = `${day}-${p2(h)}-${p2(t)}`;
        viTris.push({
          id: idTiep++,
          khuVucId: khuVucs[khu].id,
          maViTri,
          day,
          hang: p2(h),
          tang: p2(t),
          sucChua,
          dangChua: chua[(h - 1) * soTang + (t - 1)] ?? 0,
          trangThai: BAO_TRI_MAU.has(maViTri) ? "BAO_TRI" : "HOAT_DONG",
        });
      }
    }
  }
  const matBang = {
    soCot: 24,
    soHang: 12,
    khuVuc: [
      { khuVucId: khuVucs[0].id, x: 2, y: 2, rong: 9, cao: 4 },
      { khuVucId: khuVucs[1].id, x: 13, y: 2, rong: 8, cao: 4 },
      { khuVucId: khuVucs[2].id, x: 2, y: 9, rong: 6, cao: 3 },
    ],
    loiDi: [{ ten: "Lối đi chính", x: 2, y: 7, rong: 21, cao: 1 }],
    cua: [{ ten: "Cửa nhận hàng", huong: "VAO", x: 19, y: 12, rong: 4, cao: 1 }],
    vatCoDinh: [{ ten: "Bàn kiểm đếm", x: 11, y: 9, rong: 5, cao: 2 }],
  };
  return { khuVucs, viTris, matBang: coMatBang ? matBang : null };
}

function kho(khoId) {
  const key = Number(khoId) || 0;
  if (!store.has(key)) store.set(key, taoKho(store.size === 0));
  return store.get(key);
}

export const viTriKhoMock = {
  async dsKhuVuc(khoId) {
    await mockDelay();
    return clone(kho(khoId).khuVucs);
  },

  async taoKhuVuc(khoId, payload) {
    await mockDelay();
    const k = kho(khoId);
    const ma = String(payload?.maKhuVuc ?? "").trim().toUpperCase();
    if (k.khuVucs.some((x) => x.maKhuVuc === ma)) throw mockError(409, "Mã khu vực đã có trong kho.");
    const moi = { id: idTiep++, ...payload, maKhuVuc: ma };
    k.khuVucs.push(moi);
    return clone(moi);
  },

  async suaKhuVuc(khoId, khuVucId, payload) {
    await mockDelay();
    const khu = kho(khoId).khuVucs.find((x) => x.id === Number(khuVucId));
    if (!khu) throw mockError(404, "Không tìm thấy khu vực.");
    Object.assign(khu, {
      tenKhuVuc: payload?.tenKhuVuc ?? khu.tenKhuVuc,
      loaiKhu: payload?.loaiKhu ?? khu.loaiKhu,
      ghiChu: payload?.ghiChu ?? null,
    });
    return clone(khu);
  },

  async xoaKhuVuc(khoId, khuVucId) {
    await mockDelay();
    const k = kho(khoId);
    const id = Number(khuVucId);
    const soViTri = k.viTris.filter((v) => v.khuVucId === id).length;
    if (soViTri) throw mockError(409, `Khu còn ${soViTri} vị trí kệ. Xóa hoặc chuyển các vị trí sang khu khác trước.`);
    k.khuVucs = k.khuVucs.filter((x) => x.id !== id);
    if (k.matBang) k.matBang = { ...k.matBang, khuVuc: (k.matBang.khuVuc ?? []).filter((h) => h.khuVucId !== id) };
    return null;
  },

  async dsViTri(khoId) {
    await mockDelay();
    return clone(kho(khoId).viTris);
  },

  async taoViTri(khoId, payload) {
    await mockDelay();
    const k = kho(khoId);
    const daCo = new Set(k.viTris.map((v) => v.maViTri));
    const them = (day, h, t) => {
      const maViTri = `${day}-${p2(h)}-${p2(t)}`;
      if (daCo.has(maViTri)) return null;
      const v = {
        id: idTiep++,
        khuVucId: Number(payload.khuVucId),
        maViTri,
        day,
        hang: p2(h),
        tang: p2(t),
        sucChua: Number(payload.sucChua),
        dangChua: 0,
        trangThai: payload.trangThai ?? "HOAT_DONG",
      };
      k.viTris.push(v);
      daCo.add(maViTri);
      return v;
    };
    const day = String(payload.day ?? "").toUpperCase();
    if (payload.hangTu != null) {
      const moi = [];
      for (let h = Number(payload.hangTu); h <= Number(payload.hangDen); h++) {
        for (let t = Number(payload.tangTu); t <= Number(payload.tangDen); t++) {
          const v = them(day, h, t);
          if (v) moi.push(v);
        }
      }
      return clone(moi);
    }
    const v = them(day, Number(payload.hang), Number(payload.tang));
    if (!v) throw mockError(409, `Mã ${payload.maViTri} đã có trong kho.`);
    return clone([v]);
  },

  async suaViTri(khoId, viTriId, payload) {
    await mockDelay();
    const v = kho(khoId).viTris.find((x) => x.id === Number(viTriId));
    if (!v) throw mockError(404, "Không tìm thấy vị trí kệ.");
    if (payload.sucChua != null && Number(payload.sucChua) < Number(v.dangChua)) {
      throw mockError(400, "Sức chứa không được nhỏ hơn số đang chứa.");
    }
    Object.assign(v, {
      khuVucId: payload.khuVucId != null ? Number(payload.khuVucId) : v.khuVucId,
      sucChua: payload.sucChua != null ? Number(payload.sucChua) : v.sucChua,
      trangThai: payload.trangThai ?? v.trangThai,
    });
    return clone(v);
  },

  async xoaViTri(khoId, viTriId) {
    await mockDelay();
    const k = kho(khoId);
    const v = k.viTris.find((x) => x.id === Number(viTriId));
    if (!v) throw mockError(404, "Không tìm thấy vị trí kệ.");
    if (Number(v.dangChua) > 0) throw mockError(409, `Kệ ${v.maViTri} còn ${v.dangChua} sản phẩm, chuyển hàng đi trước khi xóa.`);
    k.viTris = k.viTris.filter((x) => x.id !== v.id);
    return null;
  },

  async loTrenKe(khoId, viTriId) {
    await mockDelay();
    const v = kho(khoId).viTris.find((x) => x.id === Number(viTriId));
    const tong = Number(v?.dangChua || 0);
    if (!tong) return [];
    // Chia số đang chứa thành 1–2 lô cho dễ nhìn
    const lo1 = LO_MAU[v.id % LO_MAU.length];
    const lo2 = LO_MAU[(v.id + 2) % LO_MAU.length];
    const a = tong > 10 ? Math.ceil(tong * 0.7) : tong;
    const ds = [{ maLo: lo1[0], tenBienThe: lo1[1], soLuong: a }];
    if (tong - a > 0) ds.push({ maLo: lo2[0], tenBienThe: lo2[1], soLuong: tong - a });
    return ds;
  },

  async matBang(khoId) {
    await mockDelay();
    const mb = kho(khoId).matBang;
    return mb ? clone(mb) : null;
  },

  async luuMatBang(khoId, matBang) {
    await mockDelay();
    kho(khoId).matBang = clone(matBang);
    return clone(matBang);
  },
};
