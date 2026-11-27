import { test } from "node:test";
import assert from "node:assert/strict";
import { congHoaDon, tangMacDinh, xepViecKeToan } from "./viecKeToan.js";

const bd = (so, viec, chiTiet) => ({ loai: "bien_dong_kho", idNguon: 1, soChungTu: so, noiDung: "…", viec, chiTiet });

const xemTruoc = {
  bienDongKho: [
    bd("DCK-1", "xuat_kho_hao_hut", { maKho: "KHO_TRANSIT", soLuong: -2 }),
    bd("PXK-A", "khop_don_huy", { soLuong: -1, soDon: "SHP-1", maKho: "KHO_TONG", cap: "PXK-A", phieuXuat: "PXK-A" }),
    bd("PN-A", "khop_don_huy", { soLuong: 1, soDon: "SHP-1", cap: "PXK-A", phieuXuat: "PXK-A" }),
    bd("PXK-B", "lech_don_huy", { soLuong: -1, soDon: "SHP-2", cap: "PXK-B" }),
    bd("PN-B1", "lech_don_huy", { soLuong: 1, cap: "PXK-B" }),
    bd("PN-B2", "lech_don_huy", { soLuong: 1, cap: "PXK-B" }),
  ],
  canhBao: [
    { loai: "mua_hang", soChungTu: "PN1", viec: "nhan_hoa_don", chiTiet: { giaTri: 1000, thue: 80 } },
    { loai: "mua_hang", soChungTu: "PN2", viec: "nhan_hoa_don", chiTiet: { giaTri: 500, thue: 40 } },
    { loai: "ban_hang", soChungTu: "SO1", noiDung: "Cảnh báo cũ không có mã việc" },
    { loai: "tra_lai_quay", soChungTu: "RET-1", viec: "viec_moi_chua_biet" },
  ],
  phatSinhSauXuat: [{ loai: "ban_hang", soChungTu: "SO9", viec: "tra_lai_sau_xuat", chiTiet: { soLo: "LO-1" } }],
};

test("xếp ba tầng theo việc cần làm, mã lạ hay thiếu mã vào Xem lại", () => {
  const [lam, cho, xong] = xepViecKeToan(xemTruoc);
  assert.deepEqual(lam.nhom.map((n) => n.ma), ["xuat_kho_hao_hut", "lech_don_huy", "tra_lai_sau_xuat", "xem_lai"]);
  assert.equal(lam.nhom.find((n) => n.ma === "xem_lai").dong.length, 2);
  assert.equal(lam.nhom.find((n) => n.ma === "tra_lai_sau_xuat").dong[0].loTruoc, true);
  assert.deepEqual(cho.nhom.map((n) => n.ma), ["nhan_hoa_don"]);
  assert.deepEqual(xong.nhom.map((n) => n.ma), ["khop_don_huy"]);
  // Một cặp đơn hủy là một việc
  assert.deepEqual([lam.soViec, cho.soViec, xong.soViec], [5, 2, 1]);
});

test("ghép phiếu xuất với các phiếu nhập lại cùng cặp, tính chênh", () => {
  const [lam, , xong] = xepViecKeToan(xemTruoc);
  const khop = xong.nhom[0].dong[0];
  assert.equal(khop.xuat.soChungTu, "PXK-A");
  assert.deepEqual(khop.nhap.map((v) => v.soChungTu), ["PN-A"]);
  assert.equal(khop.soDon, "SHP-1");
  assert.equal(khop.chenh, 0);
  const lech = lam.nhom.find((n) => n.ma === "lech_don_huy").dong[0];
  assert.deepEqual([lech.soXuat, lech.soNhap, lech.chenh], [-1, 2, 1]);
});

test("tầng mở sẵn là tầng đầu có việc; không có việc nào thì null", () => {
  assert.equal(tangMacDinh(xepViecKeToan(xemTruoc)), "lam");
  assert.equal(tangMacDinh(xepViecKeToan({ canhBao: [{ viec: "khop_don_huy", chiTiet: {} }] })), "xong");
  assert.equal(tangMacDinh(xepViecKeToan({})), null);
  assert.equal(tangMacDinh(xepViecKeToan(null)), null);
});

test("cộng giá trị hàng và thuế chờ hóa đơn", () => {
  assert.deepEqual(congHoaDon(xemTruoc.canhBao.slice(0, 2)), { giaTri: 1500, thue: 120 });
  assert.deepEqual(congHoaDon([]), { giaTri: 0, thue: 0 });
});
