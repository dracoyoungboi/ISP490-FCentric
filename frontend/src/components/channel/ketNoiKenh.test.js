// Chạy: node --test src/components/channel/ketNoiKenh.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coThayDoiKhoaUngDung,
  conLaiUyQuyen,
  daKetNoi,
  giuTenMienDangHien,
  hanUyQuyen,
  hoTroNgatKetNoi,
  khoaTenMien,
  kiemTraGiaTriKetNoi,
  kiemTraKhoaUngDung,
  moTaNgatKetNoi,
  nhanTrangThaiKetNoi,
  seBoKhoaLamMoi,
  taoPayloadKetNoi,
  taoPayloadKhoaUngDung,
  trangThaiKetNoi,
} from "./ketNoiKenh.js";
import { SAN_BAN_HANG, nhanTrangThaiSan, timSan } from "../../constants/channel.js";

const NGAY = 86_400_000;
const BAY_GIO = Date.parse("2026-10-23T03:00:00Z");
const sau = (soNgay) => new Date(BAY_GIO + soNgay * NGAY).toISOString();

test("cấu hình Shopify cũ (chưa có trangThaiKetNoi): suy từ khóa đã lưu như trước", () => {
  assert.equal(daKetNoi(null), false);
  assert.equal(daKetNoi({ hasAccessToken: true, shopDomain: "" }), false);
  const cfg = { hasAccessToken: true, shopDomain: "fcentric-dev.myshopify.com", trangThai: 1 };
  assert.equal(daKetNoi(cfg), true);
  assert.equal(trangThaiKetNoi(cfg), "dang_hoat_dong");
  assert.equal(trangThaiKetNoi({ ...cfg, trangThai: 0 }), "tam_dung");
  assert.equal(trangThaiKetNoi({ ...cfg, tokenExpired: true }), "het_han");
  // Lần đầu kết nối thì bật đồng bộ; đã kết nối thì giữ công tắc
  const values = { shopDomain: "fcentric-dev", accessToken: "", apiSecret: "", clientId: "", refreshToken: "" };
  assert.equal(taoPayloadKetNoi(values, null).trangThai, 1);
  assert.equal(taoPayloadKetNoi(values, { ...cfg, trangThai: 0 }).trangThai, 0);
});

test("KetNoiKenhDto: đã kết nối gồm cả hết hạn; tạm dừng theo công tắc trangThai", () => {
  assert.equal(daKetNoi({ trangThaiKetNoi: "chua_ket_noi" }), false);
  assert.equal(daKetNoi({ trangThaiKetNoi: "loi" }), false);
  assert.equal(daKetNoi({ trangThaiKetNoi: "het_han" }), true);
  assert.equal(trangThaiKetNoi({ trangThaiKetNoi: "dang_hoat_dong", trangThai: 0 }, BAY_GIO), "tam_dung");
  assert.equal(trangThaiKetNoi({ trangThaiKetNoi: "het_han", trangThai: 1 }, BAY_GIO), "het_han");
  // Hạn ủy quyền đã qua mà máy chủ chưa kịp đổi trạng thái: vẫn coi là hết hạn
  assert.equal(trangThaiKetNoi({ trangThaiKetNoi: "dang_hoat_dong", trangThai: 1, hanUyQuyen: sau(-0.1) }, BAY_GIO), "het_han");
  // Máy chủ ghi lỗi kết nối: trạng thái riêng, không tính là đã kết nối (menu không hiện sàn)
  assert.equal(trangThaiKetNoi({ trangThaiKetNoi: "loi", trangThai: 1 }, BAY_GIO), "loi");
  assert.equal(daKetNoi({ trangThaiKetNoi: "loi" }), false);
});

test("hạn ủy quyền: còn ≤ 7 ngày thì nhắc, hết hạn thì 0 ngày; không có hạn (Shopify) thì null", () => {
  const dto = { trangThaiKetNoi: "dang_hoat_dong", trangThai: 1 };
  assert.equal(hanUyQuyen({ ...dto, hanUyQuyen: null }, BAY_GIO), null);
  assert.deepEqual(
    { ...hanUyQuyen({ ...dto, hanUyQuyen: sau(47) }, BAY_GIO), han: undefined },
    { han: undefined, soNgay: 47, hetHan: false, sapHet: false },
  );
  // Đếm theo ngày lịch (giờ máy): 8 giờ ngày 23/10 → 20 giờ ngày 28/10 là "còn 5 ngày", khớp ngày 28/10 đang hiện
  const sapHet = hanUyQuyen({ ...dto, hanUyQuyen: new Date(2026, 9, 28, 20).toISOString() }, new Date(2026, 9, 23, 8).getTime());
  assert.equal(sapHet.soNgay, 5);
  assert.equal(sapHet.sapHet, true);
  assert.equal(conLaiUyQuyen(sapHet), "còn 5 ngày");
  const homNay = hanUyQuyen({ ...dto, hanUyQuyen: new Date(2026, 9, 23, 20).toISOString() }, new Date(2026, 9, 23, 8).getTime());
  assert.deepEqual([homNay.soNgay, homNay.hetHan, homNay.sapHet], [0, false, true]);
  assert.equal(conLaiUyQuyen(homNay), "hết hạn hôm nay");
  assert.equal(hanUyQuyen({ ...dto, hanUyQuyen: sau(7) }, BAY_GIO).sapHet, true);
  assert.equal(hanUyQuyen({ ...dto, hanUyQuyen: sau(8) }, BAY_GIO).sapHet, false);
  const het = hanUyQuyen({ ...dto, trangThaiKetNoi: "het_han", hanUyQuyen: sau(3) }, BAY_GIO);
  assert.deepEqual([het.hetHan, het.sapHet, het.soNgay], [true, false, 0]);
});

test("nhãn trạng thái: sàn ủy quyền hết hạn ghi 'Hết hạn ủy quyền', Shopify giữ 'Hết hạn khóa'", () => {
  assert.equal(nhanTrangThaiKetNoi("het_han", "uy_quyen"), "Hết hạn ủy quyền");
  assert.equal(nhanTrangThaiKetNoi("het_han", "khoa"), "Hết hạn khóa");
  assert.equal(nhanTrangThaiKetNoi("dang_hoat_dong", "uy_quyen"), "Đang hoạt động");
  assert.equal(nhanTrangThaiKetNoi("la", "uy_quyen"), "Chưa kết nối");
});

test("khóa ứng dụng: bắt buộc khi chưa lưu, Service ID chỉ TikTok Shop, khóa rỗng = giữ khóa cũ", () => {
  const trong = { appKey: "", appSecret: "", serviceId: "" };
  assert.deepEqual(Object.keys(kiemTraKhoaUngDung(trong, null)), ["appKey", "appSecret"]);
  assert.deepEqual(Object.keys(kiemTraKhoaUngDung(trong, null, { coServiceId: true })), ["appKey", "appSecret", "serviceId"]);
  const daLuu = { appKey: "131204", hasAppSecret: true, serviceId: null };
  assert.deepEqual(kiemTraKhoaUngDung({ ...trong, appKey: "131204" }, daLuu), {});
  assert.equal(coThayDoiKhoaUngDung({ appKey: "131204", appSecret: "", serviceId: "" }, daLuu), false);
  assert.equal(coThayDoiKhoaUngDung({ appKey: "131204", appSecret: "moi", serviceId: "" }, daLuu), true);
  assert.deepEqual(taoPayloadKhoaUngDung({ appKey: " 131204 ", appSecret: "", serviceId: "x" }), { appKey: "131204", appSecret: null });
  assert.deepEqual(taoPayloadKhoaUngDung({ appKey: "k", appSecret: "s", serviceId: " 7493 " }, { coServiceId: true }), {
    appKey: "k",
    appSecret: "s",
    serviceId: "7493",
  });
});

test("timSan: theo mã kênh hoặc đoạn đường dẫn, không phân biệt hoa thường; mã lạ trả null", () => {
  assert.equal(timSan("LAZADA")?.duongDan, "/channels/lazada");
  assert.equal(timSan("tiktok")?.maKenh, "TIKTOK");
  assert.equal(timSan("Shopify")?.kieuKetNoi, "khoa");
  assert.equal(timSan("amazon"), null);
  assert.equal(timSan("oauth"), null);
  assert.equal(timSan(""), null);
});

test("Shopee chờ cấp API: tìm được sàn để vẽ dòng và màn giới thiệu, nhưng không tính là sàn hỗ trợ", () => {
  const shopee = timSan("shopee");
  assert.equal(shopee?.maKenh, "SHOPEE");
  assert.equal(shopee.duongDan, "/channels/shopee");
  assert.equal(shopee.kieuKetNoi, "uy_quyen");
  // Menu trái, tải danh sách sàn đã kết nối và bảng số liệu chỉ lấy sàn hỗ trợ: Shopee không được gọi máy chủ
  assert.equal(shopee.hoTro, false);
  assert.deepEqual(
    SAN_BAN_HANG.filter((san) => san.hoTro).map((san) => san.maKenh),
    ["SHOPIFY", "LAZADA", "TIKTOK"],
  );
  assert.equal(timSan("SHOPEE"), shopee);
});

test("ô tên miền Shopify chỉ đọc khi đã kết nối và máy chủ ngắt kết nối được; ngắt rồi thì sửa được", () => {
  const cfg = { hasAccessToken: true, shopDomain: "fcentric-dev.myshopify.com", trangThai: 1, trangThaiKetNoi: "dang_hoat_dong" };
  assert.equal(khoaTenMien(cfg), true);
  assert.equal(khoaTenMien({ ...cfg, trangThai: 0 }), true);
  assert.equal(khoaTenMien({ ...cfg, trangThaiKetNoi: "het_han" }), true);
  assert.equal(khoaTenMien({ ...cfg, hasAccessToken: false, trangThaiKetNoi: "chua_ket_noi" }), false);
  assert.equal(khoaTenMien({ ...cfg, shopDomain: "" }), false);
  assert.equal(khoaTenMien(null), false);
  // Máy chủ cũ (GET /shopify, chưa có trangThaiKetNoi) chưa ngắt được: giữ cho sửa tên miền như trước
  const cfgCu = { hasAccessToken: true, shopDomain: "fcentric-dev.myshopify.com", trangThai: 1 };
  assert.equal(hoTroNgatKetNoi(cfgCu), false);
  assert.equal(khoaTenMien(cfgCu), false);
  assert.equal(hoTroNgatKetNoi(cfg), true);
  assert.equal(hoTroNgatKetNoi({ trangThaiKetNoi: "chua_ket_noi" }), true);
  assert.equal(hoTroNgatKetNoi(null), false);
});

test("kiểm tên miền: tên miền máy chủ đang giữ thì không bắt dạng *.myshopify.com, tên miền mới thì vẫn bắt", () => {
  const values = { shopDomain: "shop.fcentric.vn", accessToken: "", apiSecret: "", clientId: "", refreshToken: "" };
  // Gian hàng cũ lưu tên miền riêng, đang kết nối: ô khóa, lưu khóa mới được
  const daKetNoiTenMienRieng = { hasAccessToken: true, shopDomain: "shop.fcentric.vn", trangThai: 1, trangThaiKetNoi: "dang_hoat_dong" };
  assert.deepEqual(kiemTraGiaTriKetNoi(values, daKetNoiTenMienRieng), {});
  // Đã ngắt, ô mở và điền sẵn tên miền riêng cũ: kết nối lại cùng cửa hàng được (không bị ép đổi tên miền rồi ghép lại)
  const daNgatTenMienRieng = { hasAccessToken: false, shopDomain: "shop.fcentric.vn", trangThai: 0, trangThaiKetNoi: "chua_ket_noi" };
  assert.deepEqual(kiemTraGiaTriKetNoi({ ...values, accessToken: "shpat_x" }, daNgatTenMienRieng), {});
  assert.ok(kiemTraGiaTriKetNoi({ ...values, shopDomain: "shop-khac.vn", accessToken: "shpat_x" }, daNgatTenMienRieng).shopDomain);
  // Tên miền mới gõ vào ô mở (chưa kết nối, hoặc máy chủ cũ chưa ngắt được) vẫn bắt dạng chuẩn
  const chuaKetNoi = { hasAccessToken: false, shopDomain: "", trangThaiKetNoi: "chua_ket_noi" };
  assert.ok(kiemTraGiaTriKetNoi({ ...values, accessToken: "shpat_x" }, chuaKetNoi).shopDomain);
  const mayChuCu = { hasAccessToken: true, shopDomain: "shop.fcentric.vn", trangThai: 1 };
  assert.deepEqual(kiemTraGiaTriKetNoi(values, mayChuCu), {});
  assert.ok(kiemTraGiaTriKetNoi({ ...values, shopDomain: "shop-khac.vn" }, mayChuCu).shopDomain);
  // Trống thì luôn báo
  assert.equal(kiemTraGiaTriKetNoi({ ...values, shopDomain: " " }, daKetNoiTenMienRieng).shopDomain, "Nhập tên miền cửa hàng.");
  assert.deepEqual(kiemTraGiaTriKetNoi({ ...values, shopDomain: "fcentric-dev" }, chuaKetNoi), { accessToken: "Nhập khóa truy cập." });
});

test("câu xác nhận ngắt kết nối: nói rõ tồn và đơn trên sàn; Shopify nhắc gỡ ứng dụng", () => {
  const shopify = moTaNgatKetNoi(timSan("SHOPIFY"), { shopDomain: "fcentric-dev.myshopify.com" });
  assert.match(shopify, /^Hệ thống sẽ xóa mọi khóa đã lưu và dừng đồng bộ với fcentric-dev\.myshopify\.com\. /);
  assert.match(shopify, /Số tồn trên Shopify giữ nguyên như lần đẩy cuối, đơn mới sẽ không về FCentric\./);
  assert.match(shopify, /kết nối lại bằng cửa hàng khác thì phải ghép sản phẩm lại\./);
  assert.match(shopify, /hãy gỡ ứng dụng trong trang quản trị Shopify\.$/);
  assert.doesNotMatch(shopify, /ủy quyền/i);

  const lazada = moTaNgatKetNoi(timSan("LAZADA"), { tenGianHang: "Fashion House VN" });
  assert.match(lazada, /^Hệ thống sẽ xóa ủy quyền đã lưu và dừng đồng bộ với Fashion House VN\. Số tồn trên Lazada giữ nguyên/);
  assert.match(lazada, /các đơn đã về FCentric vẫn được giữ; ủy quyền lại bằng gian hàng khác thì phải ghép sản phẩm lại\.$/);
  assert.doesNotMatch(lazada, /gỡ ứng dụng/);

  // Chưa có tên gian hàng / tên miền thì gọi theo sàn
  assert.match(moTaNgatKetNoi(timSan("TIKTOK"), null), /dừng đồng bộ với gian hàng TikTok Shop\. Số tồn trên TikTok Shop/);
  assert.match(moTaNgatKetNoi(timSan("SHOPIFY"), {}), /dừng đồng bộ với cửa hàng Shopify\./);
});

test("bỏ khóa làm mới khi chỉ dán khóa truy cập: khi Shopify đã từ chối hoặc khóa truy cập quá hạn", () => {
  const oauth = { hasAccessToken: true, shopDomain: "fcentric-dev.myshopify.com", trangThai: 1, hasRefreshToken: true };
  // Máy chủ báo Hết hạn khóa (đã từ chối khóa làm mới)
  assert.equal(seBoKhoaLamMoi({ ...oauth, trangThaiKetNoi: "het_han" }), true);
  // Khóa truy cập quá hạn, khóa làm mới chưa bị từ chối (thẻ vẫn Đang hoạt động)
  assert.equal(seBoKhoaLamMoi({ ...oauth, trangThaiKetNoi: "dang_hoat_dong", tokenExpired: true }), true);
  assert.equal(seBoKhoaLamMoi({ ...oauth, trangThaiKetNoi: "dang_hoat_dong", isTokenExpired: true }), true);
  // Còn hạn, chưa bị từ chối: giữ khóa làm mới như cũ
  assert.equal(seBoKhoaLamMoi({ ...oauth, trangThaiKetNoi: "dang_hoat_dong", tokenExpired: false }), false);
  // Khóa tĩnh (không có khóa làm mới) thì không có gì để bỏ
  assert.equal(seBoKhoaLamMoi({ ...oauth, hasRefreshToken: false, trangThaiKetNoi: "het_han" }), false);
  assert.equal(seBoKhoaLamMoi(null), false);
});

test("trạng thái đơn trên sàn → chữ tiếng Việt (KH mục F); mã lạ giữ nguyên", () => {
  assert.equal(nhanTrangThaiSan("LAZADA", "ready_to_ship"), "Chờ lấy hàng");
  assert.equal(nhanTrangThaiSan("LAZADA", "shipped_back_success"), "Hoàn hàng");
  assert.equal(nhanTrangThaiSan("TIKTOK", "AWAITING_SHIPMENT"), "Chờ xử lý");
  assert.equal(nhanTrangThaiSan("TIKTOK", "COMPLETED"), "Hoàn thành");
  assert.equal(nhanTrangThaiSan("TIKTOK", "LA_LAM"), "Trạng thái khác (LA_LAM)");
  assert.equal(nhanTrangThaiSan("SHOPIFY", "paid"), "paid");
  assert.equal(nhanTrangThaiSan("TIKTOK", null), null);
});
test("GIAN_HANG_KHAC: giữ đúng tên miền đang hiện thì là đổi ở nơi khác, tự gõ tên miền khác thì không", () => {
  const config = { shopDomain: "cua-hang-a.myshopify.com", trangThaiKetNoi: "loi" };
  assert.equal(giuTenMienDangHien({ shopDomain: "cua-hang-a.myshopify.com" }, config), true);
  assert.equal(giuTenMienDangHien({ shopDomain: "https://Cua-Hang-A.myshopify.com/" }, config), true);
  assert.equal(giuTenMienDangHien({ shopDomain: "cua-hang-b.myshopify.com" }, config), false);
  assert.equal(giuTenMienDangHien({ shopDomain: "" }, { shopDomain: "" }), false);
  assert.equal(giuTenMienDangHien(null, config), false);
});
