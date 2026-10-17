// Chạy: node --test src/constants/trangThai.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KHUNG_THEO_NHOM,
  NHAN_THEO_NHOM,
  NHOM_TRANG_THAI,
  NHOM_THEO_TONE,
  layNhomTrangThai,
  nhomCuaNhan,
} from "./trangThai.js";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = (tep) => fs.readFileSync(path.join(SRC, tep), "utf8");

function tatCaTep(thuMuc, duoi) {
  const kq = [];
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const p = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) kq.push(...tatCaTep(p, duoi));
    else if (duoi.test(muc.name) && !/\.test\.js$/.test(muc.name)) kq.push(p);
  }
  return kq;
}

test("mỗi nhãn chỉ thuộc một nhóm", () => {
  const daGap = new Map();
  for (const [nhom, ds] of Object.entries(NHAN_THEO_NHOM)) {
    for (const nhan of ds) {
      assert.ok(!daGap.has(nhan), `"${nhan}" nằm ở cả ${daGap.get(nhan)} và ${nhom}`);
      daGap.set(nhan, nhom);
    }
  }
});

test("đủ 6 nhóm có thẻ và nhóm chữ thường; nhóm nào cũng có khung", () => {
  assert.deepEqual(Object.keys(NHOM_TRANG_THAI).sort(), ["canChuY", "cho", "dang", "dong", "loi", "thuong", "xong"]);
  assert.deepEqual(Object.keys(NHAN_THEO_NHOM).sort(), Object.keys(NHOM_TRANG_THAI).sort());
  for (const [nhom, cfg] of Object.entries(NHOM_TRANG_THAI)) {
    if (nhom === "thuong") assert.equal(cfg.lop, "");
    else assert.match(cfg.lop, /^bg-bo-tt-[a-z-]+ text-bo-tt-[a-z-]+-chu$/);
    assert.ok(KHUNG_THEO_NHOM[nhom], `thiếu khung cho ${nhom}`);
  }
  for (const nhom of Object.values(NHOM_THEO_TONE)) assert.ok(NHOM_TRANG_THAI[nhom]);
});

test("thứ tự tra nhóm: nhom truyền thẳng → tên → tone → Xám", () => {
  assert.equal(layNhomTrangThai("Đã hủy", { nhom: "loi" }), "loi");
  assert.equal(layNhomTrangThai("Đã hủy", { tone: "danger" }), "dong");
  assert.equal(layNhomTrangThai("12,5%", { tone: "success" }), "xong");
  assert.equal(layNhomTrangThai("Nhãn lạ"), "cho");
  assert.equal(layNhomTrangThai("Nhãn lạ", { nhom: "khongCo" }), "cho");
  assert.equal(layNhomTrangThai(undefined), "cho");
  assert.equal(layNhomTrangThai({ type: "span" }, { tone: "warning" }), "canChuY");
  assert.equal(layNhomTrangThai("  Đã hủy  "), "dong");
});

test("nhãn có số tra theo mẫu", () => {
  assert.equal(nhomCuaNhan("Quá hạn 3 ngày"), "loi");
  assert.equal(nhomCuaNhan("Còn 12 ngày"), "thuong");
  assert.equal(nhomCuaNhan("Không xác định (mã 9)"), "cho");
  assert.equal(nhomCuaNhan("Quá hạn"), undefined);
});

test("phân màu đã chốt (bảng 10) cho các nhãn chính", () => {
  const mong = {
    "Nháp": "cho", "Chờ nhặt hàng": "cho", "Chờ nhập kho": "cho", "Chờ xuất": "cho", "Tạm dừng": "cho",
    "Đang vận chuyển": "dang", "Đã duyệt": "dang", "Đã xuất kho": "dang", "Chờ phản hồi": "dang", "Đang nhặt": "dang",
    "Chờ duyệt": "canChuY", "Đã nhận báo giá": "canChuY", "Sắp hết hàng": "canChuY", "Cất về kệ": "canChuY", "Hàng trả lại": "canChuY",
    "Hoàn thành": "xong", "Đã nhập kho": "xong", "Đã xuất": "xong", "Hoạt động": "xong", "Đã chuyển thành đơn mua hàng": "xong",
    "Đã hủy": "dong", "Từ chối": "dong", "Ngừng hoạt động": "dong", "Bị hoàn trả": "dong", "Đã xóa": "dong",
    "Lỗi": "loi", "Bị khóa": "loi", "Hết hàng": "loi", "Thiếu hàng": "loi", "Xung đột hủy": "loi",
    "Còn hàng": "thuong", "Bình thường": "thuong",
  };
  for (const [nhan, nhom] of Object.entries(mong)) assert.equal(nhomCuaNhan(nhan), nhom, nhan);
});

test("tên đã đổi: tên mới có nhóm, tên cũ không còn trong bảng", () => {
  for (const moi of ["Sắp hết hàng", "Đã nhận đủ", "Đã lấy hết lô", "Hoàn thành"]) assert.ok(nhomCuaNhan(moi), moi);
  for (const cu of ["Hoàn tất", "Hết lô"]) assert.equal(nhomCuaNhan(cu), undefined, cu);
});

test("mọi nhãn trong các bảng trạng thái ở constants/* đều có nhóm", () => {
  const bang = [
    "donBanHang.js", "donMuaHang.js", "phieuXuatKho.js", "phieuChuyenKho.js", "yeuCauNhapHang.js",
    "goodsReceipt.js", "outbound.js", "baoGia.js", "nhapKho.js", "channel.js", "trangThaiChung.js",
  ];
  let dem = 0;
  for (const tep of bang) {
    const s = doc(path.join("constants", tep));
    // Chỉ lấy object trạng thái `{ label: "…" }` / `{ ma: …, label: "…" }`, bỏ qua mảng tab và lựa chọn lọc (có value/ma + trangThai)
    for (const m of s.matchAll(/\{\s*(?:ma: "[A-Z_]+", )?label: "([^"]+)"\s*\}/g)) {
      dem++;
      assert.ok(nhomCuaNhan(m[1]), `${tep}: "${m[1]}" chưa có nhóm trong constants/trangThai.js`);
    }
    assert.doesNotMatch(s, /tone: "/, `${tep} còn khai báo tone (màu tra theo tên)`);
    assert.doesNotMatch(s, /className: "border-/, `${tep} còn className tô màu riêng`);
  }
  assert.ok(dem >= 60, `chỉ đọc được ${dem} nhãn, kiểm tra lại biểu thức đọc`);
});

test("mọi <StatusBadge> có nhãn chữ cố định trong src đều đã có nhóm", () => {
  const thieu = [];
  for (const tep of tatCaTep(SRC, /\.jsx$/)) {
    const s = fs.readFileSync(tep, "utf8");
    for (const m of s.matchAll(/<StatusBadge\b([^>]*?)\/>/gs)) {
      const props = m[1];
      if (/\bnhom=|\btone=/.test(props)) continue;
      const nhan = props.match(/\blabel=(\{[^}]*\}|"[^"]*"|'[^']*')/)?.[1];
      if (!nhan) continue;
      for (const chu of nhan.matchAll(/["']([^"'`$]+)["']/g)) {
        if (!nhomCuaNhan(chu[1])) thieu.push(`${path.relative(SRC, tep)}: "${chu[1]}"`);
      }
    }
  }
  assert.deepEqual(thieu, []);
});

test("thẻ R8 không còn viền, chấm, icon và mọi màu nhóm có token trong index.css", () => {
  const badge = doc("components/shared/StatusBadge.jsx");
  assert.doesNotMatch(badge, /rounded-full|border\b|size-1\.5/);
  assert.match(badge, /rounded-\[3px\]/);
  const css = doc("index.css");
  for (const cfg of Object.values(NHOM_TRANG_THAI)) {
    for (const lop of cfg.lop.split(" ").filter(Boolean)) {
      const token = lop.replace(/^(bg|text)-/, "--color-");
      assert.match(css, new RegExp(`${token}:\\s*#[0-9a-f]{6};`), `thiếu ${token}`);
    }
  }
});

// Độ khác màu CIEDE2000 giữa hai mã hex (dưới 5 gần như không thấy khác, trên 12 khác rõ ở thẻ nhỏ).
function deltaE2000(hexA, hexB) {
  const lab = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const rad = Math.PI / 180;
  const [L1, a1, b1] = lab(hexA);
  const [L2, a2, b2] = lab(hexB);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360;
  const h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
  let dh = h2p - h1p;
  if (C1p * C2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? hbp / 2 : (hbp < 360 ? hbp + 360 : hbp - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * 30 * Math.exp(-(((hbp - 275) / 25) ** 2)) * rad) * 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const dL = (L2 - L1) / Sl;
  const dC = (C2p - C1p) / Sc;
  const dH = dHp / Sh;
  return Math.sqrt(dL ** 2 + dC ** 2 + dH ** 2 + Rt * dC * dH);
}

test("nền các nhóm khác nhau đủ rõ (ΔE2000 ≥ 12), nhất là Đang làm và Cần chú ý", () => {
  const css = doc("index.css");
  const nen = (ten) => css.match(new RegExp(`--color-bo-tt-${ten}:\\s*(#[0-9a-f]{6});`))[1];
  assert.ok(Math.abs(deltaE2000("#e2e8f0", "#fee2e2") - 14.1) < 0.2, "công thức ΔE2000 lệch");
  assert.ok(deltaE2000(nen("dang"), nen("chu-y")) >= 12, "Đang làm và Cần chú ý quá giống nhau");
  // Xám "chưa bắt đầu" và xám nhạt "đã đóng" cố ý gần nhau (cùng là không cần xử lý), chưa xét ở đây.
  const ten = ["cho", "dang", "chu-y", "xong", "dong", "loi"];
  for (let i = 0; i < ten.length; i++) {
    for (let j = i + 1; j < ten.length; j++) {
      if (ten[i] === "cho" && ten[j] === "dong") continue;
      const de = deltaE2000(nen(ten[i]), nen(ten[j]));
      assert.ok(de >= 12, `${ten[i]} / ${ten[j]}: ΔE ${de.toFixed(1)}`);
    }
  }
});

test("mọi cặp nền / chữ tương phản từ 6,9:1 trở lên", () => {
  const css = doc("index.css");
  const mau = (ten) => css.match(new RegExp(`--color-bo-tt-${ten}:\\s*(#[0-9a-f]{6});`))[1];
  const doSang = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const ten of ["cho", "dang", "chu-y", "xong", "dong", "loi"]) {
    const [a, b] = [doSang(mau(ten)), doSang(mau(`${ten}-chu`))].sort((x, y) => y - x);
    const tyLe = (a + 0.05) / (b + 0.05);
    assert.ok(tyLe >= 6.9, `${ten}: ${tyLe.toFixed(2)}:1`);
  }
});
