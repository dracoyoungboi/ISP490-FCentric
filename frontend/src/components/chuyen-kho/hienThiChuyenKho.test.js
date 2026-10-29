// Chạy: node --test src/components/chuyen-kho/hienThiChuyenKho.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    aiXuLyChenhLech,
    buocChuyenKho,
    cheGiua,
    chuanSoDem,
    kiemTraGhiSoXknb,
    kiemTraXacNhanXuat,
    nhanPhieuXuatLienQuan,
    quetMotMa,
    tinhNhanHang,
    tinhNhatChuyenKho,
    treBaoLau,
    tuONgayGio,
    yeuCauNhanLech,
} from "./hienThiChuyenKho.js";

const ct = (them = {}) => ({
    trangThai: "CHO_DUYET",
    ngayTao: "2026-10-23T02:00:00Z",
    khoXuat: { ten: "Kho tổng" },
    khoNhap: { ten: "Kho Hà Nội" },
    hang: [{ soLuongChuyen: 10, daNhat: 4 }, { soLuongChuyen: 5, daNhat: 0 }],
    phieuNhap: [],
    ...them,
});

const trangThaiBuoc = (ds) => ds.map((b) => b.trangThai);

test("tiến trình theo bản demo: bước đang làm của từng trạng thái", () => {
    assert.deepEqual(trangThaiBuoc(buocChuyenKho(ct())), ["dangLam", "chua", "chua", "chua", "chua"]);
    const daDuyet = buocChuyenKho(ct({ trangThai: "DA_DUYET", soLenhDieuDong: "LDD-20261023-001" }));
    assert.deepEqual(trangThaiBuoc(daDuyet), ["xong", "dangLam", "chua", "chua", "chua"]);
    assert.equal(daDuyet[2].phu, "Đã nhặt 4/15");
    assert.deepEqual(trangThaiBuoc(buocChuyenKho(ct({ trangThai: "DANG_VAN_CHUYEN" }))), ["xong", "xong", "xong", "dangLam", "chua"]);
    const lech = buocChuyenKho(ct({ trangThai: "CHO_XU_LY_LECH" }));
    assert.deepEqual(trangThaiBuoc(lech), ["xong", "xong", "xong", "xong", "dangLam"]);
    assert.equal(lech[4].canhBao, "Có chênh lệch");
    assert.deepEqual(trangThaiBuoc(buocChuyenKho(ct({ trangThai: "HOAN_TAT" }))), ["xong", "xong", "xong", "xong", "xong"]);
});

test("phiếu hủy dừng đúng bước: chưa có lệnh, đã có lệnh, hủy khi hàng đang đi", () => {
    const chuaLenh = buocChuyenKho(ct({ trangThai: "DA_HUY" }));
    assert.deepEqual(trangThaiBuoc(chuaLenh), ["xong", "dung", "chua", "chua", "chua"]);
    assert.equal(chuaLenh[1].canhBao, "Đã hủy");
    assert.equal(chuaLenh[1].phu, undefined);
    const coLenh = buocChuyenKho(ct({ trangThai: "DA_HUY", soLenhDieuDong: "LDD-1" }));
    assert.equal(coLenh[2].trangThai, "dung");
    const dangDi = buocChuyenKho(ct({ trangThai: "DA_HUY", soLenhDieuDong: "LDD-1", huyKhiDangChuyen: true }));
    assert.equal(dangDi[3].trangThai, "dung");
    assert.equal(dangDi[3].canhBao, "Đã hủy · chờ nhập hoàn trả");
    assert.equal(buocChuyenKho(ct({ trangThai: "DA_HUY", huyKhiDangChuyen: true, daNhapHoanTra: true }))[3].canhBao, "Đã hủy · đã nhập hoàn trả");
});

test("trễ hẹn ghi ở bước vận chuyển", () => {
    const bayGio = Date.parse("2026-10-23T10:00:00Z");
    const ds = buocChuyenKho(ct({ trangThai: "DANG_VAN_CHUYEN", tre: true, ngayDuKienDen: "2026-10-23T07:00:00Z" }), bayGio);
    assert.equal(ds[3].canhBao, "trễ 3 giờ");
    assert.equal(treBaoLau("2026-10-20T10:00:00Z", bayGio), "trễ 3 ngày");
    assert.equal(treBaoLau("2026-10-23T09:30:00Z", bayGio), "trễ");
});

test("nhặt hàng của phiếu Đã duyệt: phiếu nhặt mở / đã nhặt / phiếu cũ chọn lô tay / chưa có phiếu nhặt", () => {
    const daDuyet = (them) => ct({ trangThai: "DA_DUYET", soLenhDieuDong: "LDD-1", ...them });
    const pn = (trangThai, nguoi = "Thủ kho A") => ({ id: 80, so: "PL-20261028-001", trangThai, nguoi });

    const choNhat = tinhNhatChuyenKho(daDuyet({ phieuNhat: pn("cho_nhat", null), daNhatXong: false, hang: [{ soLuongChuyen: 15, daNhat: 0 }] }));
    assert.equal(choNhat.nhanNut, "Mở phiếu nhặt");
    assert.equal(choNhat.duocXuat, false);
    assert.equal(choNhat.lyDoKhoaXuat, "Hoàn tất phiếu nhặt PL-20261028-001 trước khi xác nhận xuất");
    assert.equal(choNhat.tienDo, "Chờ nhặt · chưa phân công");

    const dangNhat = tinhNhatChuyenKho(daDuyet({ phieuNhat: pn("dang_nhat"), daNhatXong: false }));
    assert.equal(dangNhat.tienDo, "Đang nhặt 4/15");
    assert.equal(dangNhat.tenTrangThai, "Đang nhặt");
    assert.equal(buocChuyenKho(daDuyet({ phieuNhat: pn("dang_nhat"), daNhatXong: false }))[2].phu, "Đang nhặt 4/15");

    const xong = tinhNhatChuyenKho(daDuyet({ phieuNhat: pn("da_nhat"), daNhatXong: true }));
    assert.equal(xong.nhanNut, "Xem phiếu nhặt");
    assert.equal(xong.duocXuat, true);
    assert.equal(xong.lyDoKhoaXuat, undefined);
    assert.equal(xong.tienDo, "Đã nhặt xong, chờ xác nhận xuất");
    // phiếu đủ số đã nhặt mà phiếu nhặt chưa hoàn tất: máy chủ báo chưa được xuất thì giữ khóa
    assert.equal(tinhNhatChuyenKho(daDuyet({ phieuNhat: pn("dang_nhat"), daNhatXong: false, hang: [{ soLuongChuyen: 5, daNhat: 5 }] })).duocXuat, false);

    const tay = tinhNhatChuyenKho(daDuyet({ chonLoTay: true, daNhatXong: false }));
    assert.equal(tay.nhanNut, "Chọn lô");
    assert.equal(tay.lyDoKhoaXuat, "Chọn đủ lô cho 15 sản phẩm trước khi xác nhận xuất");
    assert.equal(tinhNhatChuyenKho(daDuyet({ chonLoTay: true, daNhatXong: true })).nhanNut, "Xem phiếu xuất");

    const chuaCo = tinhNhatChuyenKho(daDuyet({ daNhatXong: false, hang: [{ soLuongChuyen: 15, daNhat: 0 }] }));
    assert.equal(chuaCo.phieuNhat, null);
    assert.equal(chuaCo.nhanNut, "Mở phiếu nhặt");
    assert.equal(chuaCo.lyDoKhoaXuat, "Mở phiếu nhặt, nhặt đủ hàng trước khi xác nhận xuất");
    // phiếu nhặt đã hủy (dữ liệu lệch) coi như chưa có
    assert.equal(tinhNhatChuyenKho(daDuyet({ phieuNhat: pn("da_huy") })).phieuNhat, null);
    // máy chủ cũ chưa gửi daNhatXong: đủ số đã nhặt thì cho xuất
    assert.equal(tinhNhatChuyenKho(daDuyet({ hang: [{ soLuongChuyen: 5, daNhat: 5 }] })).duocXuat, true);
});

test("nhãn phiếu xuất ở chứng từ liên quan theo bước nhặt, không ghi 'chờ nhặt' khi đã nhặt / đã xuất / đã hủy", () => {
    const px = (trangThai) => ({ id: 60, so: "PX-CK-202610281", trangThai });
    const pn = (trangThai) => ({ id: 80, so: "PL-20261028-001", trangThai });
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(0), phieuNhat: pn("cho_nhat") })), "Phiếu xuất kho · chờ nhặt");
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(0), phieuNhat: pn("dang_nhat") })), "Phiếu xuất kho · đang nhặt");
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(0), phieuNhat: pn("da_nhat") })), "Phiếu xuất kho · đã nhặt");
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(3), phieuNhat: pn("da_nhat") })), "Phiếu xuất kho");
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px("4"), phieuNhat: pn("da_huy") })), "Phiếu xuất kho");
    // phiếu cũ chọn lô tay (không có phiếu nhặt), phiếu nhặt đã hủy: không đoán bước nhặt
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(0), chonLoTay: true })), "Phiếu xuất kho");
    assert.equal(nhanPhieuXuatLienQuan(ct({ phieuXuat: px(0), phieuNhat: pn("da_huy") })), "Phiếu xuất kho");
});

const formXuat = (them = {}) => ({
    hinhThuc: "XE_CONG_TY", nguoi: "Nguyễn Văn Tài", sdt: "0912 345 678", loaiPhuongTien: "Xe tải 1,5 tấn", bienSo: "29H-123.45",
    duKienDen: "2026-10-23T16:00", kyHieu: "6k26nab", soXknb: "0000125", ...them,
});

test("xác nhận xuất: đủ thông tin thì ra thân yêu cầu, ký hiệu viết hoa, số điện thoại bỏ khoảng trắng", () => {
    const kq = kiemTraXacNhanXuat(formXuat(), "CHAN");
    assert.deepEqual(kq.loi, {});
    assert.equal(kq.yeuCau.kyHieuXknb, "6K26NAB");
    assert.equal(kq.yeuCau.soDienThoaiVanChuyen, "0912345678");
    assert.equal(kq.yeuCau.donViVanChuyen, null);
    assert.equal(kq.yeuCau.vanXuatKhiChuaCoSo, null);
    assert.equal(kq.yeuCau.ngayDuKienDen, new Date(2026, 9, 23, 16, 0).toISOString());
});

test("xác nhận xuất: bắt buộc theo hình thức vận chuyển", () => {
    const cp = kiemTraXacNhanXuat(formXuat({ hinhThuc: "CHUYEN_PHAT", loaiPhuongTien: "", bienSo: "" }), "CHAN");
    assert.equal(cp.loi.donVi, "Nhập tên đơn vị");
    assert.equal(cp.loi.maVanDon, "Nhập mã vận đơn");
    assert.equal(cp.loi.bienSo, undefined);
    const thue = kiemTraXacNhanXuat(formXuat({ hinhThuc: "THUE_NGOAI", bienSo: "" }), "CHAN");
    assert.ok(thue.loi.donVi && thue.loi.bienSo);
    assert.ok(kiemTraXacNhanXuat(formXuat({ sdt: "0123456789" }), "CHAN").loi.sdt);
    assert.ok(kiemTraXacNhanXuat(formXuat({ kyHieu: "6K26AB" }), "CHAN").loi.kyHieu);
    assert.ok(kiemTraXacNhanXuat(formXuat({ soXknb: "125" }), "CHAN").loi.soXknb);
});

test("chưa có số XKNB: Chặn xuất báo lỗi; Chỉ cảnh báo hỏi lại rồi mới gửi kèm vanXuatKhiChuaCoSo", () => {
    const chan = kiemTraXacNhanXuat(formXuat({ kyHieu: "", soXknb: "" }), "CHAN");
    assert.match(chan.chan, /trước khi hàng rời kho/);
    assert.equal(chan.yeuCau, null);
    const lan1 = kiemTraXacNhanXuat(formXuat({ soXknb: "" }), "CHI_CANH_BAO");
    assert.equal(lan1.canhBaoThieu, true);
    assert.equal(lan1.yeuCau, null);
    const lan2 = kiemTraXacNhanXuat(formXuat({ soXknb: "" }), "CHI_CANH_BAO", true);
    assert.equal(lan2.yeuCau.vanXuatKhiChuaCoSo, true);
    assert.equal(lan2.yeuCau.kyHieuXknb, null);
    assert.equal(lan2.yeuCau.ngayLapXknb, null);
});

test("ghi số XKNB bắt buộc đúng định dạng", () => {
    assert.ok(kiemTraGhiSoXknb({ kyHieu: "", soXknb: "" }).loi.kyHieu);
    const ok = kiemTraGhiSoXknb({ kyHieu: "6c26nab", soXknb: "0000001", ngayLap: "2026-10-23" });
    assert.deepEqual(ok.yeuCau, { kyHieuXknb: "6C26NAB", soPhieuXknb: "0000001", ngayLapXknb: "2026-10-23", maTraCuuXknb: null });
});

const lo = [
    { bienTheId: 1, loHangId: 11, sku: "AT-01", maVach: "893001", soLuong: 5 },
    { bienTheId: 1, loHangId: 12, sku: "AT-01", maVach: "893001", soLuong: 2 },
    { bienTheId: 2, loHangId: 21, sku: "QJ-02", maVach: "893002", soLuong: 3 },
];

test("nhận hàng: khớp đủ thì nhận đủ; thiếu, hỏng thì cần lý do; vượt số gửi chặn", () => {
    const du = tinhNhanHang(lo, { "1-11": { dat: 5, hong: 0 }, "1-12": { dat: 2, hong: 0 }, "2-21": { dat: 3, hong: 0 } });
    assert.equal(du.khop, true);
    const lech = tinhNhanHang(lo, { "1-11": { dat: 5, hong: 0 }, "1-12": { dat: 1, hong: 0 }, "2-21": { dat: 2, hong: 1, lyDo: "rách" } });
    assert.equal(lech.khop, false);
    assert.equal(lech.soDongLech, 2);
    assert.deepEqual(lech.tong, { gui: 10, dat: 8, hong: 1, thieu: 1 });
    assert.equal(lech.dong[1].thieuLyDo, true);
    assert.equal(lech.dong[2].thieuLyDo, false);
    assert.equal(tinhNhanHang(lo, { "2-21": { dat: 4, hong: 0 } }).vuot, true);
    assert.equal(tinhNhanHang([], {}).khop, false);
    const body = yeuCauNhanLech(lech, { nguoiVanChuyen: " Tài ", thoiDiem: "2026-10-23T15:40", ketLuan: "" });
    assert.deepEqual(body.dong[0], { bienTheSanPhamId: 1, loHangId: 11, soLuongDat: 5, soLuongHong: 0, lyDo: null });
    assert.equal(body.dong[2].lyDo, "rách");
    assert.equal(body.nguoiVanChuyen, "Tài");
    assert.equal(body.ketLuan, null);
});

test("quét mã cộng vào lô còn thiếu trước, hết thì cộng vào lô đầu (để báo vượt)", () => {
    let dem = { "1-11": { dat: 5, hong: 0 } };
    const kq = quetMotMa(lo, dem, "893001");
    assert.equal(kq.khop.loHangId, 12);
    assert.equal(kq.dem["1-12"].dat, 1);
    dem = { "1-11": { dat: 5 }, "1-12": { dat: 2 } };
    const vuot = quetMotMa(lo, dem, "at-01");
    assert.equal(vuot.vuot, true);
    assert.equal(vuot.dem["1-11"].dat, 6);
    assert.equal(quetMotMa(lo, dem, "khong-co").khop, null);
});

test("tiện ích nhỏ", () => {
    assert.equal(cheGiua("0912345678"), "091****678");
    assert.equal(chuanSoDem("1a2"), 12);
    assert.equal(chuanSoDem(""), 0);
    assert.equal(tuONgayGio(""), null);
    assert.equal(tuONgayGio("abc"), undefined);
    // Ai xử lý chênh lệch: theo câu máy chủ gửi; máy chủ cũ chưa gửi thì theo cấu hình mặc định
    assert.equal(aiXuLyChenhLech(ct({ aiXuLyChenhLech: "Quản trị viên" })), "Quản trị viên");
    assert.equal(aiXuLyChenhLech(ct()), "Quản trị viên hoặc Quản lý Kho tổng");
    assert.equal(aiXuLyChenhLech(ct({ aiXuLyChenhLech: "  " })), "Quản trị viên hoặc Quản lý Kho tổng");
    assert.equal(aiXuLyChenhLech(null), "Quản trị viên hoặc Quản lý Kho tổng");
});
