// Chạy: node --test src/components/danh-muc/cayDanhMuc.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOC_MAC_DINH,
  LOC_TRANG_THAI,
  apDungCapNhat,
  demConHien,
  kiemTraPhanHoi,
  phangHoa,
  chieuCao,
  chuanHoaChu,
  demSeHoatDongLai,
  demSeNgungTheo,
  demThongKe,
  dungCay,
  goiYMaMoi,
  kiemTraChuyen,
  kiemTraForm,
  kiemTraSua,
  layDongCap,
  layDuongDan,
  tachChuKhop,
  taoBodyCapNhat,
  taoDongHienThi,
  timPhang,
  tinhThaoTac,
  tinhTrangThai,
} from "./cayDanhMuc.js";

// Dữ liệu dạng API /all: phẳng, mỗi danh mục có danhMucCha (một cấp) và danhMucCons lồng nhau.
const dm = (id, ma, ten, cha, trangThai = 1, moTa = "") => ({
  id,
  maDanhMuc: ma,
  tenDanhMuc: ten,
  moTa,
  trangThai,
  ngayTao: "2026-01-21T13:53:09Z",
  danhMucCha: cha == null ? null : { id: cha },
  danhMucCons: [],
});

const MAU = [
  dm(1, "DM001", "Áo", null, 1, "Các loại áo"),
  dm(2, "DM002", "Áo thun", 1),
  dm(3, "DM003", "Áo thun cổ tròn", 2),
  dm(4, "DM004", "Áo polo", 1, 0),
  dm(5, "DM005", "Quần", null),
  dm(6, "DM006", "Quần jean", 5),
  dm(7, "DM007", "Phụ kiện", null),
  dm(8, "DM008", "Túi xách", 7, 0),
  dm(9, "DM009", "Túi tote", 8),
  dm(10, "DM010", "Túi đeo chéo", 8, 0),
  dm(11, "DM011", "Thắt lưng", 7),
];

test("dựng cây từ dữ liệu phẳng và dữ liệu lồng nhau như nhau", () => {
  const phang = dungCay(MAU);
  const long = dungCay([
    { ...MAU[0], danhMucCons: [{ ...MAU[1], danhMucCha: undefined, danhMucCons: [{ ...MAU[2], danhMucCha: undefined }] }] },
  ]);
  assert.equal(phang.theoId.size, 11);
  assert.deepEqual(phang.con.get(null), [1, 5, 7]);
  assert.deepEqual(phang.con.get(1), [2, 4]);
  assert.deepEqual(long.con.get(null), [1]);
  assert.deepEqual(long.con.get(2), [3]);
  assert.equal(long.theoId.get(3).chaId, 2);
  assert.deepEqual(layDuongDan(phang, 3).map((n) => n.ten), ["Áo", "Áo thun", "Áo thun cổ tròn"]);
  assert.equal(chieuCao(phang, 1), 2);
});

test("cha không tồn tại hoặc dữ liệu vòng lặp thì coi là danh mục gốc", () => {
  const cay = dungCay([dm(1, "A", "A", 99), dm(2, "B", "B", 3), dm(3, "C", "C", 2)]);
  assert.equal(cay.theoId.get(1).chaId, null);
  // 2 ↔ 3 vòng nhau: cả hai không được treo vào nhau mãi
  const goc = cay.con.get(null);
  assert.ok(goc.includes(1));
  assert.ok(goc.includes(2) || goc.includes(3));
  assert.ok(layDuongDan(cay, 2).length <= 2);
});

test("trạng thái theo nhánh: con của danh mục đang ngừng thì ngừng theo, không ghi đè trạng thái riêng", () => {
  const cay = dungCay(MAU);
  const tt = tinhTrangThai(cay);
  assert.deepEqual(tt.get(8), { ngung: true, tuNgung: true, doCha: null });
  assert.equal(tt.get(9).ngung, true);
  assert.equal(tt.get(9).tuNgung, false);
  assert.equal(tt.get(9).doCha.ten, "Túi xách");
  // Tự ngừng và cha cũng ngừng: vẫn ghi nguyên nhân từ cha
  assert.equal(tt.get(10).tuNgung, true);
  assert.equal(tt.get(10).doCha.ten, "Túi xách");
  assert.equal(tt.get(11).ngung, false);
  assert.deepEqual(demThongKe(cay), { tong: 11, goc: 3, ngung: 4, hoatDong: 7, sauNhat: 3 });
});

test("số danh mục ngừng theo và hoạt động lại theo", () => {
  const cay = dungCay(MAU);
  assert.equal(demSeNgungTheo(cay, 7), 1); // Thắt lưng (Túi tote đã ngừng theo Túi xách)
  assert.equal(demSeNgungTheo(cay, 1), 2); // Áo thun, Áo thun cổ tròn
  // Bật lại Túi xách: Túi tote hoạt động lại, Túi đeo chéo vẫn tự ngừng
  assert.equal(demSeHoatDongLai(cay, 8), 1);
});

test("tìm không dấu theo tên hoặc mã, hiện kèm cha và tự mở nhánh", () => {
  const cay = dungCay(MAU);
  const { dong } = taoDongHienThi(cay, { tuKhoa: "ao thun" });
  assert.deepEqual(dong.map((d) => [d.nut.ten, d.cap, d.laNguCanh, d.khop]), [
    ["Áo", 0, true, false],
    ["Áo thun", 1, false, true],
    ["Áo thun cổ tròn", 2, false, true],
  ]);
  assert.equal(taoDongHienThi(cay, { tuKhoa: "dm006" }).dong.map((d) => d.nut.ten).join(), "Quần,Quần jean");
  assert.equal(taoDongHienThi(cay, { tuKhoa: "xyz" }).dong.length, 0);
  assert.equal(chuanHoaChu("Đầm ĐỎ"), "dam do");
  assert.deepEqual(tachChuKhop("Túi đeo chéo", chuanHoaChu("deo")), { truoc: "Túi ", khop: "đeo", sau: " chéo" });
});

test("đóng một nhánh tự mở khi tìm thì giữ đóng; dòng khớp nằm sâu trong nhánh đã khớp vẫn tự hiện", () => {
  const cay = dungCay(MAU);
  const dong = taoDongHienThi(cay, { tuKhoa: "áo", moRong: { 1: false } }).dong;
  assert.deepEqual(dong.map((d) => d.nut.ten), ["Áo"]);
  // "Áo" khớp và con cháu cũng khớp: mở tới tận "Áo thun cổ tròn", các con khác của "Áo" hiện như thường
  const mo = taoDongHienThi(cay, { tuKhoa: "áo" }).dong;
  assert.deepEqual(mo.map((d) => d.nut.ten), ["Áo", "Áo thun", "Áo thun cổ tròn", "Áo polo"]);
  assert.deepEqual(mo.map((d) => d.khop), [true, true, true, true]);
  // Người dùng đóng "Áo thun" thì giữ đóng
  const dongCon = taoDongHienThi(cay, { tuKhoa: "áo", moRong: { 2: false } }).dong;
  assert.deepEqual(dongCon.map((d) => d.nut.ten), ["Áo", "Áo thun", "Áo polo"]);
});

test("lọc Ngừng hoạt động: danh mục ngừng nằm dưới danh mục ngừng khác vẫn hiện", () => {
  const cay = dungCay([
    { id: 1, maDanhMuc: "Q", tenDanhMuc: "Quần", trangThai: 0 },
    { id: 2, maDanhMuc: "QJ", tenDanhMuc: "Quần jean", trangThai: 1, danhMucCha: { id: 1 } },
    { id: 3, maDanhMuc: "QJR", tenDanhMuc: "Quần jean rách", trangThai: 0, danhMucCha: { id: 2 } },
  ]);
  const dong = taoDongHienThi(cay, { loc: LOC_TRANG_THAI.NGUNG }).dong;
  assert.deepEqual(dong.map((d) => d.nut.ten), ["Quần", "Quần jean", "Quần jean rách"]);
});

test("tô chữ khớp đúng cả khi tên lưu ở dạng NFD", () => {
  const tenNfd = "Áo thun".normalize("NFD");
  assert.deepEqual(tachChuKhop(tenNfd, chuanHoaChu("thun")), { truoc: "Áo ", khop: "thun", sau: "" });
});

test("danh sách phẳng chuẩn hóa và áp thay đổi vừa lưu", () => {
  const long = [{ ...MAU[0], danhMucCons: [{ ...MAU[1], danhMucCha: undefined, danhMucCons: [] }] }, ...MAU.slice(1)];
  const phang = phangHoa(long);
  assert.equal(phang.length, 11);
  assert.equal(phang.find((x) => x.id === 2).danhMucChaId, 1);
  const sau = apDungCapNhat(phang, { id: 2, tenDanhMuc: "Áo thun nam", moTa: "", trangThai: 0, danhMucChaId: null });
  const cay = dungCay(sau);
  assert.equal(cay.theoId.get(2).chaId, null);
  assert.equal(cay.theoId.get(2).ten, "Áo thun nam");
  assert.equal(cay.theoId.get(3).chaId, 2);
  assert.deepEqual(cay.con.get(null), [1, 2, 5, 7]);
});

test("phản hồi lỗi của máy chủ giữ được câu báo", () => {
  assert.throws(() => kiemTraPhanHoi({ data: { status: 400, message: "Mã danh mục đã tồn tại" } }), (loi) => loi.response.data.message === "Mã danh mục đã tồn tại");
  assert.doesNotThrow(() => kiemTraPhanHoi({ data: { status: 200 } }));
});

test("lọc trạng thái: Đang hoạt động ẩn cả nhánh ngừng, Ngừng hoạt động hiện kèm cha", () => {
  const cay = dungCay(MAU);
  const moHet = { 1: true, 2: true, 5: true, 7: true, 8: true };
  const hd = taoDongHienThi(cay, { loc: LOC_TRANG_THAI.HOAT_DONG, moRong: moHet }).dong.map((d) => d.nut.ten);
  assert.deepEqual(hd, ["Áo", "Áo thun", "Áo thun cổ tròn", "Quần", "Quần jean", "Phụ kiện", "Thắt lưng"]);
  const ngung = taoDongHienThi(cay, { loc: LOC_TRANG_THAI.NGUNG });
  assert.deepEqual(ngung.dong.map((d) => [d.nut.ten, d.laNguCanh]), [
    ["Áo", true],
    ["Áo polo", false],
    ["Phụ kiện", true],
    ["Túi xách", false],
    ["Túi tote", false],
    ["Túi đeo chéo", false],
  ]);
});

test("nút Mở tất cả / Thu gọn tất cả biết khi nào mọi nhánh đang mở", () => {
  const cay = dungCay(MAU);
  assert.equal(taoDongHienThi(cay, { moRong: {} }).tatCaDangMo, false);
  assert.equal(taoDongHienThi(cay, { moRong: { 1: true, 2: true, 5: true, 7: true, 8: true } }).tatCaDangMo, true);
  // Nhánh con nằm trong nhánh đang đóng vẫn tính
  assert.equal(taoDongHienThi(cay, { moRong: { 1: true, 5: true, 7: true, 8: true } }).tatCaDangMo, false);
  // Chỉ toàn danh mục lá: không có gì để mở
  const la = dungCay([dm(1, "A", "A", null)]);
  assert.equal(taoDongHienThi(la).coNhanhDeMo, false);
});

test("xem riêng nhánh: con của nhánh là cấp 0, cấp thật vẫn đúng", () => {
  const cay = dungCay(MAU);
  const { dong } = taoDongHienThi(cay, { goc: 1, moRong: { 2: true } });
  assert.deepEqual(dong.map((d) => [d.nut.ten, d.cap, d.capThat]), [
    ["Áo thun", 0, 1],
    ["Áo thun cổ tròn", 1, 2],
    ["Áo polo", 0, 1],
  ]);
});

test("chuyển danh mục: chặn chính nó, con cháu, nhánh đang ngừng; về gốc được", () => {
  const cay = dungCay(MAU);
  assert.deepEqual(kiemTraChuyen(cay, 2, 2), { duoc: false, lyDo: "Danh mục đang chuyển" });
  assert.deepEqual(kiemTraChuyen(cay, 1, 3), { duoc: false, lyDo: "Nằm trong nhánh đang chuyển" });
  assert.deepEqual(kiemTraChuyen(cay, 2, 9), { duoc: false, lyDo: "Ngừng hoạt động" });
  assert.equal(kiemTraChuyen(cay, 2, 1).dangOday, true);
  assert.equal(kiemTraChuyen(cay, 2, 5).duoc, true);
  assert.equal(kiemTraChuyen(cay, 2, null).duoc, true);
  assert.equal(kiemTraChuyen(cay, 1, null).dangOday, true);
  // Chuyển con của nhánh ngừng ra ngoài được (máy chủ chỉ kiểm cha mới)
  assert.equal(kiemTraChuyen(cay, 9, 5).duoc, true);
});

test("sửa bị khóa khi danh mục cha trực tiếp đang tắt", () => {
  const cay = dungCay(MAU);
  assert.equal(kiemTraSua(cay, 9).duoc, false);
  assert.match(kiemTraSua(cay, 9).lyDo, /“Túi xách” đang ngừng hoạt động/);
  assert.equal(kiemTraSua(cay, 8).duoc, true); // tự ngừng, cha đang hoạt động
  assert.equal(kiemTraSua(cay, 2).duoc, true);
});

test("gợi ý mã theo kiểu mã dùng nhiều nhất, không trùng", () => {
  assert.equal(goiYMaMoi(dungCay(MAU)), "DM012");
  const lan = dungCay([dm(1, "DM-001", "A", null), dm(2, "DM-005", "B", null), dm(3, "XXXX3", "C", null), dm(4, "DMtest", "D", null)]);
  assert.equal(goiYMaMoi(lan), "DM-006");
  assert.equal(goiYMaMoi(dungCay([])), "DM001");
  assert.equal(goiYMaMoi(dungCay([dm(1, "abc", "A", null)])), "DM001");
});

test("kiểm tra form: bắt buộc, độ dài, trùng mã; trùng tên cùng cha chỉ cảnh báo", () => {
  const cay = dungCay(MAU);
  assert.deepEqual(kiemTraForm(cay, { ma: "", ten: " " }).loi, { ten: "Nhập tên danh mục", ma: "Nhập mã danh mục" });
  assert.equal(kiemTraForm(cay, { ma: "dm001", ten: "Mới" }).loi.ma, "Mã này đã có");
  assert.equal(kiemTraForm(cay, { ma: "X".repeat(51), ten: "Mới" }).loi.ma, "Mã tối đa 50 ký tự");
  assert.equal(kiemTraForm(cay, { ma: "MOI", ten: "T".repeat(101) }).loi.ten, "Tên tối đa 100 ký tự");
  const trung = kiemTraForm(cay, { ma: "MOI", ten: "ao thun", chaId: 1 });
  assert.equal(trung.hopLe, true);
  assert.equal(trung.trungTen, true);
  // Sửa: không kiểm mã, không tính trùng với chính nó
  assert.equal(kiemTraForm(cay, { ma: "", ten: "Áo thun", chaId: 1, idDangSua: 2 }).trungTen, false);
  assert.equal(kiemTraForm(cay, { ma: "", ten: "Áo thun", chaId: 1, idDangSua: 2 }).hopLe, true);
});

test("body cập nhật luôn gửi lại cha và trạng thái hiện có", () => {
  const cay = dungCay(MAU);
  assert.deepEqual(taoBodyCapNhat(cay.theoId.get(2), { ten: "Áo phông" }), {
    id: 2, tenDanhMuc: "Áo phông", danhMucChaId: 1, moTa: "", trangThai: 1,
  });
  assert.deepEqual(taoBodyCapNhat(cay.theoId.get(2), { chaId: null }).danhMucChaId, null);
  assert.equal(taoBodyCapNhat(cay.theoId.get(1), { trangThai: 0 }).trangThai, 0);
  assert.equal(taoBodyCapNhat(cay.theoId.get(1)).moTa, "Các loại áo");
});

test("tìm phẳng kèm đường dẫn, theo bộ lọc trạng thái", () => {
  const cay = dungCay(MAU);
  assert.deepEqual(timPhang(cay, "tui").map((k) => [k.nut.ten, k.duongDan.join(" › ")]), [
    ["Túi xách", "Phụ kiện"],
    ["Túi tote", "Phụ kiện › Túi xách"],
    ["Túi đeo chéo", "Phụ kiện › Túi xách"],
  ]);
  assert.equal(timPhang(cay, "tui", { loc: LOC_TRANG_THAI.HOAT_DONG }).length, 0);
  assert.equal(timPhang(cay, "", {}).length, 0);
});

test("bản điện thoại: các dòng một cấp theo bộ lọc, Ngừng hoạt động giữ lối đi tới danh mục đang ngừng", () => {
  const cay = dungCay(MAU);
  const tt = tinhTrangThai(cay);
  const ids = (cha, loc) => layDongCap(cay, tt, cha, loc).map((d) => d.id);
  assert.deepEqual(ids(null, LOC_TRANG_THAI.TAT_CA), [1, 5, 7]);
  assert.deepEqual(ids(1, LOC_TRANG_THAI.HOAT_DONG), [2]);
  // Quần không có danh mục ngừng nào bên dưới; Áo và Phụ kiện còn hoạt động nhưng chứa danh mục đang ngừng
  assert.deepEqual(ids(null, LOC_TRANG_THAI.NGUNG), [1, 7]);
  assert.deepEqual(ids(7, LOC_TRANG_THAI.NGUNG), [8]);
  assert.equal(layDongCap(cay, tt, 7, LOC_TRANG_THAI.TAT_CA)[0].soCon, 2);
});

test("thao tác của dòng: ẩn khi không có quyền, khóa kèm lý do khi chưa làm được", () => {
  const cay = dungCay(MAU);
  const tt = tinhTrangThai(cay);
  const dong = (id) => ({ id, nut: cay.theoId.get(id), tt: tt.get(id), coCon: cay.con.has(id) && cay.con.get(id).length > 0 });
  const tinh = (id, coTheSua = true) => tinhThaoTac({
    dong: dong(id),
    coTheSua,
    kiemTraSua: kiemTraSua(cay, id),
    soHoatDongLai: demSeHoatDongLai(cay, id),
  });

  const xem = tinh(1, false);
  assert.equal(xem.themCon, null);
  assert.equal(xem.sua, null);
  assert.equal(xem.chuyen, null);
  assert.equal(xem.trangThai, null);
  assert.deepEqual(xem.xemNhanh, { khoa: false });

  const ao = tinh(1);
  assert.equal(ao.themCon.khoa, false);
  assert.equal(ao.trangThai.loai, "ngung");
  assert.equal(tinh(3).xemNhanh, null);

  // Túi xách tự ngừng: bật lại được, kéo theo Túi tote (Túi đeo chéo vẫn tự ngừng)
  const tui = tinh(8);
  assert.equal(tui.themCon.khoa, true);
  assert.equal(tui.trangThai.loai, "bat");
  assert.equal(tui.trangThai.khoa, false);
  assert.equal(tui.trangThai.phu, "Cùng 1 danh mục con");

  // Túi tote ngừng theo Túi xách: không sửa, không bật lại được, vẫn chuyển được ra nhánh khác
  const tote = tinh(9);
  assert.equal(tote.sua.khoa, true);
  assert.match(tote.sua.lyDo, /Túi xách/);
  assert.equal(tote.trangThai.khoa, true);
  assert.equal(tote.trangThai.phu, "Đang ngừng theo “Túi xách”");
  assert.equal(tote.chuyen.khoa, false);
});

test("mặc định lọc Đang hoạt động; số danh mục con khớp với số dòng thấy được", () => {
  assert.equal(LOC_MAC_DINH, LOC_TRANG_THAI.HOAT_DONG);
  const cay = dungCay(MAU);
  const tt = tinhTrangThai(cay);
  // Áo có 2 con (Áo polo đang ngừng); Phụ kiện có 2 con (Túi xách đang ngừng)
  assert.equal(demConHien(cay, tt, 1, LOC_TRANG_THAI.HOAT_DONG), 1);
  assert.equal(demConHien(cay, tt, 1, LOC_TRANG_THAI.TAT_CA), 2);
  assert.equal(demConHien(cay, tt, 7, LOC_TRANG_THAI.HOAT_DONG), 1);
  assert.equal(demConHien(cay, tt, 7, LOC_TRANG_THAI.NGUNG), 2);
  const hd = taoDongHienThi(cay, { loc: LOC_TRANG_THAI.HOAT_DONG, moRong: { 1: true, 7: true } }).dong;
  assert.deepEqual(hd.map((d) => [d.nut.ten, d.soCon]), [["Áo", 1], ["Áo thun", 1], ["Quần", 1], ["Phụ kiện", 1], ["Thắt lưng", 0]]);
  const tc = taoDongHienThi(cay, { loc: LOC_TRANG_THAI.TAT_CA, moRong: { 1: true } }).dong;
  assert.equal(tc.find((d) => d.id === 1).soCon, 2);
  assert.deepEqual(layDongCap(cay, tt, 1, LOC_TRANG_THAI.HOAT_DONG).map((d) => [d.id, d.soCon]), [[2, 1]]);
});
