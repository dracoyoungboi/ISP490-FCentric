// Chạy: node --test src/pages/dashboard/admin/tong-quan/tongQuan.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { bienDong, formatTienNgan, tachTien } from "./tongQuanFormat.js";
import { chuoiBieuDo, giaTri, gopNhom, vachTruc } from "./tongQuanSoLieu.js";
import { chiaViec, duongDanLoiDongBo, lauChua } from "./viecCanXuLy.js";
import { chuThichBieuDo, khoangKy, kyTuMayChu, loiTuyChon, moTaKy, nhanDiem, soDiemDaCo, tieuDeBieuDo } from "./kyXem.js";
import { cauSuKien, gopSuKien } from "./hoatDong.js";

// Intl dùng khoảng trắng hẹp/thường tùy máy: so sánh sau khi gom khoảng trắng
const gon = (s) => s.replace(/\s/g, " ");

test("tiền: dưới 1 triệu ghi đủ, từ 1 triệu và 1 tỷ rút gọn, không dùng nghìn", () => {
  assert.deepEqual(tachTien(495000), { so: "495.000", donVi: "₫" });
  assert.equal(gon(formatTienNgan(17820000)), "17,8 triệu ₫");
  assert.equal(gon(formatTienNgan(2486300000)), "2,49 tỷ ₫");
  assert.equal(gon(formatTienNgan(0)), "0 ₫");
});

test("biến động: có dấu, kỳ trước 0 thì không ghi, gần 0 là 0% trung tính", () => {
  assert.deepEqual(bienDong(110, 100), { tang: true, chu: "+10%" });
  assert.deepEqual(bienDong(87.6, 100), { tang: false, chu: "−12,4%" });
  assert.equal(bienDong(100, 0), null);
  assert.equal(bienDong(100, null), null);
  assert.deepEqual(bienDong(100.01, 100), { tang: null, chu: "0%" });
});

test("trục tung: bước đẹp, luôn có 0, phủ cả số âm, số đơn là số nguyên", () => {
  assert.deepEqual(vachTruc(0, 36.6e6, false), { ticks: [0, 1e7, 2e7, 3e7, 4e7], day: 0, dinh: 4e7 });
  const am = vachTruc(-9.5e6, 7.9e6, false);
  assert.ok(am.ticks.includes(0));
  assert.ok(am.day <= -9.5e6 && am.dinh >= 7.9e6);
  assert.deepEqual(vachTruc(0, 3, true).ticks, [0, 1, 2, 3]);
  assert.deepEqual(vachTruc(0, 0.6e6, false).ticks, [0, 2e5, 4e5, 6e5]);
  // Không có số liệu: vẫn có trục hợp lệ
  assert.ok(vachTruc(0, 0, false).dinh > 0);
});

// Giờ số liệu mẫu: 21:13 thứ Sáu 27/11/2026 (giống demo và test máy chủ KyXemTongQuanTest)
const BAY_GIO = "2026-11-27T21:13:00";
const d = (s) => new Date(s);

test("kỳ: 30 ngày gồm hôm nay, so 30 ngày liền trước cắt cùng giờ; dòng mô tả ghi ngày thật", () => {
  const k = khoangKy("30_ngay", BAY_GIO);
  assert.deepEqual(k.tu, d("2026-10-29T00:00:00"));
  assert.deepEqual(k.denTruoc, d("2026-10-28T21:13:00"));
  assert.deepEqual(moTaKy(k), ["29/10 – 27/11", "So với 29/09 – 28/10, cùng giờ"]);
  assert.equal(soDiemDaCo(k), 30);
});

test("kỳ: hôm nay theo giờ, so cùng thứ tuần trước; tháng này so tới cùng ngày tháng trước", () => {
  const h = khoangKy("hom_nay", BAY_GIO);
  assert.deepEqual(moTaKy(h), ["27/11, 00:00 – 21:13", "So với thứ Sáu 20/11, cùng giờ"]);
  assert.equal(h.nhom, "gio");
  assert.equal(soDiemDaCo(h), 22);
  const tn = khoangKy("thang_nay", BAY_GIO);
  assert.deepEqual(tn.denTruoc, d("2026-10-27T21:13:00"));
  assert.equal(tn.soDiem, 30);
  const tt = khoangKy("thang_truoc", BAY_GIO);
  assert.deepEqual(moTaKy(tt), ["01/10 – 31/10", "So với 01/09 – 30/09"]);
  assert.equal(khoangKy("thang_nay", "2026-03-31T10:00:00").denTruoc.getTime(), d("2026-03-01T00:00:00").getTime(), "tháng trước không có ngày 31");
  assert.deepEqual(moTaKy(khoangKy("12_thang", BAY_GIO)), ["T12/25 – T11/26", "So với T12/24 – T11/25, cùng giờ"]);
});

test("kỳ tùy chọn: 1 ngày theo giờ, nhiều ngày so số ngày liền trước, dài theo tháng; lỗi khoảng", () => {
  const motNgay = khoangKy("tuy_chon", BAY_GIO, d("2026-11-10T00:00:00"), d("2026-11-10T00:00:00"));
  assert.equal(motNgay.nhom, "gio");
  assert.deepEqual(motNgay.tuTruoc, d("2026-11-03T00:00:00"));
  const tam = khoangKy("tuy_chon", BAY_GIO, d("2026-11-20T00:00:00"), d("2026-11-27T00:00:00"));
  assert.equal(tam.soDiem, 8);
  assert.deepEqual(tam.denTruoc, d("2026-11-19T21:13:00"));
  assert.equal(khoangKy("tuy_chon", BAY_GIO, d("2026-01-15T00:00:00"), d("2026-06-10T00:00:00")).nhom, "thang");
  const homNay = d("2026-11-27T00:00:00");
  assert.equal(loiTuyChon(d("2026-11-01T00:00:00"), d("2026-11-27T00:00:00"), homNay, null), null);
  assert.match(loiTuyChon(d("2025-11-01T00:00:00"), d("2026-11-27T00:00:00"), homNay, null), /tối đa 366/);
  assert.ok(loiTuyChon(d("2026-11-10T00:00:00"), d("2026-11-28T00:00:00"), homNay, null));
});

const KY_30 = { ma: "30_ngay", tu: "2026-10-29T00:00:00", den: BAY_GIO, tuTruoc: "2026-09-29T00:00:00", denTruoc: "2026-10-28T21:13:00",
  bieuDoTruocTu: "2026-09-29T00:00:00", bieuDoTruocDen: "2026-10-28T21:13:00", nhom: "ngay", soDiem: 30, kieuSoSanh: "lien_truoc", dangChay: true };
const KY_HOM_NAY = { ma: "hom_nay", tu: "2026-11-27T00:00:00", den: BAY_GIO, tuTruoc: "2026-11-20T00:00:00", denTruoc: "2026-11-20T21:13:00",
  bieuDoTruocTu: "2026-11-20T00:00:00", bieuDoTruocDen: "2026-11-21T00:00:00", nhom: "gio", soDiem: 24, kieuSoSanh: "tuan_truoc", dangChay: true };

test("kỳ máy chủ trả: nhãn biểu đồ bằng ngày thật, điểm đang chạy ghi giờ", () => {
  const k = kyTuMayChu(KY_30);
  assert.deepEqual(chuThichBieuDo(k), ["29/10 – 27/11", "29/09 – 28/10, cùng giờ"]);
  assert.equal(nhanDiem(k, 29, false), "Thứ Sáu 27/11 (đến 21:13)");
  assert.equal(nhanDiem(k, 0, true), "Thứ Ba 29/09");
  assert.equal(tieuDeBieuDo("Doanh thu", k), "Doanh thu theo ngày, 30 ngày");
  const h = kyTuMayChu(KY_HOM_NAY);
  assert.deepEqual(chuThichBieuDo(h), ["Hôm nay", "Thứ Sáu 20/11"]);
  assert.equal(nhanDiem(h, 9, false), "Thứ Sáu 27/11, 09:00 – 10:00");
});

test("biểu đồ: điểm chưa tới là undefined, điểm không có đơn là 0; trung bình đơn chỉ khi doanh thu và số đơn dương", () => {
  const k = kyTuMayChu(KY_HOM_NAY);
  const bd = { nay: [{ viTri: 9, doanhThu: 1000, loiNhuan: 400, soDon: 2 }, { viTri: 15, doanhThu: -200, loiNhuan: -100, soDon: -1 }], truoc: [{ viTri: 23, doanhThu: 50, loiNhuan: 10, soDon: 1 }] };
  const { nay, truoc } = chuoiBieuDo(bd, k, "doanhThu");
  assert.equal(nay.length, 24);
  assert.equal(nay[9], 1000);
  assert.equal(nay[0], 0);
  assert.equal(nay[22], undefined, "22:00 chưa tới");
  assert.equal(truoc[23], 50);
  assert.equal(chuoiBieuDo(bd, k, "tbDon").nay[9], 500);
  assert.equal(chuoiBieuDo(bd, k, "tbDon").nay[15], null);
  assert.equal(giaTri({ doanhThu: -5, soDon: 2 }, "tbDon"), null);
});

test("biểu đồ: tháng đem so ngắn hơn thì các điểm cuối của đường kỳ trước để trống, không vẽ 0", () => {
  // Tháng trước đã trọn: tháng 3/2026 (31 điểm) so với tháng 2 (28 ngày)
  const k = kyTuMayChu({
    ma: "thang_truoc", tu: "2026-03-01T00:00:00", den: "2026-04-01T00:00:00", tuTruoc: "2026-02-01T00:00:00",
    denTruoc: "2026-03-01T00:00:00", bieuDoTruocTu: "2026-02-01T00:00:00", bieuDoTruocDen: "2026-03-01T00:00:00",
    nhom: "ngay", soDiem: 31, kieuSoSanh: "thang_truoc", dangChay: false,
  });
  const { nay, truoc } = chuoiBieuDo({ nay: [], truoc: [{ viTri: 27, doanhThu: 70, loiNhuan: 0, soDon: 1 }] }, k, "doanhThu");
  assert.equal(nay[30], 0, "kỳ đang xem đủ 31 điểm");
  assert.equal(truoc[27], 70, "28/02 là điểm cuối của tháng 2");
  assert.equal(truoc[0], 0);
  assert.equal(truoc[28], undefined, "tháng 2 không có ngày 29–31");
  assert.equal(truoc[30], undefined);
});

test("nhóm hàng: quá 4 nhóm thì 3 nhóm lớn + Khác cộng đủ", () => {
  const ds = [5, 40, 30, 20, 10].map((v, i) => ({ danhMucId: i, tenNhom: `N${i}`, doanhThu: v, doanhThuTruoc: 1 }));
  const g = gopNhom(ds);
  assert.deepEqual(g.map((x) => x.doanhThu), [40, 30, 20, 15]);
  assert.equal(g[3].khac, true);
  assert.equal(gopNhom(ds.slice(0, 4)).length, 4);
});

test("cần xử lý: nhóm theo phân hệ, số nhóm là tổng việc, gấp và nút làm ngay lên đầu, bỏ nhóm rỗng", () => {
  const tabs = chiaViec([
    { loai: "donNhap", so: 2, ma: "DB-0091" },
    { loai: "khachYeuCauHuy", so: 1, ma: "SPE-1", moc: "2026-11-27T19:13:00" },
    { loai: "matKetNoi", so: 1, ma: "LAZADA", ten: "Gian hàng Lazada", moc: "2026-11-27T09:40:00" },
    { loai: "choNhat", so: 5, kho: "Kho tổng", moc: "2026-11-27T12:00:00", khoId: 22 },
    { loai: "treHen", so: 1, ma: "PX-TRF-1", kho: "Kho tổng", kho2: "Cửa hàng Nghệ An", moc: "2026-11-27T15:00:00", khoId: 22 },
    { loai: "loiDongBo", so: 3, kenh: [{ kenhId: 2, maKenh: "SHOPIFY", tenKenh: "Cửa hàng Shopify", so: 3 }] },
    { loai: "khong_biet", so: 9 },
  ], BAY_GIO, true);
  assert.deepEqual(tabs.map((x) => [x.id, x.so, x.gap]), [["ban", 7, true], ["kho", 6, true]]);
  const ban = tabs[0].dong;
  assert.equal(ban[0].loai, "matKetNoi", "gấp và có nút Kết nối lại đứng đầu");
  assert.equal(ban[0].ten, "Gian hàng Lazada mất kết nối");
  assert.equal(ban[0].to, "/channels/lazada/setup");
  assert.equal(ban.at(-1).loai, "donNhap");
  assert.equal(ban.at(-1).donVi, "đơn");
  assert.equal(ban.find((x) => x.loai === "loiDongBo").to, "/channels/shopify/products?trangThai=loi");
  const kho = tabs[1].dong;
  assert.equal(kho[0].loai, "treHen");
  assert.equal(kho[0].khoId, 22, "trang chuyển kho xem theo kho làm việc");
  assert.equal(kho[0].phu, "PX-TRF-1 · Kho tổng → Nghệ An, trễ 6 giờ");
  assert.equal(kho[1].phu, "Kho tổng · lâu nhất chờ 9 giờ");
  assert.equal(kho[1].khoId, null, "danh sách đơn bán không theo kho làm việc");
  const chiMua = chiaViec([
    { loai: "choNhat", so: 5, kho: "Kho tổng", moc: "2026-11-27T12:00:00" },
    { loai: "muaQuaHan", so: 1, ma: "PO-1", ten: "NCC A", moc: "2026-11-25T00:00:00" },
  ], BAY_GIO, true);
  assert.deepEqual(chiMua.map((x) => x.id), ["mua", "kho"], "nhóm có việc gấp lên đầu");
  assert.equal(lauChua("2026-11-27T21:00:00", BAY_GIO), "13 phút");
  assert.equal(duongDanLoiDongBo("KHONG_CO"), "/channels");
});

test("hoạt động: gộp từ 3 sự kiện cùng người cùng kho cách ≤ 60 phút; không gộp đơn yêu cầu hủy, đơn từ 2 triệu", () => {
  const ban = (id, gio, them = {}) => ({ loai: "ban_quay", id, ma: `POS-${id}`, thoiGian: `2026-11-27T${gio}:00`, khoId: 1, tenKho: "Cửa hàng Hà Nội", nguoi: "Bảo Ngọc", soTien: 300000, soLuong: 1, ...them });
  const ds = [ban(5, "20:57"), ban(4, "20:20"), ban(3, "19:40"), ban(2, "19:16"), ban(1, "17:00"),
    { loai: "don_moi", id: 9, ma: "SPE-9", thoiGian: "2026-11-27T19:00:00", khoId: 22, maKenh: "SHOPEE", soTien: 100000, coYeuCauHuy: true }];
  const g = gopSuKien(ds);
  assert.equal(g[0].nhom, true);
  assert.deepEqual(g[0].ds.map((x) => x.id), [5, 4, 3, 2]);
  assert.equal(g.length, 3, "nhóm 4 đơn, đơn yêu cầu hủy, đơn lúc 17:00 cách quá xa");
  const lon = gopSuKien([ban(1, "10:00", { soTien: 2500000 }), ban(2, "10:10"), ban(3, "10:20")]);
  assert.equal(lon.length, 3, "còn 2 đơn thường thì không đủ 3 để gộp");
  const xen = gopSuKien([ban(1, "10:00"), { loai: "huy", id: 7, ma: "SPE-7", thoiGian: "2026-11-27T09:50:00" }, ban(2, "09:45")]);
  assert.deepEqual(xen.map((x) => x.id), [1, 7, 2], "nhóm chưa đủ 3 trải ra vẫn đúng thứ tự giờ");
  const c = cauSuKien({ loai: "nhan_thieu", ma: "PX-TRF-0412", tenKho: "Cửa hàng Hà Nội", soLuong: 20, soNhan: 18, nguoi: "Ngọc Lan" }, true);
  assert.equal(c.truoc, "Hà Nội nhận thiếu hàng chuyển");
  assert.equal(gon(c.phu), "Nhận 18/20 cái · Ngọc Lan");
});
