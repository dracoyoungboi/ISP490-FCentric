// Chạy: node --test src/components/outbound/phieu-nhat/tinhPhieuNhat.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BO_LOC_DONG,
  capNhatSauQuet,
  cauMayChuKhongThay,
  cauMayChuPhieuNhat,
  cauQuetThanhCong,
  demDon,
  dongBangNhat,
  dongDaNhatChuyenKho,
  dsDonTrongPhieu,
  gopCanhBaoHuy,
  hangTraKe,
  idDongDaQuet,
  ketQuaHoanTatNhat,
  loiQuetCanTaiLai,
  lyDoKhoaHoanTat,
  laPhieuChuyenKho,
  LOC_LOAI_PHIEU_NHAT,
  moTaHoanTatNhat,
  nguonPhieuNhat,
  nhanBangChung,
  phieuChuyenDaXuat,
  phieuChuyenHuyKhiDangDi,
  thongBaoHoanTatNhat,
  tinhBuoc,
  tinhQuyen,
  themCanhBaoHuy,
  tinhTienDo,
  trangThaiDong,
} from "./tinhPhieuNhat.js";

const dong = (id, sku, can, da, extra = {}) => ({
  id,
  bienTheSanPhamId: id * 10,
  maSku: sku,
  maVachSku: `893${id}`,
  tenSanPham: "Áo khoác lông cừu",
  tenMau: "Đen",
  tenSize: "M",
  maMauHex: "#111827",
  soLuongCanNhat: can,
  soLuongDaQuet: da,
  phanBoLo: [{ loHangId: id, maLo: `L${id}`, soLuong: can }],
  soLuongDaPhanBo: can,
  phanBoThuCong: false,
  ...extra,
});

const phieu = (extra = {}) => ({
  id: 4,
  maPickList: "PL-20261021-004",
  trangThai: "dang_nhat",
  nguoiNhatId: 7,
  tenNguoiNhat: "Nguyễn Thanh Bình",
  ngayTao: "2026-10-21T04:13:00Z",
  ngayHoanTat: null,
  tongSoLuongCanNhat: 5,
  tongSoLuongDaQuet: 2,
  phanTramHoanThanh: 40,
  coTheHoanTat: false,
  danhSachMaDonHang: ["SHP-1021", "SO-2", "SHP-1022"],
  danhSachDonHang: [],
  chiTietNhatHangs: [dong(1, "AK-B", 3, 2), dong(2, "AK-A", 2, 0)],
  ...extra,
});

test("tinhQuyen: ma trận A.4 khi phiếu đang mở", () => {
  const chua = phieu({ nguoiNhatId: null, tenNguoiNhat: null });
  // Quản lý, phiếu chưa phân công
  let q = tinhQuyen(chua, { laQuanLy: true, idToi: 3 });
  assert.deepEqual(
    [q.duocQuet, q.duocPhanCong, q.duocNhanViec, q.duocHoanTat, q.duocPhanBoLo],
    [false, true, true, false, true],
  );
  // Quản lý, phiếu giao cho chính mình
  q = tinhQuyen(phieu({ nguoiNhatId: 3 }), { laQuanLy: true, idToi: 3 });
  assert.deepEqual([q.duocQuet, q.duocPhanCong, q.duocHoanTat, q.duocPhanBoLo], [true, true, true, true]);
  // Quản lý, phiếu giao người khác: không quét, vẫn hoàn tất thay và phân bổ lô
  q = tinhQuyen(phieu(), { laQuanLy: true, idToi: 3 });
  assert.deepEqual([q.duocQuet, q.duocPhanCong, q.duocHoanTat, q.duocPhanBoLo], [false, true, true, true]);
  // Nhân viên kho, phiếu chưa phân công: chỉ nhận việc
  q = tinhQuyen(chua, { laQuanLy: false, idToi: 7 });
  assert.deepEqual(
    [q.duocQuet, q.duocPhanCong, q.duocNhanViec, q.duocHoanTat, q.duocPhanBoLo],
    [false, true, true, false, false],
  );
  // Nhân viên kho, phiếu giao cho mình (id trong JWT có thể là chuỗi)
  q = tinhQuyen(phieu(), { laQuanLy: false, idToi: "7" });
  assert.deepEqual([q.duocQuet, q.duocPhanCong, q.duocHoanTat, q.duocPhanBoLo], [true, false, true, true]);
  // Nhân viên kho, phiếu giao người khác: chỉ xem
  q = tinhQuyen(phieu(), { laQuanLy: false, idToi: 8 });
  assert.deepEqual([q.duocQuet, q.duocPhanCong, q.duocHoanTat, q.duocPhanBoLo], [false, false, false, false]);
  // Không đọc được id người dùng: không nhận việc được
  assert.equal(tinhQuyen(chua, { laQuanLy: false, idToi: null }).duocNhanViec, false);
});

test("tinhQuyen: phiếu đã nhặt / đã hủy / dữ liệu cũ chỉ xem", () => {
  for (const tt of ["da_nhat", "da_huy", "huy", "da_xuat", "hoan_tat", "ma_la"]) {
    const q = tinhQuyen(phieu({ trangThai: tt, nguoiNhatId: 3 }), { laQuanLy: true, idToi: 3 });
    assert.equal(q.dangMo, false, tt);
    assert.equal(q.duocQuet || q.duocPhanCong || q.duocHoanTat || q.duocPhanBoLo || q.duocNhanViec, false, tt);
  }
  assert.equal(tinhQuyen(phieu({ trangThai: "da_huy" })).daHuy, true);
  assert.equal(tinhQuyen(phieu({ trangThai: "huy" })).daXongNhat, false);
  assert.equal(tinhQuyen(phieu({ trangThai: "da_nhat" })).daXongNhat, true);
  assert.equal(tinhQuyen(phieu({ trangThai: "da_xuat" })).daXongNhat, true);
  assert.equal(tinhQuyen(null).daXongNhat, false);
});

test("trangThaiDong: số cần nhặt 0 là Đã bỏ, không phải Còn thiếu", () => {
  assert.equal(trangThaiDong({ soLuongCanNhat: 0, soLuongDaQuet: 0 }), "bo");
  assert.equal(trangThaiDong({ soLuongCanNhat: "0.000", soLuongDaQuet: null }), "bo");
  assert.equal(trangThaiDong({ soLuongCanNhat: "3.000", soLuongDaQuet: "3.000" }), "du");
  assert.equal(trangThaiDong({ soLuongCanNhat: 3, soLuongDaQuet: 2 }), "thieu");
});

test("dongBangNhat: thứ tự cố định theo SKU, không đổi sau khi quét", () => {
  const ds = [dong(3, "QJ-10", 1, 0), dong(1, "AK-2", 2, 2), dong(2, "AK-10", 1, 0)];
  const truoc = dongBangNhat(ds).map((d) => d.id);
  assert.deepEqual(truoc, [1, 2, 3]); // AK-2 < AK-10 (so số), rồi QJ
  const sau = dongBangNhat(ds.map((l) => (l.id === 2 ? { ...l, soLuongDaQuet: 1 } : l))).map((d) => d.id);
  assert.deepEqual(sau, truoc);
  const d = dongBangNhat([dong(5, "X", 4, 1, { phanBoLo: [{ maLo: "L1", soLuong: 1 }, { maLo: "L2", soLuong: 2 }], soLuongDaPhanBo: 3, phanBoThuCong: true, anhBienTheUrl: "/a.jpg", tenChatLieu: "Len" })])[0];
  assert.equal(d.kichCo, "M");
  assert.equal(d.maVach, "8935");
  assert.equal(d.anh, "/a.jpg");
  assert.equal(d.chuTimThem, "Len");
  assert.deepEqual(d.lo, [{ maLo: "L1", soLuong: 1 }, { maLo: "L2", soLuong: 2 }]);
  assert.equal(d.thieuLo, 1);
  assert.equal(d.thuCong, true);
  assert.equal(d.trangThai, "thieu");
  assert.equal(dongBangNhat(null).length, 0);
});

test("dongBangNhat: dòng Đã bỏ và dòng chưa có lô", () => {
  const [bo, chuaLo] = dongBangNhat([
    dong(1, "A", 0, 0, { phanBoLo: [], soLuongDaPhanBo: 0 }),
    dong(2, "B", 2, 0, { phanBoLo: [], soLuongDaPhanBo: 0 }),
  ]);
  assert.equal(bo.trangThai, "bo");
  assert.equal(bo.chuaLo, false);
  assert.equal(bo.thieuLo, 0);
  assert.equal(chuaLo.chuaLo, true);
  assert.equal(chuaLo.thieuLo, 0);
  assert.equal(BO_LOC_DONG.tatCa, null);
  assert.equal(BO_LOC_DONG.conThieu(chuaLo), true);
  assert.equal(BO_LOC_DONG.conThieu(bo), false);
  assert.equal(BO_LOC_DONG.du(bo), false);
});

test("capNhatSauQuet: cập nhật tại chỗ như bản cũ", () => {
  const p = phieu({ trangThai: "cho_nhat" });
  const kq = { chiTietId: 2, bienTheId: 20, soLuongDaQuet: 1, tongSoLuongDaQuet: 3, phanTramHoanThanh: 60, coTheHoanTat: false };
  const moi = capNhatSauQuet(p, kq);
  assert.equal(moi.trangThai, "dang_nhat");
  assert.equal(moi.chiTietNhatHangs.find((l) => l.id === 2).soLuongDaQuet, 1);
  assert.equal(moi.chiTietNhatHangs.find((l) => l.id === 1), p.chiTietNhatHangs[0]); // dòng khác giữ nguyên đối tượng
  assert.equal(moi.tongSoLuongDaQuet, 3);
  assert.equal(moi.phanTramHoanThanh, 60);
  // Dự phòng khớp theo biến thể khi thiếu chiTietId; thiếu tổng thì giữ số cũ
  const moi2 = capNhatSauQuet(p, { bienTheId: 10, soLuongDaQuet: 3 });
  assert.equal(moi2.chiTietNhatHangs.find((l) => l.id === 1).soLuongDaQuet, 3);
  assert.equal(moi2.tongSoLuongDaQuet, 2);
  assert.equal(moi2.coTheHoanTat, false);
  assert.equal(capNhatSauQuet(null, kq), null);
  assert.equal(capNhatSauQuet(phieu(), kq).trangThai, "dang_nhat");
});

test("idDongDaQuet và câu báo quét", () => {
  const p = phieu();
  assert.equal(idDongDaQuet(p, { chiTietId: 2 }), 2);
  assert.equal(idDongDaQuet(p, { bienTheId: 10 }), 1);
  assert.equal(idDongDaQuet(p, { bienTheId: 99 }), null);
  assert.equal(idDongDaQuet(p, {}), null);
  assert.equal(cauQuetThanhCong({ thongBao: "Đã quét 1 × Áo [AK-A] (1/2)" }, "AK-A", 1), "Đã quét 1 × Áo [AK-A] (1/2)");
  assert.equal(cauQuetThanhCong({ maSku: "AK-A", soLuongDaQuet: "1.000", soLuongCanNhat: 2 }, "893", 1), "AK-A +1 → 1/2");
  assert.equal(cauQuetThanhCong(null, "893", 2), "893 +2 → 0/0");
});

test("tinhTienDo và lý do khóa Hoàn tất nhặt", () => {
  assert.deepEqual(tinhTienDo(2, 5, 40), { da: 2, can: 5, pct: 40, xong: false, conLai: 3 });
  assert.equal(tinhTienDo(8, 12, 66.67).pct, 67);
  assert.equal(tinhTienDo(2, 5, 140).pct, 100);
  assert.equal(tinhTienDo(1, 3, null).pct, 33);
  assert.equal(tinhTienDo(0, 0, undefined).pct, 0);
  assert.equal(tinhTienDo("5.000", "5.000", 100).xong, true);
  assert.equal(lyDoKhoaHoanTat({ coTheHoanTat: false, conLai: 1234 }), "Còn 1.234 sản phẩm chưa nhặt");
  assert.equal(lyDoKhoaHoanTat({ coTheHoanTat: false, conLai: 0 }), "Phiếu không còn dòng cần nhặt");
  assert.equal(lyDoKhoaHoanTat({ coTheHoanTat: false, conLai: 0, rong: true }), "Phiếu nhặt hàng chưa có sản phẩm nào");
  assert.equal(lyDoKhoaHoanTat({ coTheHoanTat: true, conLai: 0, dangGui: 2 }), "Đang gửi mã vừa quét");
  assert.equal(lyDoKhoaHoanTat({ coTheHoanTat: true, conLai: 0 }), "");
});

const don = (so, trangThai, extra = {}) => ({ id: so.length, soDonHang: so, trangThai, biHuy: trangThai === 4, ...extra });

test("dsDonTrongPhieu: thứ tự việc cần làm trước, đơn hủy cuối, ghép theo mã đơn", () => {
  const p = phieu({
    danhSachMaDonHang: ["D1", "D2", "D3", "D4", "D5"],
    danhSachDonHang: [don("D1", 3), don("D2", 4), don("D3", 8), don("D4", 7), don("D5", 7)],
  });
  assert.deepEqual(dsDonTrongPhieu(p).map((d) => d.so), ["D4", "D5", "D3", "D1", "D2"]);
  const ds = dsDonTrongPhieu(p, { huySo: "D4" });
  assert.equal(ds.find((d) => d.so === "D4").huy, true);
  assert.equal(ds.find((d) => d.so === "D4").trangThai, 4);
  assert.equal(ds.at(-1).so, "D4");
  assert.equal(dsDonTrongPhieu(p, { huyHet: true }).every((d) => d.huy), true);
  // Nhiều đơn vừa hủy qua WebSocket (mảng số đơn)
  const nhieu = dsDonTrongPhieu(p, { huySo: ["D4", "D5"] });
  assert.deepEqual(nhieu.filter((d) => d.huy).map((d) => d.so), ["D2", "D4", "D5"]);
  assert.equal(dsDonTrongPhieu(p, { huySo: [] }).filter((d) => d.huy).length, 1);
  // Mã có trong danh sách mà thiếu thông tin: vẫn hiện, không có trạng thái
  const thieu = dsDonTrongPhieu(phieu({ danhSachMaDonHang: ["X"], danhSachDonHang: [] }));
  assert.deepEqual(thieu.map((d) => [d.so, d.info, d.trangThai]), [["X", null, null]]);
  // Không có danhSachMaDonHang: lấy theo danhSachDonHang
  assert.deepEqual(dsDonTrongPhieu({ danhSachDonHang: [don("A", 1)] }).map((d) => d.so), ["A"]);
  assert.deepEqual(dsDonTrongPhieu(null), []);
});

test("demDon và tinhBuoc: 5 bước theo trạng thái phiếu", () => {
  const tienDo = { da: 2, can: 5, pct: 40 };
  const dangNhat = phieu();
  // Nhân viên đang quét: bước Nhặt hàng không ghi tiến độ (đã có ở vùng quét)
  let buoc = tinhBuoc(dangNhat, { quyen: tinhQuyen(dangNhat, { idToi: 7 }), dsDon: [], tienDo });
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "dangLam", "chua", "chua"]);
  assert.equal(buoc[2].phu, "");
  assert.equal(buoc[0].coGio, true);
  // Người khác xem: bước Nhặt hàng ghi tiến độ
  buoc = tinhBuoc(dangNhat, { quyen: tinhQuyen(dangNhat, { idToi: 8 }), dsDon: [], tienDo });
  assert.equal(buoc[2].phu, "2/5 sản phẩm · 40%");
  // Chưa phân công
  const chua = phieu({ nguoiNhatId: null, trangThai: "cho_nhat" });
  buoc = tinhBuoc(chua, { quyen: tinhQuyen(chua, { idToi: 7 }), dsDon: [], tienDo });
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "dangLam", "chua", "chua", "chua"]);
  assert.equal(buoc[1].phu, "Chưa có người nhặt");
  // Đã hủy
  const huy = phieu({ trangThai: "da_huy" });
  buoc = tinhBuoc(huy, { quyen: tinhQuyen(huy), dsDon: [], tienDo });
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "dung", "chua", "chua"]);
  // Đã nhặt: đóng gói 2/3, xuất 1/3 (đơn hủy không tính); chỉ một bước đang làm, bước sau vẫn ghi n/N đơn
  const xong = phieu({
    trangThai: "da_nhat",
    ngayHoanTat: "2026-10-21T04:42:00Z",
    danhSachMaDonHang: ["A", "B", "C", "D"],
    danhSachDonHang: [don("A", 7), don("B", 8), don("C", 3), don("D", 4)],
  });
  const dsDon = dsDonTrongPhieu(xong);
  assert.deepEqual(demDon(dsDon), { tong: 3, soDongGoi: 2, soXuat: 1 });
  buoc = tinhBuoc(xong, { quyen: tinhQuyen(xong), dsDon, tienDo: { da: 5, can: 5, pct: 100 } });
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "xong", "dangLam", "chua"]);
  assert.equal(buoc.filter((b) => b.trangThai === "dangLam").length, 1);
  assert.deepEqual([buoc[2].phu, buoc[3].phu, buoc[4].phu], ["5/5 sản phẩm", "2/3 đơn", "1/3 đơn"]);
  assert.equal(buoc[2].ngay, "2026-10-21T04:42:00Z");
  // Đóng gói xong hết, chưa xuất: Xuất kho đang làm; xuất hết: xong
  const dg = dsDonTrongPhieu({ danhSachDonHang: [don("A", 8), don("B", 8)] });
  assert.deepEqual(tinhBuoc(xong, { quyen: tinhQuyen(xong), dsDon: dg, tienDo }).slice(3).map((b) => b.trangThai), ["xong", "dangLam"]);
  const xk = dsDonTrongPhieu({ danhSachDonHang: [don("A", 3), don("B", 5)] });
  assert.deepEqual(tinhBuoc(xong, { quyen: tinhQuyen(xong), dsDon: xk, tienDo }).slice(3).map((b) => b.trangThai), ["xong", "xong"]);
  const moiDong = dsDonTrongPhieu({ danhSachDonHang: [don("A", 7)] });
  assert.deepEqual(tinhBuoc(xong, { quyen: tinhQuyen(xong), dsDon: moiDong, tienDo }).slice(3).map((b) => b.trangThai), ["dangLam", "chua"]);
  assert.deepEqual(tinhBuoc(null, { quyen: tinhQuyen(null), dsDon: [], tienDo }), []);
});

test("nhanBangChung: chỉ đơn chờ đóng gói / chờ xuất kho", () => {
  assert.equal(nhanBangChung({ trangThai: 1 }), null);
  assert.equal(nhanBangChung(null), null);
  assert.deepEqual(nhanBangChung({ trangThai: 7, daDuBangChung: false, yeuCauVideo: true }), { du: false, nhan: "Cần video 15 giây – 3 phút" });
  assert.deepEqual(nhanBangChung({ trangThai: 7, daDuBangChung: false, yeuCauVideo: false }), { du: false, nhan: "Cần 2 ảnh" });
  assert.deepEqual(nhanBangChung({ trangThai: 8, daDuBangChung: true }), { du: true, nhan: "Đủ bằng chứng" });
});

test("nhanBangChung: đơn đã qua đóng gói chỉ xem lại, không báo thiếu; Nháp / đã hủy không hiện", () => {
  for (const tt of [2, 3, 5, 6]) {
    assert.deepEqual(nhanBangChung({ trangThai: tt, daDuBangChung: true }), { du: true, chiXem: true, nhan: "Đủ bằng chứng" });
    assert.deepEqual(nhanBangChung({ trangThai: tt, daDuBangChung: false, yeuCauVideo: true }), { du: false, chiXem: true, nhan: "Xem lại" });
  }
  assert.equal(nhanBangChung({ trangThai: 0 }), null);
  assert.equal(nhanBangChung({ trangThai: 4, daDuBangChung: true }), null);
});

test("ketQuaHoanTatNhat: chỉ còn đơn bị bỏ qua", () => {
  const cu = phieu();
  assert.deepEqual(ketQuaHoanTatNhat({ danhSachMaDonHang: ["A", "B"], donChuaTaoPhieuXuat: ["B"] }, cu), { daTao: ["A"], boQua: ["B"] });
  assert.deepEqual(ketQuaHoanTatNhat({}, cu), { daTao: ["SHP-1021", "SO-2", "SHP-1022"], boQua: [] });
  assert.deepEqual(ketQuaHoanTatNhat(null, null), { daTao: [], boQua: [] });
});

test("cauMayChuPhieuNhat: bỏ chữ tiếng Anh, giữ phần còn lại nguyên văn", () => {
  const c = cauMayChuPhieuNhat;
  assert.equal(c("Không tìm thấy đợt nhặt hàng Pick List ID: 9"), "Không tìm thấy phiếu nhặt hàng mã số 9");
  assert.equal(c("Bạn không có quyền quét nhặt hàng cho Pick List thuộc kho khác"), "Bạn không có quyền quét nhặt hàng cho phiếu nhặt hàng thuộc kho khác");
  assert.equal(c("Bạn không có quyền thao tác trên Pick List thuộc kho khác"), "Bạn không có quyền thao tác trên phiếu nhặt hàng thuộc kho khác");
  assert.equal(c("Không tìm thấy đợt nhặt hàng (Pick List ID)"), "Không tìm thấy phiếu nhặt hàng");
  assert.equal(c("Đợt nhặt hàng này đã hoàn tất quá trình nhặt hàng"), "Phiếu nhặt hàng này đã hoàn tất quá trình nhặt hàng");
  assert.equal(c("Nhân viên kho chỉ có quyền tự nhận việc (Self-assignment)"), "Nhân viên kho chỉ có quyền tự nhận việc");
  assert.equal(c("Đã quét 1x Áo Thun Oversize [AT-DEN-M] (2/3)"), "Đã quét 1 × Áo Thun Oversize [AT-DEN-M] (2/3)");
  assert.equal(c("Không thể phân công lại cho đợt nhặt hàng đã ở trạng thái: da_nhat"), "Không thể phân công lại cho phiếu nhặt hàng đã ở trạng thái: Đã nhặt");
  assert.equal(c("trạng thái: ma_la"), "trạng thái: ma_la");
  assert.equal(c("Mã vạch / SKU [ZZZ] không thuộc danh sách mặt hàng cần nhặt của đợt này!"), "Mã vạch / SKU [ZZZ] không thuộc danh sách mặt hàng cần nhặt của phiếu nhặt hàng này!");
  assert.equal(
    c("Toàn bộ đơn hàng trong đợt nhặt PL-0012 đã bị hủy! Vui lòng dừng nhặt và cất toàn bộ hàng đã lấy về kệ."),
    "Toàn bộ đơn hàng trong phiếu nhặt hàng PL-0012 đã bị hủy! Vui lòng dừng nhặt và cất toàn bộ hàng đã lấy về kệ.",
  );
  assert.equal(
    c("Toàn bộ đơn hàng trong đợt đã bị hủy! Toàn bộ phiếu xuất đã bị thu hồi."),
    "Toàn bộ đơn hàng trong phiếu nhặt hàng đã bị hủy! Toàn bộ phiếu xuất đã bị thu hồi.",
  );
  assert.ok(!/đợt/i.test(c("Đợt nhặt PL-1 của đợt này, trong đợt nhặt hàng PL-2")));
  assert.equal(c(""), "");
  assert.equal(c(null), null);
  assert.ok(!/Pick List|Self-assignment/i.test(c("Pick List PICK LIST pick list (Self-assignment)")));
});

test("cauMayChuKhongThay: bỏ câu thuộc kho khác (mô tả chuẩn đã nói), lọc chữ câu còn lại", () => {
  assert.equal(cauMayChuKhongThay("Bạn không có quyền truy cập Pick List thuộc kho khác"), null);
  assert.equal(cauMayChuKhongThay("Không tìm thấy đợt nhặt hàng Pick List ID: 4"), "Không tìm thấy phiếu nhặt hàng mã số 4");
  assert.equal(cauMayChuKhongThay(null), null);
  assert.equal(cauMayChuKhongThay(""), null);
});

test("cauQuetThanhCong: lọc chữ câu máy chủ", () => {
  assert.equal(cauQuetThanhCong({ thongBao: "Đã quét 2x Áo [A] (2/3)" }, "A", 2), "Đã quét 2 × Áo [A] (2/3)");
});

test("hangTraKe: thêm màu / kích cỡ theo SKU", () => {
  const ds = hangTraKe([{ sku: "AK-A", tenSanPham: "Áo khoác", soLuong: "1.000" }, { sku: "ZZ", soLuong: 2 }], phieu().chiTietNhatHangs);
  assert.deepEqual(ds.map(({ ten, bienThe, sku, soLuong }) => [ten, bienThe, sku, soLuong]), [
    ["Áo khoác", "Đen / M", "AK-A", 1],
    ["ZZ", "", "ZZ", 2],
  ]);
  assert.deepEqual(hangTraKe(undefined, []), []);
});

test("themCanhBaoHuy: giữ cảnh báo của từng đơn, cùng đơn thì thay, cả phiếu chỉ một", () => {
  let ds = themCanhBaoHuy(null, { loai: "donNhat", soDonHang: "A", hangCanTraKe: [{ sku: "X", soLuong: 1 }] });
  ds = themCanhBaoHuy(ds, { loai: "donNhat", soDonHang: "B", hangCanTraKe: [] });
  assert.deepEqual(ds.map((c) => c.soDonHang), ["A", "B"]);
  ds = themCanhBaoHuy(ds, { loai: "donNhat", soDonHang: "A", hangCanTraKe: [{ sku: "X", soLuong: 2 }] });
  assert.deepEqual(ds.map((c) => c.soDonHang), ["B", "A"]);
  assert.equal(ds.find((c) => c.soDonHang === "A").hangCanTraKe[0].soLuong, 2);
  ds = themCanhBaoHuy(ds, { loai: "donDongGoi", soDonHang: "A" });
  ds = themCanhBaoHuy(ds, { loai: "caPhieu", message: "m1" });
  ds = themCanhBaoHuy(ds, { loai: "caPhieu", message: "m2" });
  assert.deepEqual(ds.map((c) => c.loai), ["donNhat", "donNhat", "donDongGoi", "caPhieu"]);
  assert.equal(ds.at(-1).message, "m2");
  assert.equal(themCanhBaoHuy(ds, null), ds);
});

test("gopCanhBaoHuy: mỗi loại một dòng, nối số đơn, cộng hàng trả kệ cùng SKU", () => {
  const ds = [
    { loai: "donNhat", soDonHang: "A", hangCanTraKe: [{ sku: "X", tenSanPham: "Áo", soLuong: 1 }, { sku: "Y", soLuong: "2" }] },
    { loai: "donDongGoi", soDonHang: "C" },
    { loai: "donNhat", soDonHang: "B", hangCanTraKe: [{ sku: "X", soLuong: 3 }, null] },
    { loai: "caPhieu", message: "Hủy hết" },
  ];
  const gop = gopCanhBaoHuy(ds);
  assert.deepEqual(gop.map((c) => c.loai), ["caPhieu", "donNhat", "donDongGoi"]);
  assert.equal(gop[0].message, "Hủy hết");
  assert.deepEqual([gop[1].soDonHang, gop[1].soDon], ["A, B", 2]);
  assert.deepEqual(gop[1].hangCanTraKe.map((h) => [h.sku, h.soLuong]), [["X", 4], ["Y", "2"]]);
  assert.equal(gop[1].hangCanTraKe[0].tenSanPham, "Áo");
  assert.deepEqual([gop[2].soDonHang, gop[2].soDon, gop[2].hangCanTraKe], ["C", 1, []]);
  // Không sửa dữ liệu gốc
  assert.equal(ds[0].hangCanTraKe[0].soLuong, 1);
  assert.deepEqual(gopCanhBaoHuy(null), []);
});

test("loiQuetCanTaiLai: 409 hoặc 400 báo phiếu đã đổi trạng thái; lỗi quét thường gặp không tải lại", () => {
  assert.equal(loiQuetCanTaiLai(409, "Phiếu nhặt PL-1 đang giao cho An."), true);
  for (const cau of [
    "Đợt nhặt hàng này đã hoàn tất quá trình nhặt hàng",
    "Đợt nhặt hàng này đã được xuất kho",
    "Đợt nhặt hàng này đã bị hủy",
    "Đợt nhặt hàng không có mặt hàng nào cần nhặt",
  ]) {
    assert.equal(loiQuetCanTaiLai(400, cau), true, cau);
  }
  for (const cau of [
    "Mã vạch / SKU [ZZZ] không thuộc danh sách mặt hàng cần nhặt của đợt này!",
    "Mặt hàng [AT-DEN-M] đã nhặt đủ số lượng yêu cầu (3/3)!",
    "Số lượng quét vượt quá yêu cầu (Đã quét: 2, Quét thêm: 5, Cần nhặt: 3)",
  ]) {
    assert.equal(loiQuetCanTaiLai(400, cau), false, cau);
  }
  assert.equal(loiQuetCanTaiLai(500, "Đợt nhặt hàng này đã bị hủy"), false);
  assert.equal(loiQuetCanTaiLai(null, "Không quét được mã X: không nhận được phản hồi từ máy chủ."), false);
  assert.equal(loiQuetCanTaiLai(400, null), false);
});

// ── Phiếu nhặt của phiếu chuyển kho (loaiPhieu CHUYEN_KHO): không có đơn, không đóng gói, xuất ở phiếu chuyển ──

const phieuChuyen = (extra = {}) => phieu({
  loaiPhieu: "CHUYEN_KHO",
  phieuChuyenKhoId: 50,
  soPhieuChuyen: "PX-TRF-202610281",
  trangThaiPhieuChuyen: "DA_DUYET",
  tenKhoNhan: "Cửa hàng 1",
  phieuXuatKhoId: 60,
  soPhieuXuat: "PX-CK-202610281",
  tongDonHang: 0,
  danhSachMaDonHang: [],
  ...extra,
});

test("nguonPhieuNhat: phiếu chuyển kho ghi Chuyển kho + số phiếu chuyển, không bao giờ 0 đơn", () => {
  assert.equal(laPhieuChuyenKho(phieuChuyen()), true);
  assert.equal(laPhieuChuyenKho(phieu()), false);
  assert.equal(laPhieuChuyenKho(phieu({ loaiPhieu: "BAN_HANG" })), false);
  assert.deepEqual(nguonPhieuNhat(phieuChuyen()), {
    chuyenKho: true, nhan: "Chuyển kho", phu: "PX-TRF-202610281 → Cửa hàng 1", title: "PX-TRF-202610281",
  });
  assert.equal(nguonPhieuNhat(phieuChuyen({ tenKhoNhan: null })).phu, "PX-TRF-202610281");
  const ban = nguonPhieuNhat(phieu({ tongDonHang: 3 }));
  assert.equal(ban.chuyenKho, false);
  assert.equal(ban.nhan, "3 đơn");
  assert.equal(ban.phu, "SHP-1021, SO-2 +1");
  assert.equal(ban.title, "SHP-1021, SO-2, SHP-1022");
  assert.equal(nguonPhieuNhat(phieu({ tongDonHang: undefined, danhSachMaDonHang: ["A"] })).nhan, "1 đơn");
  assert.deepEqual(LOC_LOAI_PHIEU_NHAT.map((o) => o.value), ["", "BAN_HANG", "CHUYEN_KHO"]);
});

test("tinhBuoc phiếu chuyển kho: 4 bước, không có Đóng gói, Xuất kho theo phiếu chuyển", () => {
  const tienDo = { da: 2, can: 5, pct: 40 };
  const nhan = (ds) => ds.map((b) => b.nhan);
  const tt = (ds) => ds.map((b) => b.trangThai);
  const mo = phieuChuyen();
  let buoc = tinhBuoc(mo, { quyen: tinhQuyen(mo, { idToi: 8 }), dsDon: [], tienDo });
  assert.deepEqual(nhan(buoc), ["Tạo phiếu", "Phân công", "Nhặt hàng", "Xuất kho"]);
  assert.deepEqual(tt(buoc), ["xong", "xong", "dangLam", "chua"]);
  assert.equal(buoc[2].phu, "2/5 sản phẩm");
  const chua = phieuChuyen({ nguoiNhatId: null, trangThai: "cho_nhat" });
  buoc = tinhBuoc(chua, { quyen: tinhQuyen(chua), dsDon: [], tienDo });
  assert.deepEqual(tt(buoc), ["xong", "dangLam", "chua", "chua"]);
  const xong = phieuChuyen({ trangThai: "da_nhat", ngayHoanTat: "2026-10-28T04:42:00Z" });
  buoc = tinhBuoc(xong, { quyen: tinhQuyen(xong), dsDon: [], tienDo: { da: 5, can: 5, pct: 100 } });
  assert.deepEqual(tt(buoc), ["xong", "xong", "xong", "dangLam"]);
  assert.equal(buoc[3].phu, "Chờ xác nhận ở phiếu chuyển");
  const daXuat = phieuChuyen({ trangThai: "da_nhat", trangThaiPhieuChuyen: "DANG_VAN_CHUYEN" });
  assert.equal(phieuChuyenDaXuat(daXuat), true);
  buoc = tinhBuoc(daXuat, { quyen: tinhQuyen(daXuat), dsDon: [], tienDo });
  assert.deepEqual([buoc[3].trangThai, buoc[3].phu], ["xong", "Đã xuất"]);
  assert.equal(phieuChuyenDaXuat(phieuChuyen({ trangThaiPhieuChuyen: "DA_HUY" })), false);
  const huy = phieuChuyen({ trangThai: "da_huy", trangThaiPhieuChuyen: "DA_HUY" });
  buoc = tinhBuoc(huy, { quyen: tinhQuyen(huy), dsDon: [], tienDo });
  assert.deepEqual(tt(buoc), ["xong", "xong", "dung", "chua"]);
});

test("phiếu chuyển hủy khi hàng đang đi: phiếu nhặt Đã nhặt coi như đã xuất, câu riêng", () => {
  const tienDo = { da: 5, can: 5, pct: 100 };
  // Máy chủ chỉ giữ phiếu nhặt Đã nhặt khi phiếu chuyển hủy lúc Đang vận chuyển (hủy lúc Đã duyệt thì hủy cả phiếu nhặt)
  const huyDangDi = phieuChuyen({ trangThai: "da_nhat", trangThaiPhieuChuyen: "DA_HUY" });
  assert.equal(phieuChuyenHuyKhiDangDi(huyDangDi), true);
  const buoc = tinhBuoc(huyDangDi, { quyen: tinhQuyen(huyDangDi), dsDon: [], tienDo });
  assert.deepEqual(buoc.map((b) => b.trangThai), ["xong", "xong", "xong", "xong"]);
  assert.equal(buoc[3].phu, "Đã xuất · phiếu chuyển đã hủy");
  assert.deepEqual(dongDaNhatChuyenKho(huyDangDi), {
    tone: "neutral",
    cau: "Đã nhặt xong và đã xuất kho. Phiếu chuyển PX-TRF-202610281 đã hủy khi hàng đang đi, kho xuất nhập hoàn trả.",
  });
  // Không còn nhắc bấm Xác nhận xuất ở phiếu chuyển đã hủy
  assert.doesNotMatch(dongDaNhatChuyenKho(huyDangDi).cau, /Xác nhận xuất/);
  assert.equal(
    dongDaNhatChuyenKho(phieuChuyen({ trangThai: "da_nhat", trangThaiPhieuChuyen: "DA_HUY", soPhieuChuyen: null })).cau,
    "Đã nhặt xong và đã xuất kho. Phiếu chuyển đã hủy khi hàng đang đi, kho xuất nhập hoàn trả.",
  );

  // Phiếu nhặt đã hủy, còn mở, hoặc phiếu bán: không phải trường hợp này
  assert.equal(phieuChuyenHuyKhiDangDi(phieuChuyen({ trangThai: "da_huy", trangThaiPhieuChuyen: "DA_HUY" })), false);
  assert.equal(phieuChuyenHuyKhiDangDi(phieuChuyen({ trangThai: "dang_nhat", trangThaiPhieuChuyen: "DA_HUY" })), false);
  assert.equal(phieuChuyenHuyKhiDangDi(phieuChuyen({ trangThai: "da_nhat", trangThaiPhieuChuyen: "DANG_VAN_CHUYEN" })), false);
  assert.equal(phieuChuyenHuyKhiDangDi(phieu({ trangThai: "da_nhat", trangThaiPhieuChuyen: "DA_HUY" })), false);
  assert.equal(phieuChuyenHuyKhiDangDi(null), false);
});

test("dòng Đã nhặt xong của phiếu chuyển kho: chờ xuất / đã xuất, thiếu số phiếu không để chỗ trống", () => {
  assert.deepEqual(dongDaNhatChuyenKho(phieuChuyen({ trangThai: "da_nhat" })), {
    tone: "ok",
    cau: "Đã nhặt xong, lô đã giữ cho phiếu xuất PX-CK-202610281. Bấm Xác nhận xuất ở phiếu chuyển PX-TRF-202610281 để hàng rời kho.",
  });
  assert.equal(
    dongDaNhatChuyenKho(phieuChuyen({ trangThai: "da_nhat", trangThaiPhieuChuyen: "HOAN_TAT" })).cau,
    "Đã nhặt xong và phiếu chuyển PX-TRF-202610281 đã xuất kho.",
  );
  const thieuSo = phieuChuyen({ trangThai: "da_nhat", soPhieuXuat: null, soPhieuChuyen: undefined });
  assert.equal(
    dongDaNhatChuyenKho(thieuSo).cau,
    "Đã nhặt xong, lô đã giữ cho phiếu xuất kho. Bấm Xác nhận xuất ở phiếu chuyển để hàng rời kho.",
  );
  assert.match(moTaHoanTatNhat(thieuSo), /giữ cho phiếu xuất kho; hàng chỉ rời kho khi bấm Xác nhận xuất ở phiếu chuyển\.$/);
  assert.doesNotMatch(moTaHoanTatNhat(thieuSo), / \.| {2}/);
});

test("hoàn tất nhặt: câu hộp xác nhận và thông báo nhanh theo loại phiếu", () => {
  assert.match(moTaHoanTatNhat(phieuChuyen()), /giữ cho phiếu xuất PX-CK-202610281/);
  assert.match(moTaHoanTatNhat(phieuChuyen()), /Xác nhận xuất ở phiếu chuyển PX-TRF-202610281/);
  assert.match(moTaHoanTatNhat(phieu()), /Chờ đóng gói/);
  const res = phieuChuyen({ trangThai: "da_nhat" });
  assert.deepEqual(thongBaoHoanTatNhat(res, ketQuaHoanTatNhat(res, res)), {
    loai: "success",
    tieuDe: "Đã hoàn tất nhặt PL-20261021-004",
    moTa: "Đã giữ lô cho PX-CK-202610281. Bấm Xác nhận xuất ở phiếu chuyển PX-TRF-202610281.",
  });
  const ban = phieu({ trangThai: "da_nhat", donChuaTaoPhieuXuat: ["SO-2"] });
  assert.deepEqual(thongBaoHoanTatNhat(ban, ketQuaHoanTatNhat(ban, ban)), {
    loai: "success", tieuDe: "Đã hoàn tất nhặt PL-20261021-004", moTa: "Đã tạo phiếu xuất kho nháp cho 2 đơn",
  });
  assert.equal(thongBaoHoanTatNhat(phieu({ trangThai: "da_huy" }), { daTao: [] }).loai, "warning");
  assert.equal(thongBaoHoanTatNhat(phieu({ trangThai: "da_nhat", danhSachMaDonHang: [] }), { daTao: [] }).moTa, undefined);
});
