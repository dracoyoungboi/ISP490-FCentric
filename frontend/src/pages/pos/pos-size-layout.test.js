// Chạy: node --test src/pages/pos/pos-size-layout.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHIP_CHROME,
  GRID_GAP,
  GRID_MAX_ROWS,
  GRID_SLOT,
  LIST_GAP,
  LIST_SLOT,
  fitSizes,
  gridLayout,
  listLayout,
  packs,
  priceSummary,
  slotSpan,
} from "./pos-size-layout.js";
import { formatCount, formatPriceShort } from "./pos-format.js";

// Bề rộng nội dung vùng danh mục ở cửa sổ trình duyệt thật (cửa sổ − lề 16×2 − cột giỏ 390 − khe 12
// − viền 2 − đệm 12×2 − thanh cuộn 15; dưới 1280px không có cột giỏ).
const VUNG = { 1920: 1445, 1600: 1125, 1536: 1061, 1366: 891, 1280: 805, 1024: 951, 768: 695, 390: 325 };

test("Danh sách: số khe ô kích cỡ và kiểu dòng theo bề rộng vùng", () => {
  const ketQua = Object.fromEntries(Object.entries(VUNG).map(([man, rong]) => {
    const { stacked, slots } = listLayout(rong);
    return [man, `${stacked ? "2 tầng" : "1 tầng"} ${slots}`];
  }));
  assert.deepEqual(ketQua, {
    1920: "1 tầng 12", 1600: "1 tầng 10", 1536: "1 tầng 9", 1366: "1 tầng 7",
    1280: "1 tầng 5", 1024: "1 tầng 8", 768: "2 tầng 11", 390: "2 tầng 5",
  });
});

test("Danh sách: cột ô kích cỡ rộng đúng số khe, cột tên còn ít nhất 200px khi 1 tầng", () => {
  for (const rong of Object.values(VUNG)) {
    const { stacked, slots, sizesWidth } = listLayout(rong);
    assert.equal(sizesWidth, slots * LIST_SLOT + (slots - 1) * LIST_GAP);
    if (!stacked) assert.ok(rong - 16 - 240 - sizesWidth >= 200, `cột tên ở ${rong}px`);
  }
  assert.equal(listLayout(0).slots, 1, "bề rộng 0 (chưa đo) vẫn trả bố cục dùng được");
});

test("Lưới: số cột theo vùng, tối thiểu 2 cột, số ô mỗi dòng", () => {
  const ketQua = Object.fromEntries(Object.entries(VUNG).map(([man, rong]) => {
    const { cols, slotsPerRow } = gridLayout(rong);
    return [man, `${cols}×${slotsPerRow}`];
  }));
  assert.deepEqual(ketQua, {
    1920: "7×4", 1600: "5×4", 1536: "5×4", 1366: "4×4", 1280: "4×4", 1024: "4×4", 768: "3×4", 390: "2×3",
  });
  for (const rong of Object.values(VUNG)) assert.ok(gridLayout(rong).cardWidth >= 150);
});

test("Nhãn dài chiếm thêm khe thay vì bị cắt", () => {
  assert.equal(slotSpan(LIST_SLOT - CHIP_CHROME, LIST_SLOT, LIST_GAP), 1, "vừa khít một khe");
  assert.equal(slotSpan(LIST_SLOT - CHIP_CHROME + 1, LIST_SLOT, LIST_GAP), 2);
  assert.equal(slotSpan(2 * LIST_SLOT + LIST_GAP - CHIP_CHROME, LIST_SLOT, LIST_GAP), 2);
  assert.equal(slotSpan(500, LIST_SLOT, LIST_GAP), 3, "tối đa 3 khe");
  assert.equal(slotSpan(31, GRID_SLOT, GRID_GAP), 2, "lưới: chữ 31px cần 2 khe 40px");
});

test("Xếp theo dòng: ô 2 khe không bị cắt ngang dòng", () => {
  assert.equal(packs([1, 1, 1, 1], 4, 1), true);
  assert.equal(packs([1, 1, 1, 2], 4, 1), false);
  assert.equal(packs([1, 1, 1, 2], 4, 2), true, "ô 2 khe xuống dòng 2");
  assert.equal(packs([1, 1, 1, 2, 1, 1, 1], 4, 2), false, "dòng 1 còn trống 1 khe nhưng không dùng được");
  assert.equal(packs([], 4, 1), true);
});

const co = (label, stock, price = 100000) => ({ label, stock, price });

test("Đủ chỗ: hiện hết, đúng thứ tự, không có ô +N", () => {
  const sizes = [co("S", 1), co("M", 0), co("L", 3), co("XL", 0), co("XXL", 0)];
  const { visible, hidden } = fitSizes(sizes, { spans: sizes.map(() => 1), perRow: 7, maxRows: 1 });
  assert.deepEqual(visible, [0, 1, 2, 3, 4]);
  assert.deepEqual(hidden, []);
});

test("Thiếu chỗ: chừa 1 khe cho +N, cỡ đã hết vào +N trước, cỡ hiện vẫn đúng thứ tự", () => {
  const sizes = [co("XS", 0), co("S", 5), co("M", 0), co("L", 2), co("XL", 7), co("XXL", 0), co("3XL", 1), co("4XL", 4)];
  const { visible, hidden } = fitSizes(sizes, { spans: sizes.map(() => 1), perRow: 5, maxRows: 1 });
  assert.deepEqual(visible.map((i) => sizes[i].label), ["S", "L", "XL", "3XL"]);
  assert.deepEqual(hidden.map((i) => sizes[i].label), ["XS", "M", "XXL", "4XL"]);
  assert.equal(visible.length + 1, 5, "4 ô cỡ + 1 ô +N");
});

test("Thiếu chỗ: cỡ khớp mã đang tìm được ưu tiên hiện, kể cả khi đã hết", () => {
  const sizes = [co("S", 5), co("M", 5), co("L", 5), co("XL", 5), co("XXL", 0)];
  const { visible } = fitSizes(sizes, {
    spans: sizes.map(() => 1), perRow: 3, maxRows: 1, isMatched: (variant) => variant.label === "XXL",
  });
  assert.deepEqual(visible.map((i) => sizes[i].label), ["S", "XXL"]);
});

test("Tồn chưa biết (null) coi là còn bán được", () => {
  const sizes = [co("S", 0), co("M", null), co("L", 0)];
  const { visible } = fitSizes(sizes, { spans: [1, 1, 1], perRow: 2, maxRows: 1 });
  assert.deepEqual(visible.map((i) => sizes[i].label), ["M"]);
});

test("Lưới 2 dòng: mẫu 30 cỡ còn tối đa 2 dòng kể cả ô +N", () => {
  const sizes = Array.from({ length: 30 }, (_, i) => co(String(26 + i), i % 3 ? 4 : 0));
  sizes[5] = co("Free size", 2);
  const spans = sizes.map((s) => (s.label === "Free size" ? 2 : 1));
  const { visible, hidden } = fitSizes(sizes, { spans, perRow: 4, maxRows: GRID_MAX_ROWS });
  assert.ok(packs([...visible.map((i) => spans[i]), 1], 4, GRID_MAX_ROWS));
  assert.equal(visible.length + hidden.length, 30);
  // Cỡ còn hàng được ưu tiên: 7 khe (8 trừ ô +N), Free size chiếm 2 -> ít nhất 6 cỡ còn hàng được hiện.
  assert.ok(visible.filter((i) => sizes[i].stock > 0).length >= 6);
  assert.ok(hidden.some((i) => sizes[i].stock === 0), "cỡ đã hết vào +N");
});

test("Giá nhóm: chỉ tính cỡ còn bán và có giá", () => {
  // Mẫu trong ảnh: S còn 196 giá 133.200, các cỡ khác hết, giá 2.600.000.
  const ao = [co("S", 196, 133200), co("M", 0, 2600000), co("L", 0, 2600000)];
  assert.deepEqual(priceSummary(ao), { none: false, min: 133200, max: 133200, multi: false });
  const quan = [co("30", 2, 390000), co("33", 1, 420000), co("34", 0, 999000)];
  assert.deepEqual(priceSummary(quan), { none: false, min: 390000, max: 420000, multi: true });
  const giaKhong = [co("S", 3, 0), co("M", 2, 150000)];
  assert.deepEqual(priceSummary(giaKhong), { none: false, min: 150000, max: 150000, multi: false });
  const hetCa = [co("S", 0, 100000), co("M", 0, 120000)];
  assert.deepEqual(priceSummary(hetCa), { none: false, min: 100000, max: 120000, multi: true }, "hết cả thì lấy mọi cỡ có giá");
  assert.equal(priceSummary([co("S", 3, 0), co("M", 1, null)]).none, true);
});

test("Giá gọn và số đếm", () => {
  assert.equal(formatPriceShort(120000), "120k");
  assert.equal(formatPriceShort(133200), "133,2k");
  assert.equal(formatPriceShort(459000), "459k");
  assert.equal(formatPriceShort(1290000), "1,29tr");
  assert.equal(formatPriceShort(2600000), "2,6tr");
  assert.equal(formatPriceShort(1000000), "1tr");
  assert.equal(formatPriceShort(999950), "1tr");
  assert.equal(formatPriceShort(1004999), "1,005tr", "khác 1.000.000 thì không cùng chữ \"1tr\"");
  assert.equal(formatPriceShort(1995000), "1,995tr");
  assert.equal(formatPriceShort(10005000), "10,005tr");
  assert.equal(formatPriceShort(125000000), "125tr");
  assert.equal(formatPriceShort(900), "900đ");
  assert.equal(formatPriceShort(0), "—");
  assert.equal(formatPriceShort(null), "—");
  assert.equal(formatCount(2400), "2.400");
  assert.equal(formatCount(135790), "135.790");
  assert.equal(formatCount(null), "0");
});
