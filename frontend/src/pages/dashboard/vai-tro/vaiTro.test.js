// Chạy: node --test src/pages/dashboard/vai-tro/vaiTro.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bienDongDiem,
  bienDongO,
  boDau,
  buocQuyTrinh,
  chuYDon,
  diemTheoGio,
  dongViecQuanLyKho,
  giaBan,
  guiLuc,
  hanhDongBoSung,
  khoangCho,
  lichTheoNgay,
  moTaBoSung,
  nhanGio,
  nhanNgay,
  nhomHangSapVe,
  oNghiepVu,
  soNgayGiua,
  tenNgay,
  theSoBanHang,
  theSoMuaHang,
  theSoQuanLyKho,
  thoiDiemNgan,
  vachGio,
  vachTron,
  viecChungDong,
} from "./soLieuVaiTro.js";

const gon = (s) => String(s).replace(/\s/g, " ");
const BAY_GIO = "2026-10-17T15:25:00"; // Thứ Bảy
const CAU_HINH = { gioChoLau: 2, ngayChoBaoGia: 2, ngayTheoDoiBaoGia: 3 };
const CUA_HANG = { id: 910001, tenKho: "Cửa hàng", laKhoTong: false, khoTongId: 22 };
const KHO_TONG = { id: 22, tenKho: "Kho tổng", laKhoTong: true, khoTongId: 22 };
const bay = (gt) => gt.map((v, i) => ({ ngay: `2026-10-${String(11 + i).padStart(2, "0")}`, giaTri: v }));

test("ngày giờ: nhãn ngày, mốc ngắn, khoảng chờ", () => {
  assert.equal(soNgayGiua("2026-10-15", BAY_GIO), 2);
  assert.equal(nhanNgay("2026-10-17", BAY_GIO), "Hôm nay");
  assert.equal(nhanNgay("2026-10-11", BAY_GIO), "CN 11/10");
  assert.equal(tenNgay("2026-10-18", BAY_GIO), "Ngày mai");
  assert.equal(tenNgay("2026-10-19", BAY_GIO), "Thứ Hai 19/10");
  assert.equal(thoiDiemNgan("2026-10-17T08:10:00", BAY_GIO), "8:10");
  assert.equal(thoiDiemNgan("2026-10-16T16:40:00", BAY_GIO), "hôm qua 16:40");
  assert.equal(thoiDiemNgan("2026-10-12T16:40:00", BAY_GIO), "12/10");
  assert.equal(khoangCho("2026-10-17T13:10:00", BAY_GIO), "2 giờ 15 phút");
  assert.equal(khoangCho("2026-10-17T14:25:00", BAY_GIO), "1 giờ");
  assert.equal(khoangCho("2026-10-17T15:00:00", BAY_GIO), "25 phút");
  assert.equal(khoangCho("2026-10-14T15:00:00", BAY_GIO), "3 ngày");
  assert.equal(guiLuc("2026-10-17T09:05:00", BAY_GIO), "Gửi lúc 9:05");
  assert.equal(guiLuc("2026-10-16T09:05:00", BAY_GIO), "Gửi hôm qua");
  assert.equal(guiLuc("2026-10-13T09:05:00", BAY_GIO), "Gửi 4 ngày trước");
});

test("mức thay đổi: không dấu kèm mũi tên, 0% trung tính, kỳ trước 0 thì không ghi; điểm phần trăm", () => {
  assert.deepEqual(bienDongO(118, 100), { chu: "18%", len: true, tot: true });
  assert.deepEqual(bienDongO(94, 100), { chu: "6%", len: false, tot: false });
  assert.deepEqual(bienDongO(100, 100), { chu: "0%", len: null, tot: null });
  assert.equal(bienDongO(5, 0), null);
  assert.deepEqual(bienDongDiem(82, 87), { chu: "5 điểm", len: false, tot: false });
  assert.equal(bienDongDiem(82, null), null);
});

test("vạch trục tròn số", () => {
  assert.deepEqual(vachTron(0), [0, 1, 2, 3, 4], "chưa có số liệu: vạch nguyên, không trùng nhãn");
  assert.deepEqual(vachTron(5), [0, 2, 4, 6, 8]);
  assert.deepEqual(vachTron(30), [0, 10, 20, 30, 40]);
  assert.deepEqual(vachTron(1240), [0, 500, 1000, 1500, 2000]);
});

const QLK = {
  chiSo: {
    nhap: { homNay: 30, cungGioTruoc: 12, bayNgay: bay([0, 0, 0, 0, 0, 19, 30]), soChungTu: 1 },
    xuat: { homNay: 4, cungGioTruoc: 0, bayNgay: bay([3, 0, 0, 0, 0, 0, 4]), soChungTu: 1 },
    doanhThu: { homNay: 800000, cungGioTruoc: 400000, bayNgay: bay([0, 600000, 0, 0, 0, 0, 800000]), soChungTu: 2 },
    donChoXuat: { tong: 6, choLau: 4 },
  },
  tonKho: { khaDung: 55, giaTri: 1250000, soDong: 3, het: 1, thieu: 1, binhThuong: 0, du: 1 },
  nghiepVu: {
    nhanHang: { phieuChoNhap: 2, dangVe: 3, treHan: 1, dangChuyenDen: 1 },
    nhatHang: { choGomPhieu: 2, dangNhat: 1, chuaPhanCong: 1 },
    dongGoi: { choDongGoi: 1, choLau: 1 },
    xuatKho: { phieuChoXuat: 1, chuyenChoXuat: 0 },
    chuyenKho: { choDuyet: 2, choXuatHang: 1, dangVanChuyen: 2 },
    kiemKeDangMo: 0,
  },
};

test("quản lý kho – ô số: cửa hàng có doanh thu thay nhập kho; Kho tổng có nhập kho; đúng danh sách", () => {
  const ch = theSoQuanLyKho(QLK, CUA_HANG, CAU_HINH, BAY_GIO);
  assert.deepEqual(ch.map((t) => t.key), ["doanhThu", "xuat", "donChoXuat", "tonKho"]);
  assert.equal(gon(`${ch[0].so} ${ch[0].donVi}`), "800.000 ₫");
  assert.deepEqual(ch[0].bd, { chu: "100%", len: true, tot: true, soVoi: "so với cùng giờ tuần trước" });
  assert.equal(ch[0].xuHuong.nhan[6], "Hôm nay");
  assert.equal(ch[1].bd, null, "hôm qua cùng giờ 0 thì không ghi %");
  assert.equal(ch[1].to, "/goods-issues?trangThai=da-xuat");
  assert.deepEqual(ch[2].chia, [
    { nhan: "chờ quá 2 giờ", so: 4, vanDe: true },
    { nhan: "trong hạn", so: 2 },
  ]);
  assert.equal(ch[3].to, "/reports/inventory?kho=910001");
  assert.equal(gon(ch[3].phu), "Giá trị 1,3 triệu ₫");

  const kt = theSoQuanLyKho({ ...QLK, chiSo: { ...QLK.chiSo, doanhThu: null } }, KHO_TONG, CAU_HINH, BAY_GIO);
  assert.deepEqual(kt.map((t) => t.key), ["nhap", "xuat", "donChoXuat", "tonKho"]);
  assert.equal(kt[0].to, "/goods-receipts?trangThai=da-nhap-kho");
  assert.equal(kt[0].bd.chu, "150%");
  assert.equal(kt[0].phu, "1 phiếu đã nhập kho");

  const khongDon = theSoQuanLyKho({ ...QLK, chiSo: { ...QLK.chiSo, donChoXuat: { tong: 0, choLau: 0 } } }, CUA_HANG, CAU_HINH, BAY_GIO);
  assert.equal(khongDon[2].chia, null);
  assert.equal(khongDon[2].phu, "Không có đơn nào đang chờ");
  assert.equal(khongDon[2].ten, "Đơn chưa xuất xong", "khác trang \"Đơn chờ xuất\" (chỉ đơn chưa có phiếu nhặt)");
  assert.deepEqual(theSoQuanLyKho({ chiSo: null, tonKho: null }, CUA_HANG, CAU_HINH, BAY_GIO), []);
});

test("quản lý kho – công việc trong kho: số và dòng phụ mở đúng danh sách, chỉ hiện dòng có số", () => {
  const o = oNghiepVu(QLK.nghiepVu, CUA_HANG, CAU_HINH);
  assert.deepEqual(o.map((x) => x.key), ["nhanHang", "nhatHang", "dongGoi", "xuatKho", "chuyenKho", "kiemKe"]);
  const [nhan, nhat, dong, xuat, chuyen, kk] = o;
  assert.equal(nhan.to, "/goods-receipts?trangThai=cho-nhap-kho");
  assert.deepEqual(nhan.chip.map((c) => [c.nhan, c.so, c.to]), [
    ["Đơn mua đang về", 3, "/purchase-orders?trangThai=dang-van-chuyen&kho=910001"],
    ["Trễ hẹn", 1, "/purchase-orders?trangThai=dang-van-chuyen&kho=910001"],
    ["Đang chuyển đến", 1, "/transfer-tickets?trangThai=dang-van-chuyen"],
  ]);
  assert.equal(nhat.to, "/goods-issues/pending-orders");
  assert.equal(nhat.so, 2);
  assert.deepEqual(nhat.chip.map((c) => c.to), ["/goods-issues/pick-lists?trangThai=dang-nhat", "/goods-issues/pick-lists?trangThai=cho-nhat"]);
  assert.equal(dong.chip[0].nhan, "Chờ quá 2 giờ");
  assert.equal(xuat.chip.length, 0, "không có phiếu chuyển chờ xuất thì không hiện dòng phụ");
  assert.equal(chuyen.so, 5);
  assert.deepEqual(chuyen.chip.map((c) => c.to), ["/transfer-tickets?trangThai=cho-duyet", "/transfer-tickets?trangThai=cho-xuat-hang", "/transfer-tickets?trangThai=dang-van-chuyen"]);
  assert.equal(kk.so, 0);
  assert.equal(kk.to, "/stock-take?trangThai=dang-kiem-ke");
});

test("quản lý kho – cần bạn xử lý: tên, tuổi, đường dẫn; bỏ loại lạ", () => {
  const v = dongViecQuanLyKho(
    [
      { loai: "duyet_yeu_cau_nhap", so: 1, cuNhat: "2026-10-17T08:10:00", moTa: null, gap: true },
      { loai: "gom_phieu_nhat", so: 2, cuNhat: "2026-10-15T10:00:00", moTa: null, gap: true },
      { loai: "hoan_tat_kiem_ke", so: 1, cuNhat: "2026-10-16T09:00:00", moTa: "Kiểm kê quầy", gap: false },
      { loai: "khac", so: 9, cuNhat: null, moTa: null, gap: true },
    ],
    CUA_HANG,
    BAY_GIO,
  );
  assert.equal(v.length, 3);
  assert.equal(v[0].to, "/purchase-requests?trangThai=cho-duyet&kho=910001");
  assert.equal(v[0].tuoi, "Chờ từ 8:10");
  assert.equal(v[1].tuoi, "Cũ nhất 15/10");
  assert.equal(v[1].to, "/goods-issues/pending-orders");
  assert.equal(v[2].phu, "Kiểm kê quầy");
  assert.equal(v[2].tuoi, "Mở từ hôm qua 9:00");
});

test("quản lý kho – chờ xử lý chênh lệch chuyển kho: gấp, mở tab Chờ xử lý chênh lệch", () => {
  const [lech] = dongViecQuanLyKho(
    [{ loai: "xu_ly_chenh_lech_chuyen", so: 2, cuNhat: "2026-10-17T08:10:00", moTa: null, gap: true }],
    CUA_HANG,
    BAY_GIO,
  );
  assert.equal(lech.ten, "Xử lý chênh lệch chuyển kho");
  assert.equal(lech.loai, "chuyen");
  assert.equal(lech.so, 2);
  assert.equal(lech.gap, true);
  assert.equal(lech.tuoi, "Chờ từ 8:10");
  assert.equal(lech.to, "/transfer-tickets?trangThai=cho-xu-ly-chenh-lech");
});

test("cần bổ sung: chuyển từ Kho tổng mở sẵn form; đã có yêu cầu thì mở yêu cầu; còn lại chỉ ghi chữ", () => {
  const chuyen = { bienTheId: 5, deXuat: "chuyen_kho", soLuongDeXuat: 20, khaDung: 0, nguong: 10, khaDungKhoTong: 100 };
  assert.deepEqual(hanhDongBoSung(chuyen, CUA_HANG), {
    kieu: "nut",
    chu: "Chuyển về 20",
    to: "/transfer-tickets/create?khoXuatId=22&khoNhapId=910001&bienTheId=5&soLuong=20",
  });
  assert.equal(moTaBoSung(chuyen, CUA_HANG), "Hết hàng · Kho tổng còn 100");
  const daCo = { bienTheId: 6, deXuat: "yeu_cau_nhap", soLuongDeXuat: 15, khaDung: 5, nguong: 10, khaDungKhoTong: 0, yeuCauMoId: 7, yeuCauMoMa: "YC-7" };
  assert.deepEqual(hanhDongBoSung(daCo, CUA_HANG), { kieu: "lienKet", chu: "Đã có YC-7", to: "/purchase-requests/7" });
  assert.equal(moTaBoSung(daCo, CUA_HANG), "Còn 5 · Kho tổng còn 0");
  const thieu = { ...daCo, yeuCauMoId: null, yeuCauMoMa: null };
  assert.deepEqual(hanhDongBoSung(thieu, CUA_HANG), { kieu: "chu", chu: "Kho tổng không đủ hàng" });
  assert.deepEqual(hanhDongBoSung({ ...thieu, khaDungKhoTong: null }, KHO_TONG), { kieu: "chu", chu: "Cần mua thêm 15" });
  assert.equal(moTaBoSung({ ...thieu, khaDungKhoTong: null }, KHO_TONG), "Còn 5 · ngưỡng 10");
});

test("nhân viên kho – việc chung: chữ và đường dẫn theo loại chứng từ", () => {
  // id là id phiếu chuyển đang trên đường đến kho: nhận hàng ở màn phiếu chuyển
  assert.deepEqual(viecChungDong({ loai: "phieu_nhap_chuyen_kho", id: 3, doiTac: "Kho tổng", soLuong: 20 }), {
    moTa: "Từ Kho tổng · 20 sản phẩm",
    nut: "Nhận hàng",
    to: "/transfer-tickets/3/receive",
    moc: "Xuất lúc",
  });
  assert.equal(viecChungDong({ loai: "phieu_nhap", id: 4, doiTac: null, soLuong: 0 }).moTa, "Nhập kho");
  assert.equal(viecChungDong({ loai: "phieu_nhat", id: 1, soDon: 2, soLuong: 3 }).to, "/goods-issues/pick-lists/1");
  assert.equal(viecChungDong({ loai: "phieu_nhat", id: 1, soDon: 2, soLuong: 3 }).moTa, "2 đơn · 3 sản phẩm");
  // Phiếu nhặt của phiếu chuyển kho: số phiếu chuyển thay cho "0 đơn"
  assert.equal(viecChungDong({ loai: "phieu_nhat", id: 6, doiTac: "PX-TRF-202610281", soDon: 0, soLuong: 10 }).moTa,
    "Chuyển kho PX-TRF-202610281 · 10 sản phẩm");
  assert.equal(viecChungDong({ loai: "don_ban", id: 8, doiTac: null, soLuong: 2 }).to, "/goods-issues/packing/8");
  assert.equal(viecChungDong({ loai: "phieu_xuat", id: 9, doiTac: "Chị Lan", soLuong: 1 }).moTa, "Xuất bán · Chị Lan · 1 sản phẩm");
  assert.equal(viecChungDong({ loai: "phieu_chuyen", id: 5, doiTac: "Kho tổng", soLuong: 12 }).to, "/transfer-tickets/5");
  assert.equal(viecChungDong({ loai: "kiem_ke", id: 2, doiTac: "Kiểm kê quầy", soLuong: 2 }).moTa, "Kiểm kê quầy · 2 dòng kiểm kê");
  assert.equal(viecChungDong({ loai: "phieu_xuat", id: 9, doiTac: null, soLuong: 0 }).moc, "Nhặt xong");
});

test("nhân viên kho – hàng sắp về theo nhóm", () => {
  const nhom = nhomHangSapVe(
    [
      { loai: "don_mua", id: 1, ma: "DM-1", doiTac: "NCC Một", soLuong: 6, ngay: "2026-10-15", tre: true },
      { loai: "phieu_chuyen", id: 3, ma: "PCK-3", doiTac: "Kho tổng", soLuong: 20, ngay: "2026-10-17", tre: false },
      { loai: "don_mua", id: 2, ma: "DM-2", doiTac: "NCC Một", soLuong: 10, ngay: "2026-10-19", tre: false },
    ],
    BAY_GIO,
  );
  assert.deepEqual(nhom.map((g) => g.ten), ["Quá hạn giao", "Đang trên đường", "Thứ Hai 19/10"]);
  assert.equal(nhom[0].ds[0].ben, "Trễ 2 ngày");
  assert.equal(nhom[0].ds[0].to, "/purchase-orders/1");
  assert.equal(nhom[1].ds[0].doiTac, "Từ Kho tổng");
  assert.equal(nhom[1].ds[0].ben, "Xuất 17/10");
  assert.equal(nhom[1].ds[0].to, "/transfer-tickets/3");
});

test("mua hàng – ô số, quy trình 4 bước, lịch 7 ngày", () => {
  const cs = {
    datMua: { tong: 4000000, kyTruoc: 500000, tamTuan: Array.from({ length: 8 }, (_, i) => ({ ngay: ["2026-08-23", "2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11"][i], giaTri: i * 10 })) },
    dangVe: { soLuong: 79, soDon: 5 },
    giaoDungHan: { dungHan: 1, denHan: 3, dungHanTruoc: 0, denHanTruoc: 0 },
    choBaoGia: { tong: 3, quaHan: 2, soNhaCungCap: 3 },
  };
  const t = theSoMuaHang(cs, CAU_HINH, BAY_GIO);
  assert.deepEqual(t.map((x) => x.key), ["datMua", "dangVe", "giaoDungHan", "choBaoGia"]);
  assert.equal(gon(`${t[0].so} ${t[0].donVi}`), "4,0 triệu ₫");
  assert.equal(t[0].xuHuong.nhan[7], "7 ngày gần nhất");
  assert.equal(t[0].xuHuong.nhan[0], "Tuần từ 23/08");
  assert.equal(t[2].so, "33");
  assert.equal(t[2].thanh, 33);
  assert.equal(t[2].bd, null, "kỳ trước không có đơn đến hạn thì không so sánh");
  assert.equal(t[3].donVi, "lượt hỏi giá");
  assert.equal(t[3].chia[0].nhan, "chờ quá 2 ngày");
  assert.equal(theSoMuaHang({ ...cs, giaoDungHan: { dungHan: 0, denHan: 0, dungHanTruoc: 0, denHanTruoc: 0 } }, CAU_HINH, BAY_GIO)[2].so, "—");

  const b = buocQuyTrinh({ daDuyet: 1, choBaoGia: 1, choBaoGiaQuaHan: 1, choChotDon: 0, dangGiao: 5, dangGiaoTre: 1 }, CAU_HINH);
  assert.equal(b.length, 4);
  assert.equal(b[0].to, "/purchase-requests?trangThai=da-duyet");
  assert.equal(b[0].gap, true);
  assert.equal(b[1].chuY, "1 chờ quá 2 ngày");
  assert.equal(b[2].gap, false);
  assert.equal(b[3].tre, "1 trễ hạn");

  const l = lichTheoNgay(
    [
      { id: 1, ma: "DM-1", nhaCungCap: "NCC Một", conLai: 6, ngayGiao: "2026-10-15", tre: true },
      { id: 2, ma: "DM-2", nhaCungCap: "NCC Một", conLai: 10, ngayGiao: "2026-10-19", tre: false },
      { id: 9, ma: "DM-9", nhaCungCap: null, conLai: 1, ngayGiao: "2026-10-30", tre: false },
    ],
    BAY_GIO,
  );
  assert.equal(l.length, 8);
  assert.deepEqual(l.map((n) => n.so), [1, 0, 0, 1, 0, 0, 0, 0]);
  assert.equal(l[0].ds[0].tt, "Trễ 2 ngày");
  assert.equal(l[1].homNay, true);
  assert.equal(l[3].key, "2026-10-19");
  assert.equal(l[3].thu, "T2");
});

test("bán hàng – ô số và doanh thu cộng dồn theo giờ", () => {
  const cs = {
    doanhThu: { homNay: 800000, cungGioTruoc: 400000, bayNgay: bay([0, 600000, 0, 0, 0, 0, 800000]), soChungTu: 2 },
    donHomNay: { soDon: 6, taiQuay: 1, cungGioTruoc: 1, bayNgay: bay([0, 1, 0, 0, 0, 2, 6]) },
    trungBinhDon: { homNay: null, bayNgayTruoc: 400000, bayNgay: bay([0, 600000, 0, 0, 0, 0, 0]) },
    donCuaToi: { tong: 5, canChuY: 4, giaTri: 680000 },
  };
  const t = theSoBanHang(cs, BAY_GIO);
  assert.deepEqual(t.map((x) => x.key), ["doanhThu", "donHomNay", "trungBinhDon", "donCuaToi"]);
  assert.equal(t[0].to, null, "nhân viên bán hàng không vào được Báo cáo doanh thu");
  assert.equal(t[1].phu, "Tại quầy 1 · đơn khác 5");
  assert.equal(t[1].to, null, "danh sách đơn của nhân viên bán hàng chỉ có đơn do mình tạo");
  assert.equal(t[2].so, "—");
  assert.equal(t[2].bd, null);
  assert.equal(t[2].phu, "Chưa có đơn giao hôm nay");
  assert.deepEqual(t[3].chia.map((c) => c.so), [4, 1]);

  const nay = Array(16).fill(0);
  nay[9] = 500000;
  nay[14] = 300000;
  nay[15] = 50000;
  const truoc = Array(24).fill(0);
  truoc[9] = 400000;
  truoc[15] = 120000;
  truoc[17] = 200000;
  const s = diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, BAY_GIO);
  assert.equal(s.dau, 8);
  assert.equal(s.cuoi, 22, "cuối trục là giờ chẵn để vạch cuối có nhãn");
  assert.deepEqual(vachGio(s.dau, s.cuoi, s.buoc), [8, 10, 12, 14, 16, 18, 20, 22]);
  assert.equal(s.homNay, 850000);
  assert.equal(s.truocCaNgay, 720000);
  assert.equal(s.truocCungGio, 400000 + (120000 * 25) / 60);
  const bayGio = s.ds.find((d) => d.bayGio);
  assert.equal(bayGio.gio, 15 + 25 / 60);
  assert.equal(bayGio.nay, 850000);
  assert.equal(s.ds.find((d) => d.gio === 10).nay, 500000, "đến 10:00 gồm phần bán trong giờ 9");
  assert.equal(s.ds.find((d) => d.gio === 16).nay, null, "sau bây giờ chưa có số");
  assert.equal(s.ds.find((d) => d.gio === 18).truoc, 720000);

  const dungGio = diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, "2026-10-17T15:00:00");
  const d15 = dungGio.ds.find((d) => d.gio === 15);
  assert.equal(d15.bayGio, true);
  assert.equal(d15.nay, 850000);

  const sang = diemTheoGio({ gioHienTai: 6, homNay: [0, 0, 0, 0, 0, 0, 20000], tuanTruoc: Array(24).fill(0) }, "2026-10-17T06:30:00");
  assert.equal(sang.dau, 6, "có bán từ 6 giờ thì trục bắt đầu từ 6 giờ");

  // Trước giờ mở cửa: trục bắt đầu từ giờ hiện tại để điểm "bây giờ" nằm trong trục
  const khuya = diemTheoGio({ gioHienTai: 0, homNay: [0], tuanTruoc: Array(24).fill(0) }, "2026-10-17T00:10:00");
  assert.equal(khuya.dau, 0);
  assert.deepEqual(vachGio(khuya.dau, khuya.cuoi, khuya.buoc), [0, 4, 8, 12, 16, 20, 24], "trục dài thì 4 giờ một vạch");
  assert.ok(khuya.ds.find((d) => d.bayGio).gio >= khuya.dau);
  const bayGioSang = diemTheoGio({ gioHienTai: 7, homNay: Array(8).fill(0), tuanTruoc: Array(24).fill(0) }, "2026-10-17T07:00:00");
  assert.equal(bayGioSang.dau, 6, "đầu trục là giờ chẵn; 7 giờ vẫn nằm trong trục");
  assert.deepEqual(vachGio(bayGioSang.dau, bayGioSang.cuoi, bayGioSang.buoc), [6, 8, 10, 12, 14, 16, 18, 20, 22]);
  assert.equal(bayGioSang.ds.find((d) => d.bayGio)?.gio, 7, "đúng giờ tròn trước 8 giờ vẫn có điểm bây giờ");
  assert.equal(diemTheoGio({ gioHienTai: 6, homNay: Array(7).fill(0), tuanTruoc: Array(24).fill(0) }, "2026-10-17T06:30:00").dau, 6);

  // Có số "cùng giờ tuần trước" của máy chủ thì chú giải và điểm bây giờ dùng đúng số đó (khớp ô Doanh thu)
  const khop = diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, BAY_GIO, 410000);
  assert.equal(khop.truocCungGio, 410000);
  assert.equal(khop.ds.find((d) => d.bayGio).truoc, 410000);
  assert.equal(diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, BAY_GIO, 999999).truocCungGio, 520000, "không vượt cuối giờ");
  assert.equal(diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, "2026-10-17T15:00:00", 400000).truocCungGio, 400000);
  // Đúng giờ tròn cũng kẹp trong khoảng đầu giờ – cuối giờ như giữa giờ
  assert.equal(diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, "2026-10-17T15:00:00", 999999).truocCungGio, 520000);
  assert.equal(diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: truoc }, "2026-10-17T15:00:00", 1).truocCungGio, 400000);
  // Có bán đến 23 giờ: trục đến 24 giờ
  const muon = Array(24).fill(0);
  muon[23] = 1000;
  assert.equal(diemTheoGio({ gioHienTai: 15, homNay: nay, tuanTruoc: muon }, BAY_GIO).cuoi, 24);
  assert.equal(nhanGio(15.5), "15:30");
});

test("bán hàng – ghi chú đơn, giá bán, bỏ dấu", () => {
  assert.equal(chuYDon({ chuY: "nhap" }, BAY_GIO), "Chưa gửi kho");
  assert.equal(chuYDon({ chuY: "cho_lau", ngayDat: "2026-10-17T12:00:00" }, BAY_GIO), "Chờ 3 giờ 25 phút");
  assert.equal(chuYDon({ chuY: null }, BAY_GIO), null);
  assert.equal(gon(giaBan({ giaThapNhat: 199000, giaCaoNhat: 219000 })), "199.000 – 219.000 ₫");
  assert.equal(gon(giaBan({ giaThapNhat: 199000, giaCaoNhat: 199000 })), "199.000 ₫");
  assert.equal(giaBan({ giaThapNhat: null, giaCaoNhat: null }), "");
  assert.equal(boDau("Áo ĐŨI"), "ao dui");
});
