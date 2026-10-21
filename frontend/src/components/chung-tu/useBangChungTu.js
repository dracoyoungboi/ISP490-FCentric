import { useState } from "react";
import {
  chuGoiYThuGon,
  chuTimThay,
  dungBangChungTu,
  khoaNhomCua,
  luaChonCoTrangMacDinh,
  nhomDangMo,
  soVN,
  timTrangCuaDong,
} from "./bangChungTu.js";

/**
 * State của bảng hàng trong màn chi tiết chứng từ: từ khóa, trang, cỡ trang, nhóm mở / thu gọn, lọc nhanh, chế độ xem.
 * Dữ liệu hiển thị tính bằng `dungBangChungTu` (xem bangChungTu.js). Đổi từ khóa, lọc nhanh hay cỡ trang thì về trang đầu;
 * dữ liệu tải lại ngầm thì giữ nguyên trang (tự kẹp nếu chứng từ ngắn lại).
 *
 * @param dong  các dòng chứng từ (đã đổi sang dạng ở đầu bangChungTu.js), nên ổn định qua useMemo
 * @param tuyChon
 *   - `theo`: "nhom" (mặc định) | "dong"
 *   - `donVi`: đơn vị của một dòng trong chữ "Tìm thấy…" và chân phân trang (mặc định "biến thể" / "dòng")
 *   - `boLoc`: `{ [ma]: (dong) => boolean | null }` các lựa chọn lọc nhanh (null = không lọc); `locMacDinh`: mã mặc định
 *   - `luaChonCoTrang`, `nguongCongCu`, `nguongThuGon`, `tongTheo`: xem dungBangChungTu
 *   - `cheDoXemMacDinh`: mặc định "danhSach"
 * @returns mọi trường của dungBangChungTu, cùng
 *   `tuKhoa, datTuKhoa(chu), xoaTuKhoa(), datTrang(t), datCoTrang(n), luaChonCoTrang, locNhanh, datLoc(ma), xoaLoc(),
 *   demLoc, cheDoXem, datCheDoXem(ma), doiNhom(khoa), doiMoTatCa(), denDong(id) → boolean, chuKetQua, chuGoiYThuGon,
 *   phanTrang` (`phanTrang`: props cho PhanTrangBang / TablePagination, `null` khi không phân trang;
 *   `chuGoiYThuGon`: câu "Hơn 30 biến thể nên đang thu gọn…" hoặc "", đặt cạnh tiêu đề bảng).
 */
export default function useBangChungTu(dong, tuyChon = {}) {
  const {
    theo = "nhom",
    donVi,
    boLoc,
    locMacDinh,
    luaChonCoTrang: luaChon,
    nguongCongCu,
    nguongThuGon,
    tongTheo,
    cheDoXemMacDinh = "danhSach",
  } = tuyChon;
  const luaChonCoTrang = luaChon?.length ? luaChon : luaChonCoTrangMacDinh(theo);
  const maLocDau = locMacDinh ?? (boLoc ? Object.keys(boLoc)[0] : null);

  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState(0);
  const [coTrang, setCoTrang] = useState(luaChonCoTrang[0]);
  const [moNhom, setMoNhom] = useState({});
  const [locNhanh, setLocNhanh] = useState(maLocDau);
  const [cheDoXem, setCheDoXem] = useState(cheDoXemMacDinh);

  const locCua = (ma) => (boLoc && typeof boLoc[ma] === "function" ? boLoc[ma] : null);
  const loc = locCua(locNhanh);
  const ds = Array.isArray(dong) ? dong : [];

  // Tính lại mỗi lần vẽ: thuần, O(số dòng), chữ tìm của từng dòng đã nhớ sẵn (bangChungTu.js → chuTimCua)
  const bang = dungBangChungTu(ds, { theo, tuKhoa, loc, trang, coTrang, moNhom, nguongCongCu, nguongThuGon, tongTheo });

  // Số dòng của từng lựa chọn lọc nhanh, đếm trên cả chứng từ (không theo từ khóa)
  const demLoc = boLoc
    ? Object.fromEntries(
      Object.entries(boLoc).map(([ma, ham]) => [ma, typeof ham === "function" ? ds.filter(ham).length : ds.length]),
    )
    : {};

  const datTuKhoa = (chu) => {
    setTuKhoa(chu ?? "");
    setTrang(0);
    // Tìm kiếm tự mở nhóm khớp: bỏ các lần bấm mở / thu gọn trước đó
    setMoNhom({});
  };

  const datCoTrang = (n) => {
    setCoTrang(n);
    setTrang(0);
  };

  const datLoc = (ma) => {
    setLocNhanh(ma);
    setTrang(0);
  };

  const doiNhom = (khoa) => {
    const cachMo = { dangTim: bang.dangTim, thuGonMacDinh: bang.thuGonMacDinh, thuGonDuoc: bang.coCongCu };
    setMoNhom((cu) => ({ ...cu, [khoa]: !nhomDangMo(khoa, { ...cachMo, moNhom: cu }) }));
  };

  const doiMoTatCa = () => {
    const mo = !bang.moHet;
    setMoNhom((cu) => ({ ...cu, ...Object.fromEntries(bang.khoaNhomLoc.map((k) => [k, mo])) }));
  };

  /**
   * Đưa bảng tới dòng `id` (sau khi quét): chuyển đúng trang, mở nhóm chứa dòng. Bộ lọc đang che dòng thì
   * xóa từ khóa và về lọc mặc định ("Tất cả"). Trả `false` nếu chứng từ không có dòng này.
   */
  const denDong = (id) => {
    const muc = ds.find((d) => d?.id != null && String(d.id) === String(id));
    if (!muc) return false;
    const co = bang.coCongCu ? coTrang : Infinity;
    let t = timTrangCuaDong(ds, id, { theo, coTrang: co, tuKhoa, loc });
    const boLocCu = t < 0;
    if (boLocCu) {
      t = timTrangCuaDong(ds, id, { theo, coTrang: co, tuKhoa: "", loc: locCua(maLocDau) });
      if (t < 0) return false;
      setTuKhoa("");
      setLocNhanh(maLocDau);
    }
    setTrang(t);
    if (theo !== "dong") {
      setMoNhom((cu) => ({ ...(boLocCu ? {} : cu), [khoaNhomCua(muc)]: true }));
    }
    return true;
  };

  const donViDong = donVi ?? (theo === "dong" ? "dòng" : "biến thể");
  const phanTrangProps = bang.coPhanTrang
    ? {
      page: bang.trang,
      size: bang.coTrang,
      total: bang.tongMuc,
      onPageChange: setTrang,
      onSizeChange: datCoTrang,
      sizeOptions: luaChonCoTrang,
      sizeLabel: bang.theo === "nhom" ? "sản phẩm" : donViDong,
      totalLabel: bang.theo === "nhom" ? "sản phẩm" : donViDong,
      totalNote: bang.theo === "nhom" ? `${soVN(bang.ketQua.soDong)} ${donViDong}` : undefined,
    }
    : null;

  return {
    ...bang,
    tuKhoa,
    datTuKhoa,
    xoaTuKhoa: () => datTuKhoa(""),
    datTrang: setTrang,
    datCoTrang,
    luaChonCoTrang,
    locNhanh,
    datLoc,
    xoaLoc: () => datLoc(maLocDau),
    demLoc,
    cheDoXem,
    datCheDoXem: setCheDoXem,
    doiNhom,
    doiMoTatCa,
    denDong,
    chuKetQua: chuTimThay(bang, { donVi: donViDong }),
    chuGoiYThuGon: chuGoiYThuGon(bang, nguongThuGon),
    phanTrang: phanTrangProps,
  };
}
