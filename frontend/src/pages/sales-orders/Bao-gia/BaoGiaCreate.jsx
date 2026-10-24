import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Package, Save, ScanBarcode, Search, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { donBanHangService } from "@/services/donBanHangService";
import { formatCurrency } from "@/utils/formatters";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import BangHangTaoPhieu from "@/components/chung-tu/BangHangTaoPhieu";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import useBangChungTu from "@/components/chung-tu/useBangChungTu";
import { docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import TongTienBan from "@/components/ban-hang/TongTienBan";
import {
  chonKhiEnter,
  chuanHoaDong,
  docOSoLuong,
  docOTien,
  idBaoGiaMoi,
  kiemTraDonGia,
  locKhach,
  lyDoKhoaLuu,
  SO_LUONG_TOI_DA,
  taoBodyBaoGia,
  timBienThe,
} from "@/components/ban-hang/tao-bao-gia/tinhTaoBaoGia";
import { DIA_CHI_GIAO_TOI_DA, GHI_CHU_BAO_GIA_TOI_DA, NGUONG_CONG_CU } from "@/config/bangChungTu";

const TONG_THEO = Object.freeze({ soLuong: "soLuong", thanhTien: "thanhTien" });

const BUOC = [
  { ma: "lap", nhan: "Lập báo giá", trangThai: "dangLam", phu: "Đang lập" },
  { ma: "phanHoi", nhan: "Khách phản hồi", trangThai: "chua", phu: "Chờ phản hồi sau khi lưu" },
  { ma: "chot", nhan: "Chốt thành đơn", trangThai: "chua", phu: "Giữ nguyên đơn giá từng dòng" },
];

const DANH_SACH_GOI_Y =
  "absolute z-30 max-h-[320px] overflow-y-auto rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const MUC_GOI_Y = "flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left hover:bg-slate-100";
const CAU_MAT_KET_NOI = "không nhận được phản hồi từ máy chủ";

/** Câu lỗi tải danh sách: 403 → thiếu quyền (Thử lại vô ích); mất kết nối; còn lại câu của máy chủ, bỏ dấu chấm cuối. */
function moTaLoiTai(e, chuThieuQuyen) {
  if (getApiErrorStatus(e) === 403) return { chu: chuThieuQuyen, khongQuyen: true };
  if (!e?.response) return { chu: CAU_MAT_KET_NOI, khongQuyen: false };
  return { chu: getApiErrorMessage(e, "máy chủ báo lỗi").trim().replace(/[.。]+$/, ""), khongQuyen: false };
}

/** "0912345678" → "0912 345 678"; số khác 10 chữ số giữ nguyên. */
function sdtHien(sdt) {
  const s = String(sdt ?? "").trim();
  return /^\d{10}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 7)} ${s.slice(7)}` : s;
}

/**
 * Một dòng báo giá từ biến thể (dữ liệu /don-ban-hang/variants-for-create): đơn giá mặc định = giá niêm yết làm tròn
 * tới đồng (ô tiền chỉ nhận số nguyên; giá lẻ như 99.999,99 sửa một chữ số sẽ bị đọc lệch).
 */
function taoDong(bienThe) {
  return {
    bienTheId: bienThe.id,
    sanPhamId: bienThe.sanPhamId ?? null,
    tenSanPham: bienThe.tenSanPham || bienThe.maBienThe || "",
    sku: bienThe.maBienThe || "",
    maVach: bienThe.maVachSku || "",
    tenMau: bienThe.tenMau || "",
    maMauHex: bienThe.maMauHex || "",
    kichCo: bienThe.tenSize || "",
    chatLieu: bienThe.tenChatLieu || "",
    giaNiemYet: docSo(bienThe.giaBan),
    soLuong: 1,
    donGia: Math.round(docSo(bienThe.giaBan)),
  };
}

/**
 * Phím của ô tìm có danh sách gợi ý (combobox): ↑ / ↓ di chuyển mục đang chọn (tiêu điểm vẫn ở ô nhập, mục đọc qua
 * aria-activedescendant), Enter chọn mục đó, Esc đóng. Trả true khi đã xử lý phím.
 */
function phimDanhSach(e, { mo, soMuc, chiSo, datChiSo, datMo, chon }) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!mo) { datMo(true); datChiSo(soMuc ? 0 : -1); return true; }
    if (!soMuc) return true;
    const buoc = e.key === "ArrowDown" ? 1 : -1;
    datChiSo(chiSo < 0 ? (buoc > 0 ? 0 : soMuc - 1) : (chiSo + buoc + soMuc) % soMuc);
    return true;
  }
  if (e.key === "Enter" && mo && chiSo >= 0 && chiSo < soMuc) {
    e.preventDefault();
    chon(chiSo);
    return true;
  }
  if (e.key === "Escape" && mo) {
    datMo(false);
    datChiSo(-1);
    return true;
  }
  return false;
}

/**
 * Tạo báo giá bán (/sales-quotations/create) · khối chứng từ "một khối" như Chi tiết báo giá và các màn tạo chứng từ
 * (mẫu: Tạo phiếu chuyển kho). Ô tìm / quét thêm biến thể (quét lại cùng mã cộng 1), bảng gom theo sản phẩm sửa được
 * số lượng và đơn giá, dải tổng tiền có ô phí vận chuyển, cột phải: khách hàng, địa chỉ nhận, ghi chú.
 *
 * - Đơn giá mỗi dòng trong 90%–110% giá niêm yết (báo ngay ở dòng; máy chủ chặn cùng khoảng). Nút Lưu khóa kèm lý do.
 * - Mở từ Chi tiết khách hàng (?khachHangId=): chọn sẵn khách đó (chỉ khách đang hoạt động).
 * - POST /don-ban-hang/create (loaiChungTu "bao_gia") → mở Chi tiết báo giá vừa tạo. Đang nhập dở mà rời trang thì hỏi.
 */
export default function BaoGiaCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const khachHangIdBanDau = searchParams.get("khachHangId");
  const idMan = useId();

  const oTimRef = useRef(null);
  const henSangRef = useRef(0);
  const henDongSPRef = useRef(0);
  const henDongKhachRef = useRef(0);
  const dangLuuRef = useRef(false);
  const daDienSanRef = useRef(false);
  const canFocusKhachRef = useRef(false);
  // Lượt tải của từng danh sách: bấm "Thử lại" nhiều lần thì chỉ nhận phản hồi của lượt mới nhất
  const luotBienTheRef = useRef(0);
  const luotKhachRef = useRef(0);

  const [bienThe, setBienThe] = useState([]);
  const [dsKhach, setDsKhach] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loiBienThe, setLoiBienThe] = useState(null); // { chu, khongQuyen }
  const [loiKhach, setLoiKhach] = useState(null);

  const [timSP, setTimSP] = useState("");
  const [moSP, setMoSP] = useState(false);
  const [chiSoSP, setChiSoSP] = useState(-1);
  const [goiYTim, setGoiYTim] = useState("");
  const [dongSang, setDongSang] = useState(null);

  const [khachId, setKhachId] = useState(null);
  const [timKhach, setTimKhach] = useState("");
  const [moKhach, setMoKhach] = useState(false);
  const [chiSoKhach, setChiSoKhach] = useState(-1);

  const [form, setForm] = useState({ phiVanChuyen: 0, diaChiGiaoHang: "", ghiChu: "" });
  const [dong, setDong] = useState([]);
  // Ô tiền đang gõ (`gia-<id>` | "phi"): hiện chữ số thô để con trỏ không nhảy; rời ô mới định dạng "120.000"
  const [oDangGo, setODangGo] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [daLuu, setDaLuu] = useState(false);
  const [hoiRoi, setHoiRoi] = useState(null);

  useEffect(() => () => {
    clearTimeout(henSangRef.current);
    clearTimeout(henDongSPRef.current);
    clearTimeout(henDongKhachRef.current);
  }, []);

  // Sản phẩm và khách tải độc lập: một bên lỗi thì bên kia vẫn dùng được, mỗi bên có dòng báo lỗi riêng
  const taiBienThe = useCallback(async () => {
    const luot = ++luotBienTheRef.current;
    try {
      const res = await donBanHangService.getVariantsForCreate();
      if (luot !== luotBienTheRef.current) return;
      setBienThe(res?.data?.data || []);
      setLoiBienThe(null);
    } catch (e) {
      if (luot !== luotBienTheRef.current) return;
      setLoiBienThe(moTaLoiTai(e, "tài khoản chưa có quyền xem danh sách sản phẩm"));
    }
  }, []);

  const taiKhach = useCallback(async () => {
    const luot = ++luotKhachRef.current;
    try {
      const res = await donBanHangService.getCustomersForCreate();
      if (luot !== luotKhachRef.current) return;
      const ds = res?.data?.data || [];
      setDsKhach(ds);
      setLoiKhach(null);
      // Mở từ Chi tiết khách hàng: chọn sẵn một lần (danh sách chỉ gồm khách đang hoạt động)
      if (khachHangIdBanDau && !daDienSanRef.current) {
        daDienSanRef.current = true;
        const khach = ds.find((k) => String(k.id) === khachHangIdBanDau);
        if (khach) {
          setKhachId(khach.id);
          setForm((cu) => ({ ...cu, diaChiGiaoHang: khach.diaChi || "" }));
        } else {
          toast.warning("Khách hàng này đang ngừng hoạt động hoặc không còn trong hệ thống. Vui lòng chọn khách khác.");
        }
      }
    } catch (e) {
      if (luot !== luotKhachRef.current) return;
      setLoiKhach(moTaLoiTai(e, "tài khoản chưa có quyền xem danh sách khách hàng"));
    }
  }, [khachHangIdBanDau]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect (react-hooks/set-state-in-effect)
  useEffect(() => {
    queueMicrotask(async () => {
      await Promise.all([taiBienThe(), taiKhach()]);
      setDangTai(false);
    });
  }, [taiBienThe, taiKhach]);

  // ── Bảng hàng: dòng chứng từ gom theo sản phẩm (màu / cỡ / SKU), tìm và phân trang khi nhiều dòng ──
  const dongBang = useMemo(() => dong.map((d) => ({
    id: d.bienTheId,
    khoaNhom: d.sanPhamId,
    tenSanPham: d.tenSanPham,
    tenMau: d.tenMau,
    maMauHex: d.maMauHex,
    kichCo: d.kichCo,
    sku: d.sku,
    maVach: d.maVach,
    chuTimThem: d.chatLieu,
    soLuong: docSo(d.soLuong),
    thanhTien: docSo(d.soLuong) * docSo(d.donGia),
    oSoLuong: d.soLuong,
    donGia: d.donGia,
    giaNiemYet: d.giaNiemYet,
    loiGia: kiemTraDonGia(d.donGia, d.giaNiemYet).loi,
  })), [dong]);
  const bangHang = useBangChungTu(dongBang, { tongTheo: TONG_THEO });
  const { denDong } = bangHang;

  // Số dòng sai giá theo sản phẩm, đếm trên cả báo giá (dòng nhóm báo cả khi nhóm thu gọn hoặc ô tìm đang lọc)
  const soSaiTheoNhom = useMemo(() => {
    const dem = new Map();
    for (const d of dongBang) {
      if (d.loiGia && d.loiGia !== "trong") dem.set(d.khoaNhom ?? d.tenSanPham, (dem.get(d.khoaNhom ?? d.tenSanPham) ?? 0) + 1);
    }
    return dem;
  }, [dongBang]);

  // Vừa thêm / quét một mã: đưa bảng tới trang và nhóm có mã đó
  useEffect(() => {
    if (dongSang == null) return;
    queueMicrotask(() => denDong(dongSang));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dongSang]);

  const khach = dsKhach.find((k) => k.id === khachId) ?? null;
  const goiYSP = useMemo(() => timBienThe(bienThe, timSP), [bienThe, timSP]);
  const goiYKhach = useMemo(() => locKhach(dsKhach, timKhach), [dsKhach, timKhach]);
  const moDsSP = moSP && !dangLuu;
  const moDsKhach = moKhach && !khach && !dangLuu;

  // Mục đang chọn bằng phím mũi tên luôn nằm trong vùng nhìn thấy của danh sách
  useEffect(() => {
    if (chiSoSP >= 0) document.getElementById(`${idMan}-sp-${chiSoSP}`)?.scrollIntoView({ block: "nearest" });
  }, [chiSoSP, idMan]);
  useEffect(() => {
    if (chiSoKhach >= 0) document.getElementById(`${idMan}-kh-${chiSoKhach}`)?.scrollIntoView({ block: "nearest" });
  }, [chiSoKhach, idMan]);

  const datDong = (bienTheId, vao) =>
    setDong((cu) => cu.map((d) => (d.bienTheId === bienTheId ? { ...d, ...vao } : d)));

  // Chọn lại mã đã có (vd. quét lần nữa): cộng 1 thay vì báo trùng. Đóng danh sách để dòng vừa tô sáng không bị che
  const themBienThe = (bt) => {
    setDong((cu) => (cu.some((d) => d.bienTheId === bt.id)
      ? cu.map((d) => (d.bienTheId === bt.id ? { ...d, soLuong: Math.min(docSo(d.soLuong) + 1, SO_LUONG_TOI_DA) } : d))
      : [...cu, taoDong(bt)]));
    setDongSang(bt.id);
    clearTimeout(henSangRef.current);
    henSangRef.current = setTimeout(() => setDongSang(null), 1200);
    setTimSP("");
    setGoiYTim("");
    setMoSP(false);
    setChiSoSP(-1);
    oTimRef.current?.focus();
  };

  const enterTim = () => {
    const kq = chonKhiEnter(bienThe, timSP);
    if (!kq) return;
    if (kq.bienThe) return themBienThe(kq.bienThe);
    const tho = timSP.trim();
    setMoSP(true);
    if (kq.loi === "nhieu") setGoiYTim(`Nhiều sản phẩm khớp “${tho}”, chọn trong danh sách (phím ↑ ↓ rồi Enter).`);
    else if (dangTai) setGoiYTim("Đang tải danh sách sản phẩm, thử lại sau giây lát.");
    else if (loiBienThe) setGoiYTim("Chưa tải được danh sách sản phẩm, xem dòng báo lỗi phía trên.");
    else setGoiYTim(`Không tìm thấy sản phẩm “${tho}”.`);
  };

  const boDong = (bienTheId) => {
    // Còn ít dòng thì ô tìm trong bảng ẩn đi: bỏ từ khóa để không giấu dòng mà không có cách bỏ lọc
    if (dong.length - 1 <= NGUONG_CONG_CU) bangHang.xoaTuKhoa();
    setDong((cu) => cu.filter((d) => d.bienTheId !== bienTheId));
  };

  const chonKhach = (k) => {
    clearTimeout(henDongKhachRef.current);
    setKhachId(k.id);
    setTimKhach("");
    setMoKhach(false);
    setChiSoKhach(-1);
    setForm((cu) => ({ ...cu, diaChiGiaoHang: k.diaChi || "" }));
  };

  // "Đổi": ô tìm khách thay chỗ thẻ khách, con trỏ vào ô ngay khi ô hiện ra
  const doiKhach = () => {
    canFocusKhachRef.current = true;
    setKhachId(null);
    setTimKhach("");
    setChiSoKhach(-1);
    setMoKhach(true);
  };
  const refOKhach = (el) => {
    if (el && canFocusKhachRef.current) {
      canFocusKhachRef.current = false;
      el.focus();
    }
  };

  // Dòng như khi gửi (ô số lượng / đơn giá đang trống tính như lúc rời ô): bấm Lưu ngay lúc ô còn trống vẫn lưu được
  const dongGui = useMemo(() => dong.map(chuanHoaDong), [dong]);
  const tienHang = dongBang.reduce((t, d) => t + d.thanhTien, 0);
  const phi = docSo(form.phiVanChuyen);
  const lyDo = lyDoKhoaLuu({ dangTai, coKhach: Boolean(khach), dong: dongGui });

  // Đang nhập dở (có hàng hoặc đã gõ ghi chú) mà rời trang: hỏi trước
  const coThayDoi = !daLuu && (dong.length > 0 || form.ghiChu.trim() !== "");
  useHoiKhiRoiTrang(coThayDoi && !dangLuu, (tiepTuc) => setHoiRoi(() => tiepTuc));
  const veDanhSach = () => {
    const di = () => navigate("/sales-quotations");
    if (coThayDoi) setHoiRoi(() => di);
    else di();
  };

  async function luu() {
    if (dangLuuRef.current || lyDo) return; // chặn bấm đúp (state chỉ cập nhật ở lần render sau)
    dangLuuRef.current = true;
    setDangLuu(true);
    try {
      const res = await donBanHangService.create(taoBodyBaoGia({ khachHangId: khach.id, ...form }, dongGui));
      const id = idBaoGiaMoi(res);
      setDaLuu(true);
      toast.success("Đã tạo báo giá", { description: res?.data?.soDonHang || undefined });
      // Thay mục lịch sử: Quay lại ở chi tiết về danh sách, không về biểu mẫu đã gửi
      navigate(id != null ? `/sales-quotations/${id}` : "/sales-quotations", { replace: true });
    } catch (e) {
      toast.error("Không tạo được báo giá", {
        description: e?.response
          ? getApiErrorMessage(e, "Máy chủ không xử lý được yêu cầu, vui lòng thử lại.")
          : "Không nhận được phản hồi từ máy chủ. Kiểm tra kết nối rồi thử lại.",
      });
    } finally {
      dangLuuRef.current = false;
      setDangLuu(false);
    }
  }

  const thongBao = [
    <DongThongBao key="gia" tone="info">
      Đơn giá sửa được trong khoảng <b className="font-semibold">90%–110% giá niêm yết</b>. Báo giá lưu ở trạng thái Chờ phản
      hồi; khách đồng ý thì bấm Chốt thành đơn ở chi tiết báo giá.
    </DongThongBao>,
    loiKhach ? (
      <DongThongBao key="loi-khach" tone="bad" actions={loiKhach.khongQuyen ? undefined : <NutChu onClick={taiKhach}>Thử lại</NutChu>}>
        Không tải được danh sách khách hàng: {loiKhach.chu}.
      </DongThongBao>
    ) : null,
    loiBienThe ? (
      <DongThongBao key="loi-bt" tone="bad" actions={loiBienThe.khongQuyen ? undefined : <NutChu onClick={taiBienThe}>Thử lại</NutChu>}>
        Không tải được danh sách sản phẩm: {loiBienThe.chu}.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  // ── Ô tìm / quét sản phẩm ──
  const idDsSP = `${idMan}-ds-sp`;
  const timSanPham = (
    <div className="relative px-4 pb-3 pt-3 sm:px-6">
      <label htmlFor={`${idMan}-tim-sp`} className="sr-only">Tìm hoặc quét sản phẩm</label>
      <ScanBarcode className="pointer-events-none absolute left-7 top-[22px] size-4 text-bo-muted sm:left-9" aria-hidden="true" />
      <input
        id={`${idMan}-tim-sp`}
        ref={oTimRef}
        value={timSP}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={moDsSP}
        aria-controls={moDsSP ? idDsSP : undefined}
        aria-activedescendant={moDsSP && chiSoSP >= 0 ? `${idMan}-sp-${chiSoSP}` : undefined}
        aria-describedby={goiYTim ? `${idMan}-goi-y-tim` : undefined}
        disabled={dangLuu}
        placeholder="Tìm tên, mã SKU hoặc quét mã vạch rồi Enter"
        onChange={(e) => { setTimSP(e.target.value); setGoiYTim(""); setChiSoSP(-1); setMoSP(true); }}
        onFocus={() => { clearTimeout(henDongSPRef.current); setMoSP(true); }}
        onBlur={() => { henDongSPRef.current = setTimeout(() => { setMoSP(false); setChiSoSP(-1); }, 150); }}
        onKeyDown={(e) => {
          const daXuLy = phimDanhSach(e, {
            mo: moDsSP, soMuc: goiYSP.ds.length, chiSo: chiSoSP, datChiSo: setChiSoSP, datMo: setMoSP,
            chon: (i) => themBienThe(goiYSP.ds[i]),
          });
          if (!daXuLy && e.key === "Enter") { e.preventDefault(); enterTim(); }
        }}
        className={cn(O_NHAP, "pl-9")}
      />
      {goiYTim ? (
        <p id={`${idMan}-goi-y-tim`} className="mt-1.5 text-xs leading-4 text-bo-warning">{goiYTim}</p>
      ) : null}
      {moDsSP ? (
        <div id={idDsSP} role="listbox" aria-label="Sản phẩm khớp" className={cn(DANH_SACH_GOI_Y, "inset-x-4 top-[calc(100%-6px)] sm:inset-x-6")}>
          {goiYSP.ds.length ? goiYSP.ds.map((v, i) => {
            const daCo = dong.find((d) => d.bienTheId === v.id);
            return (
              <button
                key={v.id}
                id={`${idMan}-sp-${i}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={i === chiSoSP}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => themBienThe(v)}
                className={cn(MUC_GOI_Y, i === chiSoSP && "bg-slate-100")}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-bo-foreground">{v.tenSanPham}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-bo-muted">
                    <MauKichCo tenMau={v.tenMau} maMauHex={v.maMauHex} kichCo={v.tenSize} className="text-slate-700" />
                    <span className="font-mono">{v.maBienThe}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-xs leading-4 text-bo-muted">
                  <span className="block text-[13px] font-semibold tabular-nums text-bo-foreground">
                    {docSo(v.giaBan) > 0 ? formatCurrency(v.giaBan) : "Chưa có giá"}
                  </span>
                  <span className="block">{daCo ? `Đang có ${soVN(daCo.soLuong)} · +1` : "Thêm"}</span>
                </span>
              </button>
            );
          }) : (
            <p className="px-2.5 py-2 text-sm text-bo-muted">
              {dangTai ? "Đang tải danh sách sản phẩm…" : loiBienThe ? "Chưa tải được danh sách sản phẩm." : bienThe.length ? "Không tìm thấy sản phẩm, thử tên hoặc mã khác." : "Chưa có sản phẩm đang kinh doanh nào."}
            </p>
          )}
          {goiYSP.tong > goiYSP.ds.length ? (
            <p className="border-t border-slate-100 px-2.5 pb-1 pt-1.5 text-xs text-bo-muted">
              Hiện {soVN(goiYSP.ds.length)}/{soVN(goiYSP.tong)} kết quả, gõ thêm để lọc
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  // ── Cột bảng: đơn giá (ô nhập + khoảng cho phép), số lượng, thành tiền, bỏ dòng ──
  const nhanDong = (d) => `${d.tenSanPham} ${d.tenMau || ""} ${d.kichCo || ""}`.replace(/\s+/g, " ").trim();
  const cotBang = [
    {
      ma: "gia", nhan: "Đơn giá", lop: "w-40 text-right",
      nhom: (n) => {
        const soSai = soSaiTheoNhom.get(n.dong[0]?.khoaNhom ?? n.dong[0]?.tenSanPham) ?? 0;
        if (soSai) return <span className="text-bo-danger">{soVN(soSai)} dòng sai giá</span>;
        const gia = [...new Set(n.dong.map((d) => d.donGia))];
        return gia.length === 1 && gia[0] !== "" ? <span className="font-normal text-bo-muted">{formatCurrency(gia[0])}</span> : null;
      },
      dong: (d) => {
        const kt = kiemTraDonGia(d.donGia, d.giaNiemYet);
        const idPhu = `${idMan}-gia-${d.id}`;
        const maO = `gia-${d.id}`;
        const phu = kt.loi === "chuaCoGia" ? "Chưa có giá niêm yết, cập nhật giá bán trước"
          : kt.loi === "thap" ? `Tối thiểu ${formatCurrency(kt.toiThieu)}`
            : kt.loi === "cao" ? `Tối đa ${formatCurrency(kt.toiDa)}`
              : kt.loi === "trong" ? `Để trống sẽ lấy giá niêm yết ${formatCurrency(d.giaNiemYet)}`
                : `Niêm yết ${formatCurrency(d.giaNiemYet)}${kt.lech ? ` · ${kt.lech < 0 ? "giảm" : "tăng"} ${soVN(Math.abs(kt.lech))}%` : ""}`;
        const saiGia = kt.loi && kt.loi !== "trong";
        return (
          <span className="flex flex-col items-end gap-1">
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Đơn giá ${nhanDong(d)}`}
              aria-invalid={saiGia ? true : undefined}
              aria-describedby={idPhu}
              value={d.donGia === "" ? "" : oDangGo === maO ? String(d.donGia) : soVN(d.donGia)}
              disabled={dangLuu}
              onFocus={() => setODangGo(maO)}
              onChange={(e) => datDong(d.id, { donGia: docOTien(e.target.value) })}
              onBlur={() => {
                setODangGo(null);
                if (d.donGia === "") datDong(d.id, { donGia: Math.round(docSo(d.giaNiemYet)) });
              }}
              className={cn(
                O_NHAP,
                "h-8 w-32 text-right font-semibold tabular-nums",
                saiGia && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15",
              )}
            />
            <span id={idPhu} className={cn("text-xs leading-4", saiGia ? "text-bo-danger" : "text-bo-muted")}>
              {phu}
            </span>
          </span>
        );
      },
    },
    {
      ma: "sl", nhan: "SL", lop: "w-24 text-right",
      nhom: (n) => soVN(n.tong.soLuong),
      dong: (d) => (
        <input
          inputMode="numeric"
          autoComplete="off"
          aria-label={`Số lượng ${nhanDong(d)}`}
          value={d.oSoLuong}
          disabled={dangLuu}
          onChange={(e) => {
            const sl = docOSoLuong(e.target.value);
            if (sl !== undefined) datDong(d.id, { soLuong: sl }); // "3.5", "-2": giữ số cũ
          }}
          onBlur={() => { if (!(docSo(d.oSoLuong) >= 1)) datDong(d.id, { soLuong: 1 }); }}
          className={cn(O_NHAP, "ml-auto h-8 w-20 text-right font-semibold tabular-nums")}
        />
      ),
    },
    {
      ma: "tien", nhan: "Thành tiền", lop: "w-36 whitespace-nowrap text-right",
      nhom: (n) => formatCurrency(n.tong.thanhTien),
      dong: (d) => formatCurrency(d.thanhTien),
    },
    {
      ma: "bo", nhan: <span className="sr-only">Bỏ dòng</span>, lop: "w-14 text-right",
      dong: (d) => (
        <button
          type="button"
          onClick={() => boDong(d.id)}
          disabled={dangLuu}
          aria-label={`Bỏ ${nhanDong(d)}`}
          title="Bỏ dòng"
          className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-bo-danger-soft hover:text-bo-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      ),
    },
  ];

  const bang = dong.length === 0 ? (
    <EmptyState
      icon={Package}
      title="Chưa có sản phẩm nào"
      description="Gõ tên hoặc quét mã vạch ở ô phía trên. Quét lại cùng mã sẽ cộng thêm 1."
      className="min-h-[260px] flex-1"
    />
  ) : (
    <BangHangTaoPhieu
      bang={bangHang}
      cot={cotBang}
      dongSang={dongSang}
      tenChungTu="Báo giá"
      nhan="Hàng trong báo giá"
      nhanTim="Tìm trong báo giá"
      rongToiThieu="@2xl/khoi:min-w-[640px]"
    />
  );

  const idPhi = `${idMan}-phi`;
  const tongTien = (
    <TongTienBan
      className="mt-auto"
      trai="Khi chốt thành đơn, đơn bán giữ nguyên đơn giá từng dòng; chỉ phí vận chuyển, địa chỉ và ghi chú sửa được."
      muc={[
        { ma: "hang", nhan: "Tiền hàng", giaTri: formatCurrency(tienHang) },
        {
          ma: "phi",
          nhan: <label htmlFor={idPhi}>Phí vận chuyển</label>,
          giaTri: (
            <input
              id={idPhi}
              inputMode="numeric"
              autoComplete="off"
              value={form.phiVanChuyen === "" ? "" : oDangGo === "phi" ? String(form.phiVanChuyen) : soVN(form.phiVanChuyen)}
              disabled={dangLuu}
              onFocus={() => setODangGo("phi")}
              onChange={(e) => setForm((cu) => ({ ...cu, phiVanChuyen: docOTien(e.target.value) }))}
              onBlur={() => {
                setODangGo(null);
                if (form.phiVanChuyen === "") setForm((cu) => ({ ...cu, phiVanChuyen: 0 }));
              }}
              className={cn(O_NHAP, "ml-auto h-8 w-36 text-right tabular-nums")}
            />
          ),
        },
        { ma: "tong", nhan: "Tổng cộng", giaTri: formatCurrency(tienHang + phi), tong: true },
      ]}
    />
  );

  // ── Cột phải: khách hàng, giao hàng, ghi chú ──
  const idDsKhach = `${idMan}-ds-khach`;
  const oKhach = khach ? (
    <div className="rounded-md border border-bo-border bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-sm font-semibold leading-5 text-bo-foreground">{khach.tenKhachHang}</div>
        <button
          type="button"
          onClick={doiKhach}
          disabled={dangLuu}
          className="inline-flex h-7 shrink-0 items-center rounded-md border border-bo-border bg-white px-2.5 text-[13px] font-medium text-bo-foreground hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          Đổi
        </button>
      </div>
      <BangThuocTinh
        className="mt-2"
        rongNhan={80}
        muc={[
          { ma: "ma", nhan: "Mã khách", giaTri: khach.maKhachHang, an: !khach.maKhachHang },
          { ma: "sdt", nhan: "SĐT", giaTri: sdtHien(khach.soDienThoai) },
          { ma: "dc", nhan: "Địa chỉ gốc", giaTri: khach.diaChi },
        ]}
      />
    </div>
  ) : (
    <div className="relative">
      <label htmlFor={`${idMan}-khach`} className="sr-only">Tìm khách hàng</label>
      <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-bo-muted" aria-hidden="true" />
      <input
        id={`${idMan}-khach`}
        ref={refOKhach}
        value={timKhach}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-required="true"
        aria-expanded={moDsKhach}
        aria-controls={moDsKhach ? idDsKhach : undefined}
        aria-activedescendant={moDsKhach && chiSoKhach >= 0 ? `${idMan}-kh-${chiSoKhach}` : undefined}
        disabled={dangLuu}
        placeholder="Tên hoặc SĐT khách hàng"
        onChange={(e) => { setTimKhach(e.target.value); setChiSoKhach(-1); setMoKhach(true); }}
        onFocus={() => { clearTimeout(henDongKhachRef.current); setMoKhach(true); }}
        onBlur={() => { henDongKhachRef.current = setTimeout(() => { setMoKhach(false); setChiSoKhach(-1); }, 150); }}
        onKeyDown={(e) => {
          const daXuLy = phimDanhSach(e, {
            mo: moDsKhach, soMuc: goiYKhach.length, chiSo: chiSoKhach, datChiSo: setChiSoKhach, datMo: setMoKhach,
            chon: (i) => chonKhach(goiYKhach[i]),
          });
          if (!daXuLy && e.key === "Enter" && goiYKhach.length === 1) { e.preventDefault(); chonKhach(goiYKhach[0]); }
        }}
        className={cn(O_NHAP, "pl-9")}
      />
      {moDsKhach ? (
        <div id={idDsKhach} role="listbox" aria-label="Khách hàng khớp" className={cn(DANH_SACH_GOI_Y, "inset-x-0 top-10 max-h-[240px]")}>
          {goiYKhach.length ? goiYKhach.map((k, i) => (
            <button
              key={k.id}
              id={`${idMan}-kh-${i}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={i === chiSoKhach}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chonKhach(k)}
              className={cn(MUC_GOI_Y, i === chiSoKhach && "bg-slate-100")}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-bo-foreground">{k.tenKhachHang}</span>
                <span className="mt-0.5 block truncate text-xs text-bo-muted">
                  {[sdtHien(k.soDienThoai), k.diaChi || "Chưa có địa chỉ"].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          )) : (
            <p className="px-2.5 py-2 text-sm text-bo-muted">
              {dangTai ? "Đang tải danh sách khách hàng…" : loiKhach ? "Chưa tải được danh sách khách hàng." : "Không có khách đang hoạt động khớp. Thử tên hoặc SĐT khác."}
            </p>
          )}
        </div>
      ) : null}
      <p className="mt-1.5 text-xs leading-4 text-bo-muted">Chỉ hiện khách đang hoạt động.</p>
    </div>
  );

  const idDemGhiChu = `${idMan}-dem-ghi-chu`;
  const dungDiaChiGoc = Boolean(khach?.diaChi) && form.diaChiGiaoHang === khach.diaChi;
  const cotPhai = (
    <CotThuocTinh nhan="Thông tin báo giá">
      <NhomThuocTinh nhan={<>Khách hàng <span className="text-bo-danger">*</span></>}>{oKhach}</NhomThuocTinh>
      <NhomThuocTinh nhan="Giao hàng">
        <label className="grid gap-1.5">
          <span className={NHAN_O}>Địa chỉ nhận hàng</span>
          <textarea
            value={form.diaChiGiaoHang}
            maxLength={DIA_CHI_GIAO_TOI_DA}
            rows={2}
            disabled={dangLuu}
            onChange={(e) => setForm((cu) => ({ ...cu, diaChiGiaoHang: e.target.value.slice(0, DIA_CHI_GIAO_TOI_DA) }))}
            placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
            className={cn(O_NHAP_NHIEU_DONG, "min-h-16")}
          />
        </label>
        {dungDiaChiGoc ? (
          <p className="mt-1.5 text-xs leading-4 text-bo-muted">Lấy từ địa chỉ gốc của khách, sửa nếu giao nơi khác.</p>
        ) : khach?.diaChi ? (
          <NutChu
            className="mt-1.5 block text-xs"
            disabled={dangLuu}
            onClick={() => setForm((cu) => ({ ...cu, diaChiGiaoHang: khach.diaChi }))}
          >
            Dùng địa chỉ gốc của khách
          </NutChu>
        ) : null}
      </NhomThuocTinh>
      <NhomThuocTinh>
        <label className="grid gap-1.5">
          <span className={NHAN_O}>Ghi chú báo giá</span>
          <textarea
            value={form.ghiChu}
            maxLength={GHI_CHU_BAO_GIA_TOI_DA}
            disabled={dangLuu}
            aria-describedby={idDemGhiChu}
            onChange={(e) => setForm((cu) => ({ ...cu, ghiChu: e.target.value.slice(0, GHI_CHU_BAO_GIA_TOI_DA) }))}
            placeholder="Ví dụ: Giá áp dụng cho đơn từ 20 sản phẩm, hiệu lực 7 ngày"
            className={O_NHAP_NHIEU_DONG}
          />
          <span id={idDemGhiChu} className={GOI_Y_O}>
            <span>Không bắt buộc · in trên báo giá</span>
            <span>{form.ghiChu.length}/{GHI_CHU_BAO_GIA_TOI_DA}</span>
          </span>
        </label>
      </NhomThuocTinh>
    </CotThuocTinh>
  );

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma="Tạo báo giá"
            dongPhu={dong.length
              ? ["Báo giá bán hàng", `${soVN(bangHang.tong.soSanPham)} sản phẩm · ${soVN(bangHang.tong.soDong)} biến thể`, `Tổng SL ${soVN(bangHang.tong.soLuong)}`]
              : ["Báo giá bán hàng", khach ? "Thêm sản phẩm vào báo giá" : "Chọn khách hàng và thêm sản phẩm"]}
            onQuayLai={veDanhSach}
            nhanQuayLai="Quay lại danh sách báo giá"
            nutChinh={{
              ma: "luu",
              nhan: "Lưu báo giá",
              icon: Save,
              onClick: luu,
              khoa: Boolean(lyDo) || dangLuu,
              lyDo: lyDo || undefined,
              hienLyDo: true,
              dangChay: dangLuu,
            }}
          />
        }
        tienTrinh={<TienTrinhChungTu buoc={BUOC} nhan="Tiến trình báo giá" />}
        thongBao={thongBao}
        chinh={(
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 sm:px-6">
              <h2 className="text-base font-semibold leading-6 text-bo-foreground">Sản phẩm</h2>
              {dong.length ? (
                <p className="text-[13px] leading-5 text-bo-muted tabular-nums">{soVN(bangHang.tong.soSanPham)} sản phẩm</p>
              ) : null}
            </div>
            {timSanPham}
            {bang}
            {tongTien}
          </>
        )}
        cotPhai={cotPhai}
      />

      <HopXacNhanChungTu
        mo={Boolean(hoiRoi)}
        onDoiMo={(mo) => { if (!mo) setHoiRoi(null); }}
        tieuDe="Rời trang khi báo giá chưa lưu?"
        moTa="Các sản phẩm, đơn giá và ghi chú đang nhập sẽ mất."
        nhanXacNhan="Rời trang"
        iconXacNhan={LogOut}
        kieu="nguyHiem"
        onXacNhan={() => {
          const tiepTuc = hoiRoi;
          setHoiRoi(null);
          tiepTuc?.();
        }}
      />
    </PageContainer>
  );
}
