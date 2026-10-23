// Chạy: node --test src/components/chuyen-kho/tinhChuyenKho.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { dungBangChungTu } from "../chung-tu/bangChungTu.js";
import {
  boLocHangChuyen,
  canTaiLaiChungTu,
  daDuyetXuat,
  daXuatHang,
  dongChuyenKho,
  laPhieuNhapHoanTra,
  soDaLayTheoBienThe,
  tachTenMau,
  timPhieuNhap,
  timPhieuXuatCon,
  tinhBuocChuyenKho,
  tinhNut,
  tinhQuyen,
  tinhThongBao,
} from "./tinhChuyenKho.js";

// Kho nguồn = 1 (Kho tổng), kho đích = 2 (Cửa hàng Hà Nội)
const phieu = (trangThai, extra = {}) => ({
  id: 201,
  soPhieuXuat: "PX-TRF-202610201",
  khoXuatId: 1,
  khoXuatTen: "Kho tổng",
  khoNhapId: 2,
  khoNhapTen: "Cửa hàng Hà Nội",
  nguoiDuyetTen: trangThai >= 2 ? "quanlykhotong" : "Chưa duyệt",
  ngayTao: "2026-10-20T02:00:00Z",
  trangThai,
  items: [],
  ...extra,
});
const px = (trangThai, extra = {}) => ({ id: 31, soPhieuXuat: "PX202610203", phieuChuyenKhoGocId: 201, trangThai, ngayXuat: trangThai === 3 ? "2026-10-20T07:20:00Z" : null, ...extra });
const pn = (trangThai, extra = {}) => ({ id: 41, soPhieuNhap: "PN-TRF-202610211", phieuXuatGocId: 201, khoId: 2, trangThai, ngayNhap: trangThai === 3 ? "2026-10-21T02:10:00Z" : null, ...extra });
const pnRet = (trangThai) => pn(trangThai, { id: 42, soPhieuNhap: "PN-RET-202610212", khoId: 1 });

const quyen = (vaiTro, kho) => tinhQuyen(vaiTro, kho, phieu(0));
const QTV = quyen(["quan_tri_vien"], []);
const QLK_NGUON = quyen(["quan_ly_kho"], [1]);
const QLK_DICH = quyen(["quan_ly_kho"], [2]);
const NVK_NGUON = quyen(["nhan_vien_kho"], [1]);
const NVK_DICH = quyen(["nhan_vien_kho"], [2]);

test("tachTenMau tách ở dấu ' - ' cuối, tên sản phẩm có ' - ' vẫn giữ", () => {
  assert.deepEqual(tachTenMau("Quần Jeans Baggy - Xanh Than"), { tenSanPham: "Quần Jeans Baggy", tenMau: "Xanh Than" });
  assert.deepEqual(tachTenMau("Áo 2 lớp - phối viền - Đen"), { tenSanPham: "Áo 2 lớp - phối viền", tenMau: "Đen" });
  assert.deepEqual(tachTenMau("Túi Tote"), { tenSanPham: "Túi Tote", tenMau: "" });
  assert.deepEqual(tachTenMau(null), { tenSanPham: "", tenMau: "" });
});

test("dongChuyenKho: id duy nhất kể cả khi trùng biến thể, gom theo tên sản phẩm, số đã lấy", () => {
  const items = [
    { bienTheId: 7, sku: "QJ-21", tenSanPham: "Quần Jeans - Xanh Than", soLuongYeuCau: "10.00", soLuongDaPick: 0 },
    { bienTheId: 8, sku: "QJ-22", tenSanPham: "Quần Jeans - Xanh Than", soLuongYeuCau: 8, soLuongDaPick: 0 },
    { bienTheId: 9, sku: "AK-M", tenSanPham: "Áo Khoác - Đen", soLuongYeuCau: 6 },
    { bienTheId: 9, sku: "AK-M", tenSanPham: "Áo Khoác - Đen", soLuongYeuCau: 1 },
  ];
  const dong = dongChuyenKho(items);
  assert.deepEqual(dong.map((d) => d.id), ["7-0", "8-1", "9-2", "9-3"]);
  assert.equal(dong[0].soLuong, 10);
  assert.equal(dong[0].daLay, null);
  const bang = dungBangChungTu(dong);
  assert.equal(bang.tong.soSanPham, 2);
  assert.equal(bang.tong.soLuong, 25);
  assert.deepEqual(bang.nhom.map((n) => n.tomTat), ["Xanh Than", "Đen"]);

  const daLay = dongChuyenKho(items, soDaLayTheoBienThe([
    { bienTheSanPhamId: 7, soLuongDaPick: "10.00" },
    { bienTheSanPhamId: 8, soLuongDaPick: 3 },
  ]));
  assert.deepEqual(daLay.map((d) => d.daLay), [10, 3, 0, 0]);
  assert.deepEqual(dongChuyenKho(items, "theoYeuCau").map((d) => d.daLay), [10, 8, 6, 1]);
  assert.deepEqual(dongChuyenKho(null), []);
});

test("dongChuyenKho: máy chủ mới trả màu, mã màu, kích cỡ, ảnh, id sản phẩm", () => {
  const dong = dongChuyenKho([
    { bienTheId: 1, sanPhamId: 51, sku: "AK-S", tenSanPham: "Áo Khoác - Đen", tenMau: "Đen", maMauHex: "#111111", kichCo: "S", anh: "a.jpg", soLuongYeuCau: 3 },
    { bienTheId: 2, sanPhamId: 51, sku: "AK-M", tenSanPham: "Áo Khoác - Kem", tenMau: "Kem", maMauHex: "#eeddcc", kichCo: "M", soLuongYeuCau: 2 },
  ]);
  assert.equal(dong[0].tenSanPham, "Áo Khoác");
  assert.equal(dong[0].tenMau, "Đen");
  assert.equal(dong[0].maMauHex, "#111111");
  assert.equal(dong[0].kichCo, "S");
  assert.equal(dong[0].anh, "a.jpg");
  assert.equal(dong[1].anh, null);
  const bang = dungBangChungTu(dong);
  assert.equal(bang.tong.soSanPham, 1);
  assert.equal(bang.nhom[0].anh, "a.jpg");
  assert.equal(bang.nhom[0].tomTat, "Đen, Kem · S, M");
  // Tên màu có " - ": chỉ cắt đúng hậu tố màu
  const [x] = dongChuyenKho([{ bienTheId: 3, tenSanPham: "Áo - Xanh - Trắng", tenMau: "Xanh - Trắng", soLuongYeuCau: 1 }]);
  assert.equal(x.tenSanPham, "Áo");
  assert.equal(x.tenMau, "Xanh - Trắng");
});

test("boLocHangChuyen: 'Thiếu lô' chỉ lọc khi đang chọn lô", () => {
  const dong = dongChuyenKho([
    { bienTheId: 1, soLuongYeuCau: 5 },
    { bienTheId: 2, soLuongYeuCau: 5 },
  ], { 1: 5, 2: 2 });
  const loc = boLocHangChuyen(true);
  assert.equal(loc.tatCa, null);
  assert.deepEqual(dong.filter(loc.thieuLo).map((d) => d.bienTheId), [2]);
  assert.equal(boLocHangChuyen(false).thieuLo, null);
  assert.equal(dungBangChungTu(dong, { loc: boLocHangChuyen(false).thieuLo }).ketQua.soDong, 2);
});

test("timPhieuXuatCon bỏ phiếu đã hủy, giữ cách so khớp cũ", () => {
  const ds = [px(4, { id: 30 }), { id: 99, phieuChuyenKhoGocId: 7, trangThai: 0 }, px(0)];
  assert.equal(timPhieuXuatCon(ds, 201)?.id, 31);
  assert.equal(timPhieuXuatCon(ds, "201")?.id, 31);
  assert.equal(timPhieuXuatCon([{ id: 5, transferId: 201, trangThai: 3 }], 201)?.id, 5);
  assert.equal(timPhieuXuatCon([px(4)], 201), null);
  assert.equal(timPhieuXuatCon(undefined, 201), null);
});

test("timPhieuNhap: phiếu đã hủy không còn là phiếu hiệu lực", () => {
  const huy = pn(4, { id: 40 });
  assert.deepEqual(timPhieuNhap([huy], 201), { tatCa: [huy], hieuLuc: null });
  const moi = pn(0);
  const kq = timPhieuNhap([huy, { id: 1, phieuXuatGocId: 5, trangThai: 0 }, moi], 201);
  assert.deepEqual(kq.tatCa.map((p) => p.id), [40, 41]);
  assert.equal(kq.hieuLuc.id, 41);
});

test("laPhieuNhapHoanTra theo kho nhận, thiếu kho thì theo mã PN-RET-", () => {
  assert.equal(laPhieuNhapHoanTra(pnRet(0), phieu(4)), true);
  assert.equal(laPhieuNhapHoanTra(pn(0), phieu(4)), false);
  assert.equal(laPhieuNhapHoanTra({ soPhieuNhap: "PN-RET-1" }, phieu(4)), true);
  assert.equal(laPhieuNhapHoanTra(null, phieu(4)), false);
});

test("daDuyetXuat / daXuatHang", () => {
  assert.equal(daDuyetXuat(phieu(1)), false);
  assert.equal(daDuyetXuat(phieu(2)), true);
  assert.equal(daDuyetXuat(phieu(4, { nguoiDuyetTen: "Chưa duyệt" })), false);
  assert.equal(daDuyetXuat(phieu(4, { nguoiDuyetTen: "quanlykhotong" })), true);
  assert.equal(daDuyetXuat(phieu(4, { nguoiDuyetTen: "Chưa duyệt" }), px(0)), true);
  assert.equal(daXuatHang(phieu(3)), true);
  assert.equal(daXuatHang(phieu(4), px(0)), false);
  assert.equal(daXuatHang(phieu(4), px(3)), true);
});

test("tinhQuyen giữ đúng cách màn cũ (quản lý theo kho được phân công)", () => {
  assert.equal(QTV.laQuanLyDich && QTV.laQuanLyNguon, true);
  assert.equal(QTV.laKho, false);
  assert.equal(QLK_NGUON.laQuanLyNguon, true);
  assert.equal(QLK_NGUON.laQuanLyDich, false);
  assert.equal(NVK_NGUON.laQuanLyNguon, false);
  assert.equal(NVK_NGUON.laKho && NVK_NGUON.oKhoNguon, true);
  assert.equal(tinhQuyen(["quan_ly_kho"], ["2"], phieu(0)).oKhoDich, true);
  assert.equal(tinhQuyen(undefined, undefined, null).laKho, false);
});

test("tinhNut theo trạng thái và vai trò", () => {
  // 0 Nháp: Gửi duyệt cho quản lý kho đích / quản trị viên; rỗng thì khóa + lý do
  assert.deepEqual(tinhNut({ phieu: phieu(0), quyen: QLK_DICH }).guiDuyet, { khoa: false, lyDo: "" });
  assert.deepEqual(tinhNut({ phieu: phieu(0), quyen: QTV, rong: true }).guiDuyet, { khoa: true, lyDo: "Phiếu chuyển kho chưa có sản phẩm nào" });
  assert.equal(tinhNut({ phieu: phieu(0), quyen: QLK_NGUON }).guiDuyet, null);
  assert.equal(tinhNut({ phieu: phieu(0), quyen: NVK_DICH }).guiDuyet, null);
  // 1 Chờ duyệt: Phê duyệt cho quản lý kho nguồn
  assert.equal(tinhNut({ phieu: phieu(1), quyen: QLK_NGUON }).pheDuyet, true);
  assert.equal(tinhNut({ phieu: phieu(1), quyen: QLK_DICH }).pheDuyet, false);
  // 2: Tạo phiếu xuất (kho nguồn, không phải quản trị viên thuần); đã có phiếu xuất → mở phiếu đó
  assert.equal(tinhNut({ phieu: phieu(2), quyen: NVK_NGUON }).taoPhieuXuat, true);
  assert.equal(tinhNut({ phieu: phieu(2), quyen: QTV }).taoPhieuXuat, false);
  const coPx = tinhNut({ phieu: phieu(2), quyen: NVK_NGUON, phieuXuat: px(0) });
  assert.equal(coPx.taoPhieuXuat, false);
  assert.equal(coPx.moPhieuXuat.id, 31);
  // 3: Nhập kho (kho đích); phiếu nhập chờ → mở; chỉ có phiếu đã hủy → Nhập kho lại được (timPhieuNhap bỏ phiếu hủy)
  assert.equal(tinhNut({ phieu: phieu(3), quyen: NVK_DICH }).nhapKho, true);
  assert.equal(tinhNut({ phieu: phieu(3), quyen: NVK_NGUON }).nhapKho, false);
  assert.equal(tinhNut({ phieu: phieu(3), quyen: NVK_DICH, phieuNhap: pn(0) }).moPhieuNhap.id, 41);
  assert.equal(tinhNut({ phieu: phieu(3), quyen: NVK_DICH, phieuNhap: timPhieuNhap([pn(4)], 201).hieuLuc }).nhapKho, true);
  // 3: Hủy khóa kèm lý do khi kho đích đã lập phiếu nhập chưa hủy (máy chủ cũng chặn); chưa lập / đã hủy thì hủy được
  assert.equal(tinhNut({ phieu: phieu(3), quyen: QLK_NGUON }).lyDoKhongHuy, "");
  assert.equal(tinhNut({ phieu: phieu(3), quyen: QLK_NGUON, phieuNhap: pn(0) }).lyDoKhongHuy,
    "Kho đích đã lập phiếu nhập PN-TRF-202610211, cần hủy phiếu nhập đó trước");
  assert.equal(tinhNut({ phieu: phieu(3), quyen: QLK_NGUON, phieuNhap: pn(4) }).lyDoKhongHuy, "");
  assert.equal(tinhNut({ phieu: phieu(2), quyen: QLK_NGUON, phieuNhap: pn(0) }).lyDoKhongHuy, "");
  // 4: Nhập kho hoàn trả chỉ khi hàng đã rời kho nguồn
  assert.equal(tinhNut({ phieu: phieu(4), quyen: NVK_NGUON }).nhapHoanTra, null);
  assert.equal(tinhNut({ phieu: phieu(4), quyen: NVK_NGUON, phieuXuat: px(0) }).nhapHoanTra, null);
  assert.deepEqual(tinhNut({ phieu: phieu(4), quyen: NVK_NGUON, phieuXuat: px(3) }).nhapHoanTra, { khoa: false, lyDo: "" });
  assert.equal(tinhNut({ phieu: phieu(4), quyen: NVK_DICH, phieuXuat: px(3) }).nhapHoanTra, null);
  assert.deepEqual(tinhNut({ phieu: phieu(4), quyen: NVK_NGUON, phieuXuat: px(3), phieuNhap: pn(0) }).nhapHoanTra, {
    khoa: true,
    lyDo: "Phiếu nhập PN-TRF-202610211 tại Cửa hàng Hà Nội chưa hủy",
  });
  const coRet = tinhNut({ phieu: phieu(4), quyen: NVK_NGUON, phieuXuat: px(3), phieuNhap: pnRet(0) });
  assert.equal(coRet.nhapHoanTra, null);
  assert.equal(coRet.moPhieuNhap.id, 42);
  assert.equal(tinhNut({ phieu: phieu(4), quyen: NVK_NGUON, phieuXuat: px(3), phieuNhap: pnRet(3) }).moPhieuNhap, null);
  // Hủy: 0–3, ẩn với ai có vai trò nhân viên kho
  assert.equal(tinhNut({ phieu: phieu(3), quyen: QLK_DICH }).huy, true);
  assert.equal(tinhNut({ phieu: phieu(3), quyen: tinhQuyen(["quan_ly_kho", "nhan_vien_kho"], [1], phieu(3)) }).huy, false);
  assert.equal(tinhNut({ phieu: phieu(4), quyen: QTV }).huy, false);
  assert.equal(tinhNut({ phieu: phieu(5), quyen: QTV }).huy, false);
});

test("tinhBuocChuyenKho: luồng bình thường", () => {
  const trangThai = (b) => b.map((x) => x.trangThai);
  assert.deepEqual(trangThai(tinhBuocChuyenKho({ phieu: phieu(0) })), ["dangLam", "chua", "chua", "chua"]);
  const b1 = tinhBuocChuyenKho({ phieu: phieu(1) });
  assert.deepEqual(trangThai(b1), ["xong", "dangLam", "chua", "chua"]);
  assert.equal(b1[1].phu, "Chờ quản lý Kho tổng");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(2) })[2].phu, "Chờ tạo phiếu xuất");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(2), phieuXuat: px(0) })[2].phu, "Đang chọn lô");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(2), phieuXuat: px(0), daLay: { da: 1234, can: 2000 } })[2].phu, "Đang chọn lô · đã lấy 1.234/2.000");
  const b3 = tinhBuocChuyenKho({ phieu: phieu(3), phieuXuat: px(3) });
  assert.deepEqual(trangThai(b3), ["xong", "xong", "xong", "dangLam"]);
  assert.equal(b3[2].ngay, "2026-10-20T07:20:00Z");
  assert.equal(b3[3].phu, "Chờ lập phiếu nhập");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(3), phieuXuat: px(3), phieuNhap: pn(0) })[3].phu, "Chờ nhận hàng");
  const b5 = tinhBuocChuyenKho({ phieu: phieu(5), phieuXuat: px(3), phieuNhap: pn(3) });
  assert.deepEqual(trangThai(b5), ["xong", "xong", "xong", "xong"]);
  assert.equal(b5[3].ngay, "2026-10-21T02:10:00Z");
  assert.deepEqual(b5.map((b) => b.ai), ["Kho đích", "Kho nguồn", "Kho nguồn", "Kho đích"]);
});

test("tinhBuocChuyenKho: hủy ở từng lúc", () => {
  const truocDuyet = tinhBuocChuyenKho({ phieu: phieu(4, { nguoiDuyetTen: "Chưa duyệt" }) });
  assert.deepEqual(truocDuyet.map((b) => b.trangThai), ["xong", "dung", "chua", "chua"]);
  assert.equal(truocDuyet[1].phu, "Trước khi duyệt");
  const truocXuat = tinhBuocChuyenKho({ phieu: phieu(4, { nguoiDuyetTen: "ql" }) });
  assert.deepEqual(truocXuat.map((b) => b.trangThai), ["xong", "xong", "dung", "chua"]);
  assert.equal(truocXuat[2].phu, "Trước khi xuất hàng");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(4, { nguoiDuyetTen: "ql" }), phieuXuat: px(0) })[2].phu, "Khi đang chọn lô");
  const dangDuong = tinhBuocChuyenKho({ phieu: phieu(4, { nguoiDuyetTen: "ql" }), phieuXuat: px(3) });
  assert.deepEqual(dangDuong.map((b) => b.trangThai), ["xong", "xong", "xong", "dung"]);
  assert.equal(dangDuong[3].phu, "Hàng chưa nhận");
  assert.equal(tinhBuocChuyenKho({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pnRet(0) })[3].phu, "Chờ nhập hoàn trả");
  const daTra = tinhBuocChuyenKho({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pnRet(3) })[3];
  assert.equal(daTra.phu, "Đã nhập hoàn trả");
  assert.equal(daTra.ngay, "2026-10-21T02:10:00Z");
});

test("tinhThongBao chỉ khi phiếu đã hủy", () => {
  assert.deepEqual(tinhThongBao({ phieu: phieu(3), phieuXuat: px(3) }), { dangDuong: false, phieuXuatNhap: null, phieuNhapCho: null });
  assert.equal(tinhThongBao({ phieu: phieu(4), phieuXuat: px(3) }).dangDuong, true);
  assert.equal(tinhThongBao({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pnRet(0) }).dangDuong, false);
  assert.equal(tinhThongBao({ phieu: phieu(4), phieuXuat: px(0) }).phieuXuatNhap.id, 31);
  assert.equal(tinhThongBao({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pn(0) }).phieuNhapCho.id, 41);
  assert.equal(tinhThongBao({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pnRet(0) }).phieuNhapCho, null);
  assert.equal(tinhThongBao({ phieu: phieu(4) }).dangDuong, false);
});

test("canTaiLaiChungTu chỉ tải lại hai danh sách khi chứng từ liên quan có thể vừa đổi", () => {
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(0) }), { phieuXuat: false, phieuNhap: false });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(2) }), { phieuXuat: true, phieuNhap: false });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(2), phieuXuat: px(0) }), { phieuXuat: true, phieuNhap: false });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(3), phieuXuat: px(0) }), { phieuXuat: true, phieuNhap: true });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(3), phieuXuat: px(3), phieuNhap: pn(0) }), { phieuXuat: false, phieuNhap: true });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(5), phieuXuat: px(3), phieuNhap: pn(3) }), { phieuXuat: false, phieuNhap: false });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(4), phieuXuat: px(3) }), { phieuXuat: false, phieuNhap: true });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(4), phieuXuat: px(3), phieuNhap: pnRet(3) }), { phieuXuat: false, phieuNhap: false });
  assert.deepEqual(canTaiLaiChungTu({ phieu: phieu(4) }), { phieuXuat: false, phieuNhap: false });
});
