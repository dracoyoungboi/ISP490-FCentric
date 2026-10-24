// Chạy: node --test src/components/outbound/dong-goi/tinhDongGoi.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bangChungHetHan,
  buocDongGoi,
  cauPhuPhanHoi,
  cauThoiLuongVideo,
  cauVideoQuaLon,
  chuSoBangChung,
  chuThoiLuong,
  chuThongTinTep,
  donCungPhieuNhat,
  dongDongGoi,
  giayTuDung,
  gioiHanVideo,
  khoangVideoNgan,
  lyDoKhoaHoanTat,
  oBangChung,
  phanTramTaiLen,
  resolveProofMediaUrl,
  thoiLuongGuiLen,
  thoiLuongHopLe,
  videoQuaLon,
  thongBaoDongGoi,
  tienDoDongGoi,
  tinhHuongPhien,
  xepDongDongGoi,
} from "./tinhDongGoi.js";

const phien = (extra = {}) => ({
  donBanHangId: 1021, soDonHang: "SHP-1021", trangThaiDon: 7, tenKenh: "Shopify",
  phieuXuatKhoId: 236, soPhieuXuat: "PXK-1", trangThaiPhieu: 0, biHuy: false,
  items: [
    { chiTietId: 1, maSku: "A", tenSanPham: "Áo", tenMau: "Đen", tenSize: "L", soLuongCan: 2, soLuongDaQuet: 1 },
    { chiTietId: 2, maSku: "B", tenSanPham: "Túi", tenMau: "", tenSize: "", soLuongCan: 1, soLuongDaQuet: 1 },
  ],
  ...extra,
});

test("tinhHuongPhien: đang đóng gói, xong, đã xuất, đơn hủy, phiếu hủy", () => {
  assert.equal(tinhHuongPhien(phien()).suaDuoc, true);
  const xong = tinhHuongPhien(phien({ trangThaiPhieu: 6, trangThaiDon: 8 }));
  assert.equal(xong.xong, true);
  assert.equal(xong.daXuat, false);
  assert.equal(tinhHuongPhien(phien({ trangThaiPhieu: 3 })).daXuat, true);
  const donHuy = tinhHuongPhien(phien({ biHuy: true, trangThaiDon: 4, trangThaiPhieu: 4 }));
  assert.equal(donHuy.donHuy, true);
  assert.equal(donHuy.pxHuy, false);
  assert.equal(donHuy.suaDuoc, false);
  const pxHuy = tinhHuongPhien(phien({ biHuy: true, trangThaiDon: 1, trangThaiPhieu: 4 }));
  assert.equal(pxHuy.pxHuy, true);
  // Đơn hủy sau khi đã đóng gói (phiếu Chờ xuất): vẫn là đơn hủy, không là "xong"
  assert.equal(tinhHuongPhien(phien({ biHuy: true, trangThaiDon: 4, trangThaiPhieu: 6 })).xong, false);
});

test("dòng, sắp xếp, tiến độ", () => {
  const d = xepDongDongGoi(dongDongGoi(phien().items));
  assert.deepEqual(d.map((x) => x.id), [1, 2]);
  assert.equal(d[0].nhanBienThe, "Đen / L");
  assert.equal(d[1].nhanBienThe, "Không có màu, kích cỡ");
  assert.equal(d[1].du, true);
  const t = tienDoDongGoi(d);
  assert.deepEqual([t.da, t.can, t.conLai, t.dongDu, t.soDong], [2, 3, 1, 1, 2]);
  assert.equal(tienDoDongGoi(d, { xong: true }).conLai, 0);
});

test("ô bằng chứng theo yêu cầu máy chủ; hết hạn lưu", () => {
  const video = oBangChung({ yeuCauVideo: true, danhSach: [] });
  assert.equal(video.length, 1);
  assert.equal(video[0].ten, "Video đóng gói từ lúc cho đồ vào đến khi niêm phong");
  const anh = oBangChung({ danhSach: [{ loaiBangChung: "ANH_HANG_TRONG_HOP", tenLoaiBangChung: "Ảnh A" }] });
  assert.equal(anh.length, 2);
  assert.equal(anh[0].ten, "Ảnh A");
  assert.equal(chuSoBangChung(anh, { soLuongYeuCau: 2 }), "1/2 ảnh");
  assert.equal(chuSoBangChung(video, { yeuCauVideo: true }), "0/1 video");
  const quet = [{ soLuongDaQuet: 1 }];
  assert.equal(bangChungHetHan({ xong: true }, [], quet), true);
  assert.equal(bangChungHetHan({ xong: true }, [], [{ soLuongDaQuet: 0 }]), false);
  assert.equal(bangChungHetHan({ xong: false }, [], quet), false);
  assert.equal(bangChungHetHan({ xong: true }, [{}], quet), false);
});

test("thời lượng video và câu lỗi trùng máy chủ", () => {
  assert.equal(cauThoiLuongVideo(9), "Thời lượng video đóng gói phải từ 15 giây đến 3 phút (Nhận được: 9 giây)!");
  assert.equal(cauThoiLuongVideo(181), "Thời lượng video đóng gói phải từ 15 giây đến 3 phút (Nhận được: 181 giây)!");
  assert.equal(thoiLuongHopLe(15), true);
  assert.equal(thoiLuongHopLe(35), true);
  assert.equal(thoiLuongHopLe(180), true);
  assert.equal(thoiLuongHopLe(14), false);
  assert.equal(thoiLuongHopLe(181), false);
  assert.equal(thoiLuongHopLe(NaN), false);
  assert.equal(chuThoiLuong(59), "59 giây");
  assert.equal(chuThoiLuong(60), "1 phút");
  assert.equal(chuThoiLuong(150), "2 phút 30 giây");
  assert.equal(khoangVideoNgan(), "15 giây – 3 phút");
});

test("khoảng thời lượng theo máy chủ, thiếu hoặc vô lý thì dùng config", () => {
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: 10, thoiLuongVideoToiDa: 120 }), { toiThieu: 10, toiDa: 120 });
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: "20", thoiLuongVideoToiDa: "90" }), { toiThieu: 20, toiDa: 90 });
  const macDinh = { toiThieu: 15, toiDa: 180 };
  assert.deepEqual(gioiHanVideo(null), macDinh);
  assert.deepEqual(gioiHanVideo({}), macDinh);
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: null, thoiLuongVideoToiDa: null }), macDinh);
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: 0, thoiLuongVideoToiDa: 30 }), macDinh);
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: 60, thoiLuongVideoToiDa: 30 }), macDinh);
  assert.deepEqual(gioiHanVideo({ thoiLuongVideoToiThieu: 15.5, thoiLuongVideoToiDa: 30 }), macDinh);
  // Khoảng của máy chủ áp vào kiểm tra và câu lỗi
  const g = gioiHanVideo({ thoiLuongVideoToiThieu: 10, thoiLuongVideoToiDa: 90 });
  assert.equal(thoiLuongHopLe(100, g), false);
  assert.equal(cauThoiLuongVideo(100, g), "Thời lượng video đóng gói phải từ 10 giây đến 1 phút 30 giây (Nhận được: 100 giây)!");
});

test("thời lượng gửi máy chủ: vượt mốc tối đa dưới 1 giây thì tính bằng mốc, không kẹp video dài hơn hẳn", () => {
  assert.equal(thoiLuongGuiLen(180.6), 180); // clip điện thoại hiện "3:00"
  assert.equal(thoiLuongGuiLen(180.25), 180); // bộ đếm tự dừng trễ
  assert.equal(thoiLuongGuiLen(181), 181);
  assert.equal(thoiLuongGuiLen(245.2), 245); // bộ đếm bị hãm: báo đúng số để bị chặn
  assert.equal(thoiLuongGuiLen(14.4), 14);
  assert.equal(thoiLuongGuiLen(14.5), 15);
  assert.equal(thoiLuongGuiLen(95.4), 95);
  assert.equal(thoiLuongGuiLen(null), null);
  assert.equal(thoiLuongGuiLen(Infinity), null);
  assert.equal(thoiLuongGuiLen(-1), null);
  assert.equal(thoiLuongGuiLen(30.4, { toiThieu: 15, toiDa: 30 }), 30);
});

test("báo trước khi tự dừng: 15 giây cuối", () => {
  assert.equal(giayTuDung(0), null);
  assert.equal(giayTuDung(164), null);
  assert.equal(giayTuDung(165), 15);
  assert.equal(giayTuDung(178), 2);
  assert.equal(giayTuDung(180), 0);
  assert.equal(giayTuDung(181), 0);
  // Khoảng ngắn hơn số giây báo trước: báo ngay từ đầu
  assert.equal(giayTuDung(0, { toiThieu: 5, toiDa: 10 }), 10);
});

test("video quá dung lượng (100 MB như máy chủ) và câu báo", () => {
  const MB = 1024 * 1024;
  assert.equal(videoQuaLon(100 * MB), false);
  assert.equal(videoQuaLon(100 * MB + 1), true);
  assert.equal(videoQuaLon(5 * MB), false);
  assert.equal(
    cauVideoQuaLon(240 * MB),
    "Tệp 240 MB, vượt 100 MB. Hãy bấm Quay video để quay ngay trên trang, hoặc chọn video ngắn hơn.",
  );
  assert.equal(cauVideoQuaLon(100 * MB + 1), "Tệp 101 MB, vượt 100 MB. Hãy bấm Quay video để quay ngay trên trang, hoặc chọn video ngắn hơn.");
  assert.equal(cauVideoQuaLon(1500 * MB, { daQuay: true }), "Video vừa quay 1.500 MB, vượt 100 MB. Hãy quay lại ngắn hơn.");
});

test("phần trăm tải lên", () => {
  assert.equal(phanTramTaiLen({ loaded: 0, total: 200 }), 0);
  assert.equal(phanTramTaiLen({ loaded: 91, total: 200 }), 45);
  assert.equal(phanTramTaiLen({ loaded: 200, total: 200 }), 100);
  assert.equal(phanTramTaiLen({ loaded: 300, total: 200 }), 100);
  assert.equal(phanTramTaiLen({ loaded: 50 }), null);
  assert.equal(phanTramTaiLen({ loaded: 50, total: 0 }), null);
  assert.equal(phanTramTaiLen(undefined), null);
});

test("lý do khóa Hoàn tất", () => {
  assert.equal(lyDoKhoaHoanTat({ conLai: 0, duBangChung: true }), "");
  assert.equal(lyDoKhoaHoanTat({ conLai: 3, duBangChung: false, yeuCauVideo: true }), "còn 3 sản phẩm chưa quét, thiếu video đóng gói");
  assert.equal(lyDoKhoaHoanTat({ conLai: 0, duBangChung: false, soThieu: 2 }), "thiếu 2 ảnh đóng gói");
  assert.equal(lyDoKhoaHoanTat({ conLai: 0, duBangChung: true, dangCho: 2 }), "còn 2 mã đang ghi nhận");
});

test("tiến trình 3 bước", () => {
  const dang = buocDongGoi({ tinhHuong: tinhHuongPhien(phien()), tienDo: { conLai: 1 }, duBangChung: false, chuBangChung: "0/1 video" });
  assert.deepEqual(dang.map((b) => b.trangThai), ["dangLam", "chua", "chua"]);
  const xong = buocDongGoi({ tinhHuong: tinhHuongPhien(phien({ trangThaiPhieu: 3 })), tienDo: { conLai: 0 }, hetHan: true });
  assert.deepEqual(xong.map((b) => b.trangThai), ["xong", "xong", "xong"]);
  assert.equal(xong[1].phu, "Đã tự xóa sau hạn lưu");
  assert.equal(xong[2].phu, "Đã xuất kho");
  const huy = buocDongGoi({ tinhHuong: tinhHuongPhien(phien({ biHuy: true, trangThaiDon: 4 })), tienDo: { conLai: 1 } });
  assert.equal(huy[2].nhan, "Đã khóa đóng gói");
  assert.equal(huy[2].trangThai, "dung");
});

test("thông báo theo tình huống", () => {
  const huy = thongBaoDongGoi(phien({ biHuy: true, trangThaiDon: 4, trangThaiPhieu: 4 }));
  assert.equal(huy[0].chu, "Đơn SHP-1021 đã bị hủy trên Shopify nên hệ thống đã khóa đóng gói. Chuyển toàn bộ 3 sản phẩm của đơn về khu hoàn kệ.");
  const px = thongBaoDongGoi(phien({ biHuy: true, trangThaiDon: 1, trangThaiPhieu: 4 }), { nhanTrangThaiDon: "Chờ nhặt hàng" });
  assert.match(px[0].chu, /^Phiếu xuất PXK-1 đã bị hủy nên đã khóa đóng gói\. Đơn SHP-1021 vẫn còn hiệu lực \(Chờ nhặt hàng\): .*phiếu mới phải quét lại từ đầu\.$/);
  assert.equal(px[0].moDon, true);
  assert.equal(thongBaoDongGoi(phien({ trangThaiPhieu: 6 }))[0].chu, "Đã đóng gói xong. Phiếu xuất PXK-1 chờ xác nhận xuất kho.");
  assert.equal(thongBaoDongGoi(phien(), { doiKho: "Kho tổng" })[0].chu, "Đã chuyển nơi làm việc sang Kho tổng để mở phiên đóng gói của đơn này.");
  assert.deepEqual(thongBaoDongGoi(phien()), []);
  assert.equal(thongBaoDongGoi(phien({ trangThaiPhieu: 3 }), { hetHan: true })[0].chu, "Tệp bằng chứng của đơn đã tự xóa sau hạn lưu.");
});

test("câu phụ phản hồi quét, đơn cùng phiếu nhặt, thông tin tệp, URL", () => {
  assert.equal(cauPhuPhanHoi("Mã vạch / SKU [X] không thuộc đơn SHP-1021!"), "Kiểm lại sản phẩm vừa lấy, có thể nhặt nhầm.");
  assert.equal(cauPhuPhanHoi("Mặt hàng [A] đã đóng gói đủ số lượng (2/2)!"), "Không cho thêm vào hộp.");
  assert.equal(cauPhuPhanHoi("Số lượng quét vượt quá yêu cầu (Đã quét: 1, Quét thêm: 2, Cần đóng gói: 2)"), "Giảm số lượng mỗi lần quét rồi quét lại.");
  assert.equal(cauPhuPhanHoi("Lỗi khác"), "");
  const c = donCungPhieuNhat([{ id: 1021, soDonHang: "SHP-1021", trangThai: 7 }, { id: 221, soDonHang: "SO2", trangThai: 7 }, { id: 214, soDonHang: "SO3", trangThai: 8 }], 1021);
  assert.equal(c.tiep.id, 221);
  assert.equal(c.tomTat, "3 đơn · 2 còn chờ đóng gói");
  assert.equal(donCungPhieuNhat([{ id: 1, trangThai: 7 }], 1).tomTat, "Phiếu nhặt chỉ có đơn này");
  assert.equal(donCungPhieuNhat([{ id: 1, trangThai: 7 }], 1).tiep, null);
  assert.equal(
    chuThongTinTep({ tenNguoiTao: "Kiên", ngayTao: "x", kichThuocBytes: 32925696, ngayHetHan: "y" }, { dinhGio: () => "10:52", dinhNgay: () => "20/11" }),
    "Kiên · 10:52 · 31,4 MB · lưu đến 20/11",
  );
  assert.equal(resolveProofMediaUrl("packing-proofs/1/a.jpg"), "https://minio.slmglobal.vn/fashion/packing-proofs/1/a.jpg");
  assert.equal(resolveProofMediaUrl("https://x/y"), "https://x/y");
  assert.equal(resolveProofMediaUrl(null), "");
});

test("dongDongGoi: mã màu, ảnh, id sản phẩm của máy chủ mới; máy chủ cũ để trống", () => {
  const [moi] = dongDongGoi([{ chiTietId: 1, sanPhamId: 51, tenSanPham: "Áo", tenMau: "Đen", maMauHex: "#111111", tenSize: "S", anh: "a.jpg", maSku: "A-S", soLuongCan: 2, soLuongDaQuet: 0 }]);
  assert.equal(moi.khoaNhom, 51);
  assert.equal(moi.maMauHex, "#111111");
  assert.equal(moi.kichCo, "S");
  assert.equal(moi.anh, "a.jpg");
  const [cu] = dongDongGoi([{ chiTietId: 2, tenSanPham: "Áo", tenMau: "Đen", tenSize: "S", maSku: "A-S", soLuongCan: 1 }]);
  assert.equal(cu.khoaNhom, null);
  assert.equal(cu.maMauHex, "");
  assert.equal(cu.anh, null);
});
