import { useCallback, useEffect, useRef, useState } from "react";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import { chayGioiHan } from "@/components/chung-tu/chayGioiHan";
import { SO_VIEC_DONG_THOI } from "@/config/bangChungTu";
import { docKhoaTaiLo, ghepLoDong, khoaTaiLo } from "./phieuXuat.js";

/**
 * Lô đã lấy của từng dòng phiếu xuất, bằng đúng hai API trang in đang gọi:
 * GET …/{id}/picked-lots/{ctId} (lô + số lượng) và, khi dòng có lô, GET …/{id}/available-lots?bienTheSanPhamId= (tên lô;
 * gọi một lần cho mỗi biến thể). Tối đa SO_VIEC_DONG_THOI dòng tải cùng lúc (chung-tu/chayGioiHan), dòng nào xong hiện dòng
 * đó; lỗi một dòng chỉ đánh dấu dòng đó ("loi"), không làm hỏng trang.
 *
 * Chỉ tải lại khi phiếu, trạng thái hay số đã lấy của một dòng đổi (khoaTaiLo): tải ngầm phiếu khi quay lại tab mà không
 * có gì đổi thì không gọi lại. Trong lúc tải lại giữ lô cũ đang hiện, không nháy.
 * @returns `{ theoDong: { [ctId]: { trangThai: "xong" | "loi", lo } }, soLoi, taiLai() }` — dòng chưa có mục là đang tải.
 */
export default function useLoTheoDong(phieuId, trangThai, chiTiet) {
  const [ketQua, setKetQua] = useState({ cua: null, theoDong: {} });
  const [lanThu, setLanThu] = useState(0);
  const luotRef = useRef(0);
  const khoa = khoaTaiLo(phieuId, trangThai, chiTiet);

  useEffect(() => {
    const { phieuId: idPhieu, dong } = docKhoaTaiLo(khoa);
    if (idPhieu == null || dong.length === 0) return undefined;
    const luot = ++luotRef.current;
    const conHieuLuc = () => luot === luotRef.current;

    // Tên lô theo biến thể: nhiều dòng cùng biến thể chỉ gọi một lần
    const tenLoTheoBienThe = new Map();
    const layTenLo = (bienTheId) => {
      if (!tenLoTheoBienThe.has(bienTheId)) {
        tenLoTheoBienThe.set(bienTheId, phieuXuatKhoService.getAvailableLots(idPhieu, bienTheId));
      }
      return tenLoTheoBienThe.get(bienTheId);
    };

    // Lượt đã bị thay (rời trang, đổi phiếu, thử lại) thì các việc chưa chạy dừng luôn, không gọi API nữa
    const viec = dong.map((ct) => async () => {
      if (!conHieuLuc()) return null;
      const daLay = await phieuXuatKhoService.getPickedLots(idPhieu, ct.id);
      if (!conHieuLuc()) return null;
      const ds = Array.isArray(daLay) ? daLay : [];
      const tenLo = ds.length && ct.bienTheSanPhamId != null ? await layTenLo(ct.bienTheSanPhamId) : [];
      return ghepLoDong(ds, tenLo);
    });

    chayGioiHan(viec, SO_VIEC_DONG_THOI, (i, kq) => {
      if (!conHieuLuc()) return;
      const ctId = dong[i].id;
      setKetQua((cu) => {
        const theoDong = cu.cua === idPhieu ? cu.theoDong : {};
        const muc = kq.ok
          ? { trangThai: "xong", lo: kq.giaTri }
          : { trangThai: "loi", lo: theoDong[ctId]?.lo ?? [] };
        return { cua: idPhieu, theoDong: { ...theoDong, [ctId]: muc } };
      });
    });

    return () => {
      // Lần tải sau (đổi phiếu, đổi số đã lấy, thử lại) thay lần này: kết quả về muộn bị bỏ qua
      if (conHieuLuc()) luotRef.current += 1;
    };
  }, [khoa, lanThu]);

  const theoDong = ketQua.cua === phieuId ? ketQua.theoDong : {};
  const dsId = Array.isArray(chiTiet) ? chiTiet.map((ct) => ct.id) : [];
  const soLoi = dsId.filter((ctId) => theoDong[ctId]?.trangThai === "loi").length;

  // Thử lại: dòng lỗi về "đang tải" ngay, dòng đã có lô giữ nguyên tới khi có kết quả mới
  const taiLai = useCallback(() => {
    setKetQua((cu) => ({
      ...cu,
      theoDong: Object.fromEntries(Object.entries(cu.theoDong).filter(([, muc]) => muc.trangThai !== "loi")),
    }));
    setLanThu((n) => n + 1);
  }, []);

  return { theoDong, soLoi, taiLai };
}
