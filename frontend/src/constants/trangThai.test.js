// Chạy: node --test src/constants/trangThai.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BIEU_TUONG_THEO_DOI_TUONG,
  BIEU_TUONG_THEO_NHAN,
  KHUNG_THEO_NHOM,
  NHAN_DANG_CHAY,
  NHAN_THEO_NHOM,
  NHOM_TRANG_THAI,
  NHOM_THEO_TONE,
  QUY_TRINH,
  bieuTuongCuaNhan,
  layCachVe,
  layNhomTrangThai,
  nhomCuaNhan,
  viTriTrongQuyTrinh,
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

test("đủ 7 nhóm; chỉ Cần chú ý và Có vấn đề có khung; nhóm nào cũng có khung lớn", () => {
  assert.deepEqual(Object.keys(NHOM_TRANG_THAI).sort(), ["canChuY", "cho", "dang", "dong", "loi", "thuong", "xong"]);
  assert.deepEqual(Object.keys(NHAN_THEO_NHOM).sort(), Object.keys(NHOM_TRANG_THAI).sort());
  const coKhung = Object.entries(NHOM_TRANG_THAI).filter(([, c]) => c.boc).map(([k]) => k).sort();
  assert.deepEqual(coKhung, ["canChuY", "loi"]);
  for (const [nhom, cfg] of Object.entries(NHOM_TRANG_THAI)) {
    assert.match(cfg.hinh, /^text-bo-tt-[a-z-]+-hinh$/, `${nhom}.hinh`);
    assert.ok(cfg.icon, `${nhom}.icon`);
    assert.ok(cfg.chu, `${nhom}.chu`);
    if (cfg.boc) assert.match(cfg.khung, /^bg-bo-tt-[a-z-]+ text-bo-tt-[a-z-]+-chu$/);
    assert.ok(!(cfg.boc && cfg.vien), `${nhom}: không vừa nền vừa viền`);
    assert.ok(KHUNG_THEO_NHOM[nhom], `thiếu khung lớn cho ${nhom}`);
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
    // "Chờ báo giá" giữ nhóm Cần chú ý như bản chốt 21/10; "Đã bỏ" thêm cho dòng phiếu nhặt có số cần nhặt về 0
    "Chờ báo giá": "canChuY", "Đã bỏ": "dong",
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

test("mọi nhãn có biểu tượng, và mọi biểu tượng đều được StatusBadge import", () => {
  const thieu = Object.values(NHAN_THEO_NHOM).flat().filter((nhan) => !bieuTuongCuaNhan(nhan));
  assert.deepEqual(thieu, []);
  for (const nhan of ["Quá hạn 3 ngày", "Còn 5 ngày", "Không xác định (mã 9)", "Đủ hàng (3/3)", "Thiếu hàng (1/3)"]) {
    assert.ok(bieuTuongCuaNhan(nhan), nhan);
  }
  const badge = doc("components/shared/StatusBadge.jsx");
  const bang = badge.match(/const BIEU_TUONG = \{([\s\S]*?)\};/)[1];
  const dungDoiTuong = Object.values(BIEU_TUONG_THEO_DOI_TUONG).flatMap((m) => Object.values(m));
  const nhapLucide = badge.match(/import \{([\s\S]*?)\} from "lucide-react";/)[1];
  for (const ten of new Set([...Object.values(BIEU_TUONG_THEO_NHAN), ...dungDoiTuong])) {
    assert.ok(new RegExp(`\\b${ten}\\b`).test(nhapLucide) || new RegExp(`function ${ten}\\b`).test(badge), `chưa import / chưa vẽ icon ${ten}`);
    assert.match(bang, new RegExp(`\\b${ten}\\b`), `StatusBadge chưa có icon ${ten}`);
  }
});

test("mục B review (21/10): icon không trùng nghĩa, chờ không có dấu tích, chữ đậm, khung cùng cỡ, vòng đi tiến", () => {
  // Trạng thái chờ không dùng icon có dấu tích
  for (const nhan of ["Chờ nhập kho", "Chờ nhập", "Chờ kiểm đếm", "Đang kiểm kê"]) {
    assert.doesNotMatch(bieuTuongCuaNhan(nhan), /Check/, nhan);
  }
  // Các cặp khác nghĩa không dùng chung icon
  for (const [a, b] of [["Đã liên kết", "Chưa liên kết"], ["Đã liên kết", "Ghép tay"], ["Tạm dừng", "Ngừng hoạt động"], ["Hết hàng", "Thiếu hàng"], ["Chưa có hạn giao", "Hạn hôm nay"]]) {
    assert.notEqual(bieuTuongCuaNhan(a), bieuTuongCuaNhan(b), `${a} / ${b}`);
  }
  const badge = doc("components/shared/StatusBadge.jsx");
  assert.match(badge, /whitespace-nowrap font-semibold", co\.tron/, "thẻ không khung phải đậm 600");
  assert.match(badge, /md: \{ khung: "h-6 [^"]*text-\[13px\]/, "khung cỡ md cao 24px, chữ 13px");
  assert.match(badge, /cachVe\.nhom === "cho" && cachVe\.quyTrinh\.kieu === "vong" && cachVe\.quyTrinh\.tiLe > 0;[\s\S]{0,240}NHOM_TRANG_THAI\.dang\.hinh/, "vòng qua bước 0 tô xanh dương");
});

test("Bình thường (phương án B 21/10): khung viền mảnh xanh lá, không nền, cùng cỡ thẻ cảnh báo", () => {
  const cfg = NHOM_TRANG_THAI.thuong;
  assert.equal(cfg.vien, true);
  assert.doesNotMatch(cfg.khung, /\bbg-/, "không có nền");
  assert.match(cfg.khung, /ring-1 ring-inset ring-bo-tt-thuong-vien/, "viền 1px vẽ vào trong, không làm thẻ to ra");
  assert.equal(mauCss("thuong-vien").toLowerCase(), "#bbf7d0");
  const ds = Object.entries(NHOM_TRANG_THAI).filter(([, c]) => c.vien).map(([k]) => k);
  assert.deepEqual(ds, ["thuong"]);
  const badge = doc("components/shared/StatusBadge.jsx");
  assert.match(badge, /cachVe\.kieu === "khung" \|\| cachVe\.kieu === "vien"/, "dùng chung cỡ với khung cảnh báo");
  assert.match(doc("index.css"), /\[data-nhom="thuong"\][^{]*\{ outline/, "tương phản cao giữ viền");
});

test("biểu tượng đúng bản demo đã chốt", () => {
  const demo = {
    "Chưa kết nối": "Unlink", "Chưa liên kết": "Unlink", "Đã liên kết": "Link", "Đã nhả": "PinOff", "Đang giữ": "Pin",
    "Một phần": "NuaVong", "Chưa đủ": "NuaVong", "Cất về kệ": "KeHang", "Tạm dừng": "CirclePause",
    "Chờ nhặt hàng": "ScanBarcode", "Chờ đóng gói": "Package", "Chờ xuất kho": "Truck", "Bình thường": "PackageCheck", "Còn hàng": "PackageCheck",
  };
  for (const [nhan, ten] of Object.entries(demo)) assert.equal(bieuTuongCuaNhan(nhan), ten, nhan);
  assert.equal(bieuTuongCuaNhan("Hoạt động", "nguoi"), "UserCheck");
  assert.equal(bieuTuongCuaNhan("Hoạt động", "kho"), "Warehouse");
  assert.equal(bieuTuongCuaNhan("Hoạt động"), "CircleCheckBig");
  assert.equal(bieuTuongCuaNhan("Ngừng hoạt động", "kho"), "CircleOff");
});

test("quy trình chứng từ: nhãn có nhóm, bước nằm trong tổng, mọi quyTrinh dùng trong src đều có", () => {
  for (const [ma, qt] of Object.entries(QUY_TRINH)) {
    for (const [nhan, buoc] of Object.entries(qt.buoc)) {
      assert.ok(nhomCuaNhan(nhan), `${ma}: "${nhan}" chưa có nhóm`);
      assert.ok(buoc >= 0 && buoc <= qt.tong, `${ma}: "${nhan}" bước ${buoc}/${qt.tong}`);
    }
    for (const nhan of [...(qt.huy ?? []), ...(qt.nhap ?? [])]) assert.ok(nhomCuaNhan(nhan), `${ma}: "${nhan}"`);
  }
  const daDung = new Set();
  for (const tep of tatCaTep(SRC, /\.jsx$/)) {
    for (const m of fs.readFileSync(tep, "utf8").matchAll(/<StatusBadge\b[^>]*?\bquyTrinh="([^"]+)"/gs)) {
      assert.ok(QUY_TRINH[m[1]], `${path.relative(SRC, tep)}: quyTrinh="${m[1]}" không có trong QUY_TRINH`);
      daDung.add(m[1]);
    }
  }
  assert.ok(daDung.size >= 10, `chỉ ${daDung.size} loại chứng từ dùng vòng tiến trình`);
});

test("vị trí trong quy trình", () => {
  assert.deepEqual(viTriTrongQuyTrinh("donBan", "Nháp"), { kieu: "nhap", tiLe: 0 });
  assert.deepEqual(viTriTrongQuyTrinh("donBan", "Chờ đóng gói"), { kieu: "vong", tiLe: 0.4, buoc: 2, tong: 5 });
  assert.deepEqual(viTriTrongQuyTrinh("donBan", "Hoàn thành"), { kieu: "xong", tiLe: 1, buoc: 5, tong: 5 });
  assert.deepEqual(viTriTrongQuyTrinh("donBan", "Đã hủy"), { kieu: "huy", tiLe: 0 });
  assert.deepEqual(viTriTrongQuyTrinh("phieuNhat", "Chờ nhặt"), { kieu: "vong", tiLe: 0, buoc: 0, tong: 2 });
  assert.equal(viTriTrongQuyTrinh("donMua", "Còn thiếu"), undefined);
  assert.equal(viTriTrongQuyTrinh("khongCo", "Nháp"), undefined);
});

test("cách vẽ: chỉ bọc khi cần", () => {
  const ve = (nhan, tuyChon) => layCachVe(nhan, tuyChon).kieu;
  // Cần chú ý / Có vấn đề luôn có khung, kể cả trong chứng từ
  assert.equal(ve("Chờ duyệt", { quyTrinh: "phieuXuat" }), "khung");
  assert.equal(ve("Xung đột hủy"), "khung");
  assert.equal(ve("Hết hàng"), "khung");
  assert.equal(ve("Còn thiếu", { quyTrinh: "donMua" }), "khung");
  // Chứng từ → vòng tiến trình
  assert.equal(ve("Chờ nhặt hàng", { quyTrinh: "donBan" }), "vong");
  assert.equal(ve("Đã hủy", { quyTrinh: "donBan" }), "vong");
  // Không truyền quy trình → biểu tượng, không khung
  assert.equal(ve("Chờ nhặt hàng"), "bieuTuong");
  assert.equal(ve("Hoạt động"), "bieuTuong");
  // Bình thường → khung viền mảnh (phương án B, 21/10)
  assert.equal(ve("Còn hàng"), "vien");
  assert.equal(ve("Bình thường"), "vien");
  assert.equal(ve("Còn 12 ngày"), "vien");
  // Không còn thẻ chữ xám đứng một mình: chỉ Đã đóng mới dùng chữ nhạt
  for (const [nhom, cfg] of Object.entries(NHOM_TRANG_THAI)) {
    if (nhom !== "dong") assert.notEqual(cfg.chu, "text-bo-muted", nhom);
  }
  assert.equal(ve("Đúng hạn"), "bieuTuong");
  assert.equal(ve("Trễ 2 ngày"), "khung");
  assert.equal(ve("Chưa đăng ký"), "khung");
  // Việc đang chạy thật → chấm nhịp
  for (const nhan of NHAN_DANG_CHAY) assert.equal(ve(nhan), "nhip", nhan);
  // Kết nối đang bật không phải việc đang chạy: không nhấp nháy
  assert.equal(ve("Đang hoạt động"), "bieuTuong");
  // Nhãn ngoài bảng (truyền nhóm) → chấm
  assert.equal(ve("Mới", { nhom: "dang" }), "cham");
  assert.equal(ve("Tạm thời", { nhom: "canChuY" }), "khung");
});

test("StatusBadge: khung bo 6px, không còn viên tròn, mọi màu nhóm có token trong index.css", () => {
  const badge = doc("components/shared/StatusBadge.jsx");
  assert.doesNotMatch(badge, /rounded-full|rounded-\[3px\]/);
  assert.match(badge, /rounded-md/);
  const css = doc("index.css");
  for (const cfg of Object.values(NHOM_TRANG_THAI)) {
    for (const lop of [cfg.hinh, cfg.icon, cfg.khung, cfg.chu].join(" ").split(" ").filter((l) => l.includes("bo-tt-"))) {
      const token = lop.replace(/^(bg|text|ring|border)-/, "--color-");
      assert.match(css, new RegExp(`${token}:\\s*#[0-9a-f]{6};`), `thiếu ${token}`);
    }
  }
  assert.match(css, /@keyframes bo-tt-nhip/);
  assert.match(css, /prefers-reduced-motion[^}]*\{\s*\.bo-tt-nhip/);
});

test("mọi nhãn trong bảng trạng thái chứng từ đều vẽ được trong quy trình của nó (vòng hoặc khung)", () => {
  const CAP = {
    donBan: ["donBanHang.js", "DON_BAN_HANG_STATUS"], baoGiaBan: ["baoGia.js", "BAO_GIA_STATUS"],
    phieuNhat: ["outbound.js", "PICK_LIST_STATUS"], phieuXuat: ["phieuXuatKho.js", "PHIEU_XUAT_KHO_STATUS"],
    chuyenKho: ["phieuChuyenKho.js", "PHIEU_CHUYEN_KHO_STATUS"], phieuNhap: ["goodsReceipt.js", "GOODS_RECEIPT_STATUS"],
    yeuCauNhap: ["yeuCauNhapHang.js", "YEU_CAU_NHAP_HANG_STATUS"], yeuCauBaoGia: ["donMuaHang.js", "BAO_GIA_NCC_STATUS"],
    donMua: ["donMuaHang.js", "DON_MUA_HANG_STATUS"], kiemDem: ["nhapKho.js", "TRANG_THAI_KIEM_DEM"],
  };
  const docBang = (s, ten) => {
    const m = s.match(new RegExp(`export const ${ten} = \\{([\\s\\S]*?)\\n\\};`));
    assert.ok(m, `không đọc được ${ten}`);
    return m[1];
  };
  for (const [qt, [tep, ten]] of Object.entries(CAP)) {
    const s = doc(`constants/${tep}`);
    const nhans = [...docBang(s, ten).matchAll(/label: (?:"([^"]+)"|([A-Z_]+)\[(\w+)\]\.label)/g)].map(([, chu, bang, ma]) => {
      if (chu) return chu;
      const m = docBang(s, bang).match(new RegExp(`\\b${ma}: \\{ label: "([^"]+)"`));
      assert.ok(m, `${tep}: không tra được ${bang}[${ma}]`);
      return m[1];
    });
    assert.ok(nhans.length >= 2, `${qt}: chỉ đọc được ${nhans.length} nhãn`);
    for (const nhan of nhans) {
      const ve = layCachVe(nhan, { quyTrinh: qt });
      assert.ok(ve.kieu === "vong" || ve.kieu === "khung", `${qt}: "${nhan}" rơi về ${ve.kieu}`);
    }
  }
});

test("quy trình: bước và hủy không trùng, luôn có nhãn đạt tổng; vòng có đọc bước", () => {
  for (const [ma, qt] of Object.entries(QUY_TRINH)) {
    for (const nhan of qt.huy ?? []) assert.ok(!Object.hasOwn(qt.buoc, nhan), `${ma}: "${nhan}" vừa ở bước vừa ở hủy`);
    assert.ok(Object.values(qt.buoc).includes(qt.tong), `${ma}: không nhãn nào đạt bước ${qt.tong}`);
  }
  assert.equal(layCachVe("Đã hủy", { quyTrinh: "donBan" }).quyTrinh.kieu, "huy");
  assert.deepEqual(viTriTrongQuyTrinh("donBan", "Chờ đóng gói"), { kieu: "vong", tiLe: 0.4, buoc: 2, tong: 5 });
  assert.equal(viTriTrongQuyTrinh("donBan", "constructor"), undefined);
  const badge = doc("components/shared/StatusBadge.jsx");
  assert.match(badge, /sr-only/);
  assert.match(badge, /if \(label == null \|\| label === ""\) return null;/);
  // Bước 0 vẽ vòng (chưa lấp) nhưng trình đọc màn hình đọc "chưa bắt đầu", không đọc "bước 0 trên N"
  for (const [qt, nhan] of [["phieuNhat", "Chờ nhặt"], ["phieuNhap", "Chờ nhập kho"], ["kiemDem", "Chờ kiểm đếm"]]) {
    const viTri = layCachVe(nhan, { quyTrinh: qt }).quyTrinh;
    assert.equal(viTri?.kieu, "vong", `${qt}: "${nhan}"`);
    assert.equal(viTri.buoc, 0, `${qt}: "${nhan}"`);
  }
  assert.match(badge, /viTri\.buoc === 0\) return <span className="sr-only">\{", chưa bắt đầu"\}<\/span>/, "bước 0 đọc \"chưa bắt đầu\"");
});

test("nhãn không phải chuỗi không làm hỏng cách vẽ", () => {
  for (const nhan of [undefined, null, 12, { type: "span" }]) assert.ok(layCachVe(nhan).kieu, String(nhan));
  // Thẻ video đóng gói: có thời lượng thì kèm số giây, thiếu thì chỉ "Đã có video" (PackingProofSection)
  for (const nhan of ["Đã có video (25 giây)", "Đã có video"]) {
    assert.equal(layCachVe(nhan).nhom, "xong", nhan);
    assert.equal(bieuTuongCuaNhan(nhan), "Video", nhan);
  }
  assert.equal(nhomCuaNhan("Đủ hàng (3/3)"), "xong");
  assert.equal(nhomCuaNhan("Thiếu hàng (1/3)"), "loi");
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

const mauCss = (ten) => {
  const m = doc("index.css").match(new RegExp(`--color-bo-tt-${ten}:\\s*(#[0-9a-f]{6});`));
  assert.ok(m, `thiếu --color-bo-tt-${ten}`);
  return m[1];
};
const doSang = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const tuongPhan = (a, b) => {
  const [x, y] = [doSang(a), doSang(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("màu hình của các nhóm khác nhau đủ rõ (ΔE2000 ≥ 12), nhất là Đang làm và Cần chú ý", () => {
  assert.ok(Math.abs(deltaE2000("#e2e8f0", "#fee2e2") - 14.1) < 0.2, "công thức ΔE2000 lệch");
  const ten = ["cho", "dang", "chu-y", "xong", "dong", "loi"];
  for (let i = 0; i < ten.length; i++) {
    for (let j = i + 1; j < ten.length; j++) {
      // Xám "chưa bắt đầu" và xám nhạt "đã đóng" cố ý cùng họ (không cần xử lý); biểu tượng khác nhau.
      if (ten[i] === "cho" && ten[j] === "dong") continue;
      const de = deltaE2000(mauCss(`${ten[i]}-hinh`), mauCss(`${ten[j]}-hinh`));
      assert.ok(de >= 12, `${ten[i]} / ${ten[j]}: ΔE ${de.toFixed(1)}`);
    }
  }
});

test("tương phản: chữ trong khung ≥ 4,5:1; biểu tượng (tông đậm) ≥ 4,5:1; vòng / chấm ≥ 3:1 (trừ xám)", () => {
  for (const ten of ["chu-y", "loi", "cho", "dang", "xong", "dong"]) {
    const tl = tuongPhan(mauCss(ten), mauCss(`${ten}-chu`));
    assert.ok(tl >= 4.5, `${ten}: ${tl.toFixed(2)}:1`);
  }
  for (const ten of ["cho", "dang", "chu-y", "xong", "loi"]) {
    const tl = tuongPhan("#ffffff", mauCss(`${ten}-chu`));
    assert.ok(tl >= 4.5, `biểu tượng ${ten}: ${tl.toFixed(2)}:1`);
  }
  // Vòng / chấm: mọi nhóm ≥ 3:1 trên nền trắng, trừ Đã đóng cố ý nhạt (chữ bên cạnh mang nghĩa).
  for (const ten of ["cho", "dang", "chu-y", "xong", "loi", "thuong"]) {
    const tl = tuongPhan("#ffffff", mauCss(`${ten}-hinh`));
    assert.ok(tl >= 3, `${ten}-hinh: ${tl.toFixed(2)}:1`);
  }
  assert.ok(tuongPhan("#ffffff", mauCss("thuong-chu")) >= 4.5, "chữ Bình thường xanh lá vẫn đạt 4,5:1");
});
