// Chạy: node --test src/components/order/hanBaoGia.test.js
// Hạn báo giá nhà cung cấp: nhãn Hết hạn, tiến trình, tóm tắt yêu cầu, màn gửi (hạn, vòng trước), việc cần làm ở cổng.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NHAN_HET_HAN,
  laChoBaoGia,
  laHetHan,
  ngayHan,
  nhanTrangThaiBaoGia,
  tinhBuocBaoGia,
  trangThaiGuiLaiYeuCau,
} from "./chi-tiet-bao-gia/tinhBaoGia.js";
import { daKhongChapNhanHet, daVeDaDuyetSauHoiGia, tinhBuocYeuCau, tomTatBaoGia } from "./chi-tiet-yeu-cau/tinhYeuCau.js";
import { hanKhiGui, ngayIsoVn, vongTruocTheoNcc } from "./gui-bao-gia/tinhGuiBaoGia.js";
import { xepViecCanLam } from "../supplier-portal/congUtils.js";

const don = (id, trangThai, extra = {}) => ({
  id,
  trangThai,
  soDonMua: `PO${id}`,
  ngayDatHang: "2026-11-26T03:15:00Z",
  ngayGuiYeuCau: "2026-11-26T03:15:20Z",
  nhaCungCap: { id: id * 10, tenNhaCungCap: `Xưởng ${id}` },
  chiTietDonMuaHangs: [],
  ...extra,
});

test("laHetHan: trạng thái 8, hoặc 2 chưa báo giá có cờ quaHanBaoGia; đã báo giá thì không", () => {
  assert.equal(laHetHan(don(1, 8)), true);
  assert.equal(laHetHan(don(1, 2, { quaHanBaoGia: true })), true, "0:00–8:00: máy chủ chưa ghi 8");
  assert.equal(laHetHan(don(1, 2, { quaHanBaoGia: true, ngayBaoGia: "2026-11-28T02:00:00Z" })), false);
  assert.equal(laHetHan(don(1, 2)), false);
  assert.equal(laHetHan(don(1, 4)), false);
  assert.equal(laHetHan(null), false);
});

test("nhãn: Hết hạn thay Chờ báo giá; ngày hạn đọc thẳng chuỗi, không lệch múi giờ", () => {
  assert.equal(nhanTrangThaiBaoGia(don(1, 2, { quaHanBaoGia: true }), "Đã nhận báo giá"), NHAN_HET_HAN);
  assert.equal(nhanTrangThaiBaoGia(don(1, 8), "Hết hạn"), NHAN_HET_HAN);
  assert.equal(nhanTrangThaiBaoGia(don(1, 2), "Đã nhận báo giá"), "Chờ báo giá");
  assert.equal(laChoBaoGia(don(1, 2, { quaHanBaoGia: true })), false);
  assert.equal(ngayHan("2026-12-01"), "01/12/2026");
  assert.equal(ngayHan(null), "");
});

test("tiến trình báo giá hết hạn: bước nhà cung cấp gửi giá dừng, kèm ngày hạn; không hiện gửi lại email", () => {
  const buoc = tinhBuocBaoGia(don(1, 8, { hanBaoGia: "2026-12-01", ngayGuiYeuCau: null }));
  assert.equal(buoc[1].trangThai, "dung");
  assert.equal(buoc[1].phu, "Hết hạn ngày 01/12/2026");
  assert.equal(buoc[2].trangThai, "chua");
  const quaHanChuaGhi = don(1, 2, { quaHanBaoGia: true, ngayGuiYeuCau: null, chuaGuiDuocYeuCau: true });
  assert.equal(trangThaiGuiLaiYeuCau(quaHanChuaGhi, { duocGui: true }), null, "qua hạn thì gửi lại email vô ích");
});

test("tóm tắt yêu cầu: đếm hết hạn, không tính là còn chờ; không chấp nhận + hết hạn đủ thì dừng", () => {
  const yc = { trangThai: 3, donMuaHangs: [don(1, 4), don(2, 8), don(3, 2, { quaHanBaoGia: true })] };
  const tt = tomTatBaoGia(yc);
  assert.equal(tt.hetHan, 2);
  assert.equal(tt.conCho, 0);
  assert.equal(daKhongChapNhanHet(tt), true);
  const nhan = tinhBuocYeuCau(yc).find((b) => b.ma === "nhan");
  assert.equal(nhan.trangThai, "dung");
  assert.equal(nhan.phu, "Không có báo giá nào được chọn", "có báo giá hết hạn: không gọi là không chấp nhận");
});

test("yêu cầu về Đã duyệt sau một vòng hỏi giá: nhận ra được, tiến trình chờ gửi nhà cung cấp khác", () => {
  const yc = { trangThai: 2, donMuaHangs: [don(1, 4), don(2, 8)] };
  assert.equal(daVeDaDuyetSauHoiGia(yc), true);
  assert.equal(daVeDaDuyetSauHoiGia({ trangThai: 2, donMuaHangs: [] }), false, "chưa gửi lần nào");
  assert.equal(daVeDaDuyetSauHoiGia({ trangThai: 3, donMuaHangs: [don(1, 2)] }), false);
  const gui = tinhBuocYeuCau(yc).find((b) => b.ma === "gui");
  assert.equal(gui.trangThai, "dangLam");
  assert.equal(gui.phu, "Chờ gửi lại cho nhà cung cấp khác");
});

test("hạn khi gửi: hiện ngày, số ngày, ngày nhắc; hạn quá gần thì không nhắc", () => {
  const bayGio = new Date("2026-11-26T03:15:00Z"); // 10:15 ngày 26/11 giờ VN
  const yc = { hanBaoGiaNeuGui: "2026-12-01", soNgayBaoGia: 5, ngayGiaoDuKien: "2026-12-09T17:00:00Z" };
  assert.deepEqual(hanKhiGui(yc, bayGio), { han: "01/12/2026", soNgay: 5, nhac: "30/11", canhBao: "" });
  // Hạn là ngày mai: 8:00 hôm nay đã qua nên không nhắc
  assert.equal(hanKhiGui({ hanBaoGiaNeuGui: "2026-11-27", soNgayBaoGia: 1 }, bayGio).nhac, "");
  // Gửi 7:30 sáng với hạn ngày mai: kịp nhắc 8:00 cùng ngày (khớp máy chủ)
  assert.equal(hanKhiGui({ hanBaoGiaNeuGui: "2026-11-27" }, new Date("2026-11-26T00:30:00Z")).nhac, "26/11");
  assert.equal(hanKhiGui({}, bayGio), null, "máy chủ cũ chưa trả hạn: ẩn nhóm");
});

test("hạn khi gửi: cảnh báo hạn sau ngày cần hàng, hoặc ngày cần hàng đã qua (không chặn)", () => {
  const bayGio = new Date("2026-11-26T03:15:00Z");
  const sau = hanKhiGui({ hanBaoGiaNeuGui: "2026-12-01", ngayGiaoDuKien: "2026-11-28T17:00:00Z" }, bayGio);
  assert.equal(sau.canhBao, "Hạn báo giá sau ngày cần hàng 29/11/2026, hàng có thể về trễ.");
  const qua = hanKhiGui({ hanBaoGiaNeuGui: "2026-12-01", ngayGiaoDuKien: "2026-11-19T17:00:00Z" }, bayGio);
  assert.equal(qua.canhBao, "Đã quá ngày cần hàng 20/11/2026. Kiểm lại với kho trước khi gửi.");
  assert.equal(ngayIsoVn("2026-11-26T17:30:00Z"), "2026-11-27", "0:30 giờ VN đã sang ngày sau");
});

test("vòng trước: kết quả lần hỏi giá mới nhất của từng nhà cung cấp, chỉ khi yêu cầu ở Đã duyệt", () => {
  const yc = {
    trangThai: 2,
    donMuaHangs: [
      don(1, 4),
      don(2, 8, { nhaCungCap: { id: 20 } }),
      don(3, 0, { nhaCungCap: { id: 30 } }),
      don(5, 2, { quaHanBaoGia: true, nhaCungCap: { id: 10 } }),
    ],
  };
  const m = vongTruocTheoNcc(yc);
  assert.equal(m.get(10).nhan, "Hết hạn", "lần mới nhất (đơn 5) thắng lần cũ (đơn 1)");
  assert.equal(m.get(20).nhan, "Hết hạn");
  assert.equal(m.has(30), false, "báo giá đã xóa không tính");
  assert.equal(vongTruocTheoNcc({ ...yc, trangThai: 3 }).size, 0);
  const tuChoi = vongTruocTheoNcc({ trangThai: 2, donMuaHangs: [don(1, 4)] });
  assert.equal(tuChoi.get(10).nhan, "Không chấp nhận báo giá");
  assert.equal(tuChoi.get(10).ngayGui, "2026-11-26T03:15:20Z");
});

test("cổng, việc cần làm: đơn chờ báo giá xếp theo hạn báo giá (hôm nay đỏ, còn 1 ngày cam)", () => {
  const bayGio = new Date("2026-11-30T03:00:00Z"); // 10:00 ngày 30/11 giờ VN
  const ds = xepViecCanLam({
    donChoBaoGia: [
      { id: 1, soDonMua: "PO1", hanBaoGia: "2026-12-05", ngayCanGiao: "2026-11-30T17:00:00Z" },
      { id: 2, soDonMua: "PO2", hanBaoGia: "2026-12-01" },
      { id: 3, soDonMua: "PO3", hanBaoGia: "2026-11-30" },
      { id: 4, soDonMua: "PO4", ngayCanGiao: "2026-12-02T17:00:00Z" },
    ],
  }, bayGio);
  const theoId = Object.fromEntries(ds.map((v) => [v.id, v]));
  assert.equal(theoId[3].mucGap, "do", "hạn là hôm nay");
  assert.equal(theoId[2].mucGap, "cam", "còn 1 ngày: cùng lúc email nhắc");
  assert.equal(theoId[1].mucGap, "xam", "theo hạn, không theo ngày cần giao gần");
  assert.equal(theoId[4].mucGap, "cam", "đơn cũ không có hạn: vẫn theo ngày cần giao (còn 3 ngày)");
  assert.deepEqual(ds.slice(0, 1).map((v) => v.id), [3]);
});
