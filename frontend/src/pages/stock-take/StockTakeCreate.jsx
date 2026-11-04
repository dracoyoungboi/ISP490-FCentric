// src/pages/stock-take/StockTakeCreate.jsx
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { Boxes, Check, ChevronDown, Layers, Lock, MapPin, Play, Save, Search, Tags, Warehouse, Wrench } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import CotThuocTinh, { NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import ChonDanhMucKiemKe from "@/components/kiem-ke/ChonDanhMucKiemKe";
import ChonKhoKiemKe, { BieuTuongKho } from "@/components/kiem-ke/ChonKhoKiemKe";
import ChonKhuVucKiemKe from "@/components/kiem-ke/ChonKhuVucKiemKe";
import XemTruocPhamVi from "@/components/kiem-ke/XemTruocPhamVi";
import { LOAI_PHAM_VI, THU_TU_PHAM_VI, TT_DOT, vanDeTuLoi } from "@/components/kiem-ke/kiemKe";
import {
  GO_VUONG_MAC,
  LY_DO_NHANH,
  batTatLyDo,
  dotKhacGiuKe,
  kiemGanNhatTheoDanhMuc,
  kiemGanNhatTheoKhu,
  laKhuThat,
  loaiKe,
  moTaPhamViChon,
  ngayNgan,
  nhanDotGiu,
  thongTinKhoKiemKe,
} from "@/components/kiem-ke/phamViKiemKe";
import useHoiKhiRoiTrang from "@/hooks/useHoiKhiRoiTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { laCamUng } from "@/lib/camUng";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getKhoList } from "@/services/khoService";
import {
  batDau,
  layDanhMucTrenKe,
  layDanhSachDot,
  layDot,
  layNguoiChuTri,
  laySoDo,
  luuNhap,
  suaNhap,
  taoKhoaLenh,
  taoVaBatDau,
  xemTruocPhamVi,
} from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoGiaoDich } from "@/utils/kho";
import { dsKhoLamViecTrongToken, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, getCurrentUserId, hasAnyRole } from "@/utils/roles";

const TEN_TOI_DA = 200;
const LY_DO_TOI_DA = 2000;
// Bộ đếm ký tự dưới ô Lý do chỉ hiện khi sắp chạm giới hạn
const LY_DO_HIEN_DEM = 1800;

/** Họ tên người đang đăng nhập (trong token) — để quản trị viên tự chủ trì đợt. */
function hoTenTrongToken() {
  try {
    const p = jwtDecode(window.localStorage.getItem("access_token") ?? "");
    return p?.hoTen || p?.tenDangNhap || p?.username || null;
  } catch {
    return null;
  }
}
// Đổi phạm vi xong chờ ngần này rồi mới xem trước
const CHO_XEM_TRUOC_MS = 400;

const ICON_PHAM_VI = { toan_bo: Warehouse, theo_khu_vuc: Layers, theo_ke: MapPin, theo_danh_muc: Tags };
// Khối chọn chi tiết (khu, kệ, danh mục) ngay dưới 4 thẻ kiểu phạm vi: viền + nền xanh nhạt cùng tông thẻ đang chọn
const KHOI_CHI_TIET = "grid gap-3 rounded-lg border border-bo-primary/25 bg-bo-primary-soft/40 p-2.5 sm:p-3";

/** Danh mục dạng cây → danh sách phẳng có độ sâu (để vẽ thụt lề, tìm không dấu). */
function phangCay(cay, sau = 0, kq = []) {
  for (const n of Array.isArray(cay) ? cay : []) {
    kq.push({ id: n.id, ten: n.tenDanhMuc, ma: n.maDanhMuc, sau, soCon: (n.danhMucCons ?? []).length });
    const con = [...(n.danhMucCons ?? [])].sort((a, b) => String(a.tenDanhMuc).localeCompare(String(b.tenDanhMuc), "vi"));
    phangCay(con, sau + 1, kq);
  }
  return kq;
}

/** "Kiểm kê Khu A 04/11" — tên gợi ý khi người dùng chưa tự đặt. */
function tenGoiY({ loai, kho, khuVuc, maKe = [], danhMuc }) {
  // dd/MM cố định (toLocaleDateString cho "05-11" trên một số trình duyệt); tên kho gom dấu cách thừa
  const homNay = new Date();
  const ngay = `${String(homNay.getDate()).padStart(2, "0")}/${String(homNay.getMonth() + 1).padStart(2, "0")}`;
  const tenKho = String(kho ?? "").replace(/\s+/g, " ").trim();
  if (loai === "theo_khu_vuc") {
    return khuVuc?.length
      ? `Kiểm kê ${khuVuc.slice(0, 2).join(", ")}${khuVuc.length > 2 ? ` +${khuVuc.length - 2}` : ""} ${ngay}`
      : `Kiểm kê theo khu vực ${ngay}`;
  }
  if (loai === "theo_ke") {
    return maKe.length
      ? `Kiểm kê kệ ${maKe.slice(0, 2).join(", ")}${maKe.length > 2 ? ` +${maKe.length - 2}` : ""} ${ngay}`
      : `Kiểm kê theo kệ ${ngay}`;
  }
  if (loai === "theo_danh_muc") return danhMuc ? `Kiểm kê danh mục ${danhMuc} ${ngay}` : `Kiểm kê theo danh mục ${ngay}`;
  return `Kiểm kê ${tenKho ? `toàn ${tenKho}` : "toàn kho"} ${ngay}`;
}

/** datetime-local ↔ ISO */
const veONgay = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const tuONgay = (chu) => (chu ? new Date(chu).toISOString() : null);

function TieuDeMuc({ so, children, phu }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2.5 text-base font-semibold leading-6 text-bo-heading">
        <span className="grid size-6 place-items-center rounded-full bg-bo-primary-soft text-xs font-semibold text-bo-primary-strong">{so}</span>
        {children}
      </h2>
      {phu ? <span className="text-[13px] text-bo-muted">{phu}</span> : null}
    </div>
  );
}

/** Dòng chờ / lỗi / trống trong khối chọn chi tiết. */
function DongTrangThai({ dang, loi, onThuLai, children }) {
  if (loi) {
    return (
      <p className="text-sm text-bo-danger-strong">
        {loi} {onThuLai ? <NutChu onClick={onThuLai}>Thử lại</NutChu> : null}
      </p>
    );
  }
  return (
    <p role={dang ? "status" : undefined} className="text-sm text-bo-muted">
      {children}
    </p>
  );
}

/**
 * Tạo / sửa đợt kiểm kê khoanh vùng (/stock-take/new, /stock-take/:id/edit) — UC-STK-01 của đặc tả BA 03/11/2026.
 * Quản lý kho (của kho) và quản trị viên lập đợt: kho + kiểu phạm vi (toàn kho, khu vực, kệ, danh mục) → phạm vi cụ thể →
 * thông tin. Cột phải xem trước ngay số kệ sẽ khóa / số dòng sẽ chốt và mọi vướng mắc (kệ đang thuộc đợt khác, hàng chưa có
 * kệ, phiếu nhặt đang giữ hàng…); điều còn thiếu ghi ngay cạnh nút Bắt đầu. "Lưu nháp" chưa khóa gì; "Bắt đầu kiểm kê"
 * khóa và chốt ngay. Rời trang khi biểu mẫu có thay đổi chưa lưu thì hỏi trước.
 */
export default function StockTakeCreate() {
  const { id } = useParams();
  const dotId = id ? Number(id) : null;
  const qDot = useTaiDuLieu(useCallback(() => (dotId ? layDot(dotId) : Promise.resolve(null)), [dotId]), `kk-sua-${dotId}`, {
    enabled: Boolean(dotId),
  });
  const navigate = useNavigate();
  if (dotId) {
    if (qDot.data === undefined && !qDot.error) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải đợt kiểm kê" />
        </PageContainer>
      );
    }
    if (!qDot.data) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungLoiChungTu loi={qDot.error} tenChungTu="đợt kiểm kê" onVeDanhSach={() => navigate("/stock-take")} nhanVeDanhSach="Về danh sách kiểm kê" onThuLai={qDot.reload} />
        </PageContainer>
      );
    }
  }
  return <BieuMauDot key={dotId ?? "moi"} dot={qDot.data ?? null} />;
}

function BieuMauDot({ dot }) {
  const navigate = useNavigate();
  const idForm = useId();
  const laSua = Boolean(dot);
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const [nguoiDungId] = useState(getCurrentUserId);
  const suaDuoc = !laSua || (Number(dot.trangThai) === TT_DOT.NHAP && dot.quyen?.suaNhap);

  // ── Kho ────────────────────────────────────────────────────────────────────────────────────────────
  const taiKho = useCallback(async () => {
    if (laQtv) return (await getKhoList()).filter(laKhoGiaoDich);
    return dsKhoLamViecTrongToken();
  }, [laQtv]);
  const qKho = useTaiDuLieu(taiKho, "kho-kiem-ke");
  const dsKho = useMemo(() => qKho.data ?? [], [qKho.data]);
  const [khoChon, setKhoChon] = useState(dot?.kho?.id ?? null);
  // Kho làm việc lúc mở biểu mẫu: đổi kho làm việc ở thẻ khác / thanh bên sau đó không kéo biểu mẫu sang kho khác
  // (khu, kệ đã chọn thuộc kho cũ)
  const [khoLucMo] = useState(getKhoLamViecId);
  const khoMacDinh = dsKho.find((k) => Number(k.id) === khoLucMo) ?? dsKho[0] ?? null;
  const khoId = laSua ? dot.kho?.id : dsKho.some((k) => Number(k.id) === Number(khoChon)) ? Number(khoChon) : khoMacDinh?.id ?? null;
  const tenKho = laSua ? dot.kho?.ten : dsKho.find((k) => Number(k.id) === Number(khoId))?.tenKho;
  // Kho người dùng vừa bấm khi đang có khu / kệ đã chọn: chờ xác nhận "Đổi kho" (khu, kệ thuộc kho cũ sẽ bỏ)
  const [khoCho, setKhoCho] = useState(null);

  // ── Phạm vi ────────────────────────────────────────────────────────────────────────────────────────
  const [loai, setLoai] = useState(dot?.loaiKiemKe && THU_TU_PHAM_VI.includes(dot.loaiKiemKe) ? dot.loaiKiemKe : "theo_khu_vuc");
  const [khuVucIds, setKhuVucIds] = useState(() => new Set((dot?.khuVuc ?? []).map((k) => k.id)));
  const [viTriIds, setViTriIds] = useState(() => new Set((dot?.viTri ?? []).map((v) => v.id)));
  const [danhMucId, setDanhMucId] = useState(dot?.danhMuc?.id ?? null);
  const [timKe, setTimKe] = useState("");
  const [hienKeTrong, setHienKeTrong] = useState(false);
  const [timDanhMuc, setTimDanhMuc] = useState("");

  const taiSoDo = useCallback(() => laySoDo(khoId), [khoId]);
  const qSoDo = useTaiDuLieu(taiSoDo, `kk-so-do-${khoId}`, { enabled: khoId != null });
  // Chỉ dùng sơ đồ của ĐÚNG kho đang chọn (vừa đổi kho thì sơ đồ kho cũ còn giữ trong lúc tải: không cho tick nhầm)
  const soDo = qSoDo.dungKhoa ? qSoDo.data : undefined;
  const dangTaiSoDo = khoId != null && qSoDo.loading && !qSoDo.dungKhoa;
  const loiSoDo = khoId != null && !qSoDo.loading && !qSoDo.dungKhoa && qSoDo.error ? getApiErrorMessage(qSoDo.error, "lỗi kết nối") : null;
  const khuVuc = useMemo(() => (soDo?.khuVuc ?? []).filter((kv) => kv.id != null || kv.ke?.length), [soDo]);
  // Khu tick được: bỏ nhóm "Khác" (id null / 0) gom kệ chưa thuộc khu
  const dsKhu = useMemo(() => khuVuc.filter(laKhuThat), [khuVuc]);
  // Khu đã chọn còn tồn tại: sửa nháp mà khu đã bị xóa khỏi kho thì id cũ không tính, không gửi (chỉ lọc khi sơ đồ đã tải
  // đúng kho; chưa tải được thì giữ nguyên để máy chủ tự báo)
  const khuChon = useMemo(
    () => (soDo ? [...khuVucIds].filter((x) => dsKhu.some((kv) => Number(kv.id) === Number(x))) : [...khuVucIds]),
    [soDo, khuVucIds, dsKhu],
  );
  const taiCay = useCallback(async () => phangCay((await danhMucQuanAoService.getCayDanhMuc()).data?.data ?? []), []);
  const qCay = useTaiDuLieu(taiCay, "kk-cay-danh-muc", { enabled: loai === "theo_danh_muc" });

  // Đợt đã duyệt + đợt đang chạy của mọi kho (một lần, không tải nháp / đã hủy): lần kiểm gần nhất của từng khu / danh mục /
  // kho và số đợt đang chạy của từng kho trong ô chọn kho. Lỗi tải chỉ làm các số này trống (có nút Thử lại), không chặn gì
  const taiLichSu = useCallback(
    async () =>
      (await Promise.all([TT_DOT.DA_DUYET, TT_DOT.DANG_KIEM_KE, TT_DOT.CHO_DUYET].map((trangThai) => layDanhSachDot({ trangThai })))).flat(),
    [],
  );
  const qLichSu = useTaiDuLieu(taiLichSu, "kk-lich-su-dot");
  const loiLichSu = !qLichSu.loading && qLichSu.error && !qLichSu.data;
  const thongTinKho = useMemo(() => (qLichSu.data ? thongTinKhoKiemKe(qLichSu.data) : null), [qLichSu.data]);
  const kiemGanNhat = useMemo(
    () => (qLichSu.dungKhoa ? kiemGanNhatTheoKhu(qLichSu.data, khoId, dsKhu.map((kv) => Number(kv.id))) : null),
    [qLichSu.dungKhoa, qLichSu.data, khoId, dsKhu],
  );
  const trangThaiLichSu = qLichSu.dungKhoa ? "xong" : qLichSu.loading ? "dang" : "loi";

  // Bảng cây danh mục: số kệ / sản phẩm trên sổ kệ theo danh mục (gộp cây con) của kho + lần kiểm gần nhất từng danh mục
  const taiDanhMucTrenKe = useCallback(() => layDanhMucTrenKe(khoId), [khoId]);
  const qDanhMucTrenKe = useTaiDuLieu(taiDanhMucTrenKe, `kk-dm-tren-ke-${khoId}`, {
    enabled: khoId != null && loai === "theo_danh_muc",
  });
  const soLieuDanhMuc = useMemo(
    () => (qDanhMucTrenKe.dungKhoa ? new Map((qDanhMucTrenKe.data ?? []).map((x) => [Number(x.danhMucId), x])) : null),
    [qDanhMucTrenKe.dungKhoa, qDanhMucTrenKe.data],
  );
  const trangThaiSoLieuDanhMuc = qDanhMucTrenKe.dungKhoa ? "xong" : qDanhMucTrenKe.loading || khoId == null ? "dang" : "loi";
  const kiemGanNhatDanhMuc = useMemo(
    () => (qLichSu.dungKhoa && qCay.data ? kiemGanNhatTheoDanhMuc(qLichSu.data, khoId, qCay.data.map((x) => Number(x.id))) : null),
    [qLichSu.dungKhoa, qLichSu.data, khoId, qCay.data],
  );

  // Kệ đang thuộc đợt khác (không phải đợt đang sửa) hoặc bảo trì: không chọn được (đã chọn thì vẫn bỏ được)
  const lyDoKhongChon = (k) => {
    if (k.trangThai === "BAO_TRI") return "Đang bảo trì";
    const khac = dotKhacGiuKe(k, dot?.id);
    return khac.length ? `Đang thuộc ${khac.map((d) => d.ma).join(", ")}` : null;
  };
  const phanLoaiKe = (k) => loaiKe(k, dot?.id);

  // ── Thông tin ──────────────────────────────────────────────────────────────────────────────────────
  const [ten, setTen] = useState(dot?.ten ?? "");
  const [daSuaTen, setDaSuaTen] = useState(laSua);
  const [nguoiChuTriId, setNguoiChuTriId] = useState(dot?.nguoiChuTri?.id ?? null);
  const [lyDo, setLyDo] = useState(dot?.lyDo ?? "");
  const [ngayDuKien, setNgayDuKien] = useState(veONgay(dot?.ngayDuKienBatDau));
  const [ghiChu, setGhiChu] = useState(dot?.ghiChu ?? "");
  // Ghi chú cũ nhiều dòng: giữ ô nhiều dòng (ô một dòng sẽ nuốt dấu xuống dòng khi lưu lại)
  const [ghiChuNhieuDong] = useState(() => /\n/.test(dot?.ghiChu ?? ""));
  const oLyDoRef = useRef(null);
  const taiNguoi = useCallback(() => layNguoiChuTri(khoId), [khoId]);
  const qNguoi = useTaiDuLieu(taiNguoi, `kk-chu-tri-${khoId}`, { enabled: khoId != null });
  // Chỉ dùng danh sách của đúng kho đang chọn (như sơ đồ): vừa đổi kho thì danh sách kho cũ không còn chọn được
  // Máy chủ nhận quản lý kho của kho hoặc quản trị viên (bỏ trống = người tạo). Danh sách chỉ có quản lý kho, nên quản trị
  // viên thêm chính mình lên đầu và chủ trì sẵn — không tự giao cho người đầu danh sách mà người tạo không để ý
  const dsNguoi = useMemo(() => {
    const ds = qNguoi.dungKhoa ? qNguoi.data ?? [] : [];
    if (!qNguoi.dungKhoa) return ds;
    const them = [];
    // Sửa nháp: người đang chủ trì (vd. quản trị viên đã lập) có thể không nằm trong danh sách quản lý kho — giữ nguyên người
    // đó, không lặng lẽ đổi sang người đang sửa
    const cu = laSua ? dot.nguoiChuTri : null;
    if (cu?.id != null && !ds.some((n) => n.id === cu.id)) them.push({ id: cu.id, hoTen: cu.hoTen || `Người dùng #${cu.id}` });
    if (laQtv && nguoiDungId != null && !ds.some((n) => n.id === nguoiDungId) && !them.some((n) => n.id === nguoiDungId)) {
      them.push({ id: nguoiDungId, hoTen: hoTenTrongToken() || "Bạn" });
    }
    return [...them, ...ds];
  }, [qNguoi.dungKhoa, qNguoi.data, laQtv, nguoiDungId, laSua, dot]);
  const chuTri = dsNguoi.some((n) => n.id === nguoiChuTriId)
    ? nguoiChuTriId
    : dsNguoi.find((n) => n.id === nguoiDungId)?.id ?? (dsNguoi.length === 1 ? dsNguoi[0].id : null);
  // Danh sách người chủ trì của kho đang chọn chưa tải xong: chưa gửi (máy chủ sẽ gán người đang sửa nếu để trống)
  const dangTaiNguoi = khoId != null && !qNguoi.dungKhoa && qNguoi.loading;

  const tenKhu = dsKhu.filter((kv) => khuVucIds.has(kv.id)).map((kv) => kv.ten || kv.ma);
  const danhMucChon = (qCay.data ?? []).find((x) => x.id === danhMucId);
  const tenDanhMuc = danhMucChon?.ten ?? (danhMucId === dot?.danhMuc?.id ? dot?.danhMuc?.ten : undefined);
  const maKeChon = useMemo(() => {
    const ma = new Map();
    (dot?.viTri ?? []).forEach((v) => ma.set(v.id, v.ma));
    khuVuc.forEach((kv) => (kv.ke ?? []).forEach((k) => ma.set(k.id, k.ma)));
    return [...viTriIds]
      .map((x) => ma.get(x))
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "vi", { numeric: true }));
  }, [dot, khuVuc, viTriIds]);
  const tenDeXuat = tenGoiY({ loai, kho: tenKho, khuVuc: tenKhu, maKe: maKeChon, danhMuc: tenDanhMuc });
  const tenGui = (daSuaTen ? ten : ten || tenDeXuat).trim().slice(0, TEN_TOI_DA);
  // Nhiều quản lý kho mà chưa ai được chọn (người tạo không nằm trong danh sách): phải chọn, không đoán
  const thieuChuTri = dsNguoi.length > 1 && chuTri == null;

  // Chip lý do nhanh: chưa có thì nối thêm, đang có thì gỡ khỏi ô. Màn cảm ứng không đưa con trỏ vào ô (khỏi bật bàn phím ảo)
  const batTatLyDoNhanh = (chu) => {
    setLyDo((cu) => batTatLyDo(cu, chu, LY_DO_TOI_DA));
    if (!laCamUng()) oLyDoRef.current?.focus();
  };

  // ── Yêu cầu + xem trước ───────────────────────────────────────────────────────────────────────────
  const thieuPhamVi =
    loai === "theo_khu_vuc" && !khuChon.length
      ? "Chọn ít nhất một khu vực"
      : loai === "theo_ke" && !viTriIds.size
        ? "Chọn ít nhất một kệ"
        : loai === "theo_danh_muc" && !danhMucId
          ? "Chọn danh mục"
          : null;
  const yeuCau = useMemo(
    () => ({
      khoId,
      loaiKiemKe: loai,
      khuVucIds: loai === "theo_khu_vuc" ? khuChon : [],
      viTriIds: loai === "theo_ke" ? [...viTriIds] : [],
      danhMucId: loai === "theo_danh_muc" ? danhMucId : null,
    }),
    [khoId, loai, khuChon, viTriIds, danhMucId],
  );
  const [xem, setXem] = useState({ khoa: "", kq: null, dang: false, loi: null });
  const khoaXem = JSON.stringify(yeuCau);
  const [lanXem, setLanXem] = useState(0);
  useEffect(() => {
    if (khoId == null || thieuPhamVi) return undefined;
    let bo = false;
    const hen = setTimeout(async () => {
      setXem((cu) => ({ ...cu, dang: true, loi: null }));
      try {
        const kq = await xemTruocPhamVi({ ...yeuCau, tenDotKiemKe: "xem-truoc" }, dot?.id);
        if (!bo) setXem({ khoa: khoaXem, kq, dang: false, loi: null, luc: new Date() });
      } catch (error) {
        if (!bo) setXem({ khoa: khoaXem, kq: null, dang: false, loi: getApiErrorMessage(error, "lỗi kết nối"), luc: null });
      }
    }, CHO_XEM_TRUOC_MS);
    return () => {
      bo = true;
      clearTimeout(hen);
    };
  }, [khoaXem, khoId, thieuPhamVi, yeuCau, dot?.id, lanXem]);
  const kqXem = !thieuPhamVi && xem.khoa === khoaXem ? xem.kq : null;
  const dangXem = !thieuPhamVi && (xem.dang || xem.khoa !== khoaXem);
  const loiXem = !thieuPhamVi && xem.khoa === khoaXem ? xem.loi : null;
  const tinhLaiXem = () => setLanXem((n) => n + 1);

  // ── Gửi ────────────────────────────────────────────────────────────────────────────────────────────
  const [dangGui, setDangGui] = useState(null); // "nhap" | "batDau"
  const [loi, setLoi] = useState(null);
  const [vanDeGui, setVanDeGui] = useState([]);
  // Lần xem trước (lanXem) mà lỗi Bắt đầu gắn vào: xem trước mới hơn đã sạch vướng mắc thì lỗi đó cũ, không hiện nữa
  const [loiTaiLanXem, setLoiTaiLanXem] = useState(null);
  const [hopBatDau, setHopBatDau] = useState(false);
  const [khoaLenh, setKhoaLenh] = useState(null);
  // Phiên bản đợt đang sửa: sau mỗi lần lưu nháp thành công máy chủ tăng phiên bản (Bắt đầu lỗi rồi thử lại vẫn đúng)
  const [phienBan, setPhienBan] = useState(dot?.phienBan);
  // Lưu / Bắt đầu thành công: thôi hỏi khi rời trang
  const [daXong, setDaXong] = useState(false);
  const thanGui = () => ({
    ...yeuCau,
    tenDotKiemKe: tenGui,
    nguoiChuTriId: chuTri ?? (laSua ? dot.nguoiChuTri?.id ?? null : null),
    lyDo: lyDo.trim() || null,
    ngayDuKienBatDau: tuONgay(ngayDuKien),
    ghiChu: ghiChu.trim() || null,
    phienBan,
  });
  const lyDoKhoa =
    !suaDuoc
      ? "Đợt không còn là nháp hoặc bạn không có quyền sửa"
      : khoId == null
        ? "Chưa có kho để kiểm kê"
        : thieuPhamVi ||
          (!tenGui
            ? "Nhập tên đợt"
            : !lyDo.trim()
              ? "Nhập lý do kiểm kê"
              : dangTaiNguoi
                ? "Đang tải người chủ trì…"
                : thieuChuTri
                  ? "Chọn người chủ trì"
                  : null);

  const truocKhiGui = () => {
    setLoi(null);
    setLoiTaiLanXem(null);
    setVanDeGui([]);
    if (!laQtv && khoId != null && getKhoLamViecId() !== Number(khoId)) setKhoLamViecId(khoId);
  };
  const loiGui = (error, cau) => {
    setLoi(getApiErrorMessage(error, cau));
    setVanDeGui(vanDeTuLoi(error));
  };
  const luuNhapNgay = async () => {
    if (lyDoKhoa || dangGui) return;
    truocKhiGui();
    setDangGui("nhap");
    try {
      const kq = laSua ? await suaNhap(dot.id, thanGui()) : await luuNhap(thanGui());
      setDaXong(true);
      toast.success(laSua ? "Đã lưu thay đổi" : "Đã lưu đợt nháp", { description: "Chưa khóa kệ nào. Bắt đầu khi sẵn sàng." });
      navigate(`/stock-take/${kq.dotKiemKeId}`, { replace: true });
    } catch (error) {
      loiGui(error, "Chưa lưu được đợt kiểm kê");
      setDangGui(null);
    }
  };
  const batDauNgay = async () => {
    truocKhiGui();
    setDangGui("batDau");
    try {
      let idDot;
      if (laSua) {
        const kq = await suaNhap(dot.id, thanGui());
        setPhienBan(kq.phienBan);
        await batDau(dot.id, kq.phienBan, khoaLenh);
        idDot = dot.id;
      } else {
        idDot = (await taoVaBatDau(thanGui(), khoaLenh)).dotKiemKeId;
      }
      setDaXong(true);
      toast.success("Đã bắt đầu kiểm kê", { description: "Phạm vi đã khóa, số trên sổ kệ đã chốt." });
      navigate(`/stock-take/${idDot}`, { replace: true });
    } catch (error) {
      loiGui(error, "Chưa bắt đầu được đợt kiểm kê");
      setLoiTaiLanXem(lanXem + 1);
      setDangGui(null);
      setLanXem((n) => n + 1);
    }
  };

  // ── Rời trang khi có thay đổi chưa lưu ───────────────────────────────────────────────────────────
  const khoaThayDoi = JSON.stringify([
    khoChon,
    loai,
    [...khuVucIds].sort(),
    [...viTriIds].sort(),
    danhMucId,
    daSuaTen ? ten : "",
    nguoiChuTriId,
    lyDo,
    ngayDuKien,
    ghiChu,
  ]);
  const [khoaBanDau] = useState(khoaThayDoi);
  const coThayDoi = Boolean(suaDuoc) && !daXong && khoaThayDoi !== khoaBanDau;
  const [hoiRoi, setHoiRoi] = useState(null);
  useHoiKhiRoiTrang(coThayDoi && !dangGui, (tiepTuc) => setHoiRoi(() => tiepTuc));
  const veTrangTruoc = () => {
    const di = () => navigate(laSua ? `/stock-take/${dot.id}` : "/stock-take");
    if (coThayDoi && !dangGui) setHoiRoi(() => di);
    else di();
  };

  // ── Kệ (phạm vi Theo kệ): tìm theo mã, mặc định ẩn kệ trống (kệ trống đang chọn vẫn hiện để bỏ được) ─────────
  const ke = useMemo(() => {
    const tu = boDau(timKe.trim()).toLowerCase();
    const kq = { ds: [], tong: 0, khop: 0, soTrong: 0 };
    for (const kv of khuVuc) {
      const tat = kv.ke ?? [];
      const theoTim = tat.filter((k) => !tu || boDau(k.ma).toLowerCase().includes(tu));
      const trong = theoTim.filter((k) => !(Number(k.dangChua) > 0) && !viTriIds.has(k.id));
      const hien = hienKeTrong ? theoTim : theoTim.filter((k) => !trong.includes(k));
      kq.tong += tat.length;
      kq.khop += theoTim.length;
      kq.soTrong += trong.length;
      // soAn: kệ trống đang bị ẩn của khu (nút chọn cả khu khi đó chỉ chọn kệ có hàng)
      if (hien.length) kq.ds.push({ ...kv, ke: hien, soAn: hienKeTrong ? 0 : trong.length });
    }
    return kq;
  }, [khuVuc, timKe, hienKeTrong, viTriIds]);

  const doiTapHop = (setter, ids, bat) =>
    setter((cu) => {
      const moi = new Set(cu);
      ids.forEach((x) => (bat ? moi.add(x) : moi.delete(x)));
      return moi;
    });

  // Đổi kho: khu, kệ đã chọn thuộc kho cũ nên bỏ CẢ HAI (kể cả lựa chọn của kiểu phạm vi không đang chọn, để quay lại
  // kiểu đó không còn khu / kệ của kho cũ); còn khu hoặc kệ nào đã chọn thì hỏi trước, câu hỏi kể đủ cả hai
  const soKhuDangChon = khuChon.length;
  const soKeDangChon = viTriIds.size;
  const soDangChon = soKhuDangChon + soKeDangChon;
  // Đang chờ xác nhận đổi kho mà người dùng bỏ hết khu / kệ: không còn gì để hỏi, thôi chờ
  if (khoCho != null && !soDangChon) setKhoCho(null);
  const doiKho = (idMoi) => {
    setKhoChon(idMoi);
    setKhuVucIds(new Set());
    setViTriIds(new Set());
    setKhoCho(null);
  };
  const khoChoDoi = khoCho != null ? dsKho.find((k) => Number(k.id) === Number(khoCho)) : null;

  const dangTaiKho = qKho.loading && qKho.data === undefined;
  const coTheBatDau = Boolean(kqXem?.coTheBatDau) && !lyDoKhoa;
  // Lý do chưa bắt đầu được, hiện ngay cạnh nút (không cần rê chuột): gom mọi thứ còn thiếu trong biểu mẫu thành một câu
  const conThieu = [
    thieuPhamVi ? { theo_khu_vuc: "khu vực", theo_ke: "kệ", theo_danh_muc: "danh mục" }[loai] : null,
    !tenGui ? "tên đợt" : null,
    !lyDo.trim() ? "lý do kiểm kê" : null,
    thieuChuTri ? "người chủ trì" : null,
  ].filter(Boolean);
  const lyDoBatDau = !suaDuoc
    ? "Không sửa được đợt này"
    : khoId == null
      ? dangTaiKho
        ? "Đang tải danh sách kho…"
        : qKho.error
          ? "Chưa tải được danh sách kho"
          : lyDoKhoa
      : conThieu.length
      ? `Còn thiếu: ${conThieu.join(", ")}`
      : dangXem
        ? "Đang tính phạm vi…"
        : loiXem
          ? "Chưa xem trước được phạm vi"
          : !kqXem?.coTheBatDau
            ? GO_VUONG_MAC
            : null;
  // Kho đang chọn: số kệ (theo sơ đồ đã tải) · lần kiểm gần nhất · đợt đang chạy — ngay cạnh ô chọn kho
  const ttKhoChon = khoId != null ? thongTinKho?.get(Number(khoId)) : null;
  const soKeKho = soDo ? khuVuc.reduce((s, kv) => s + (kv.ke?.length ?? 0), 0) : null;
  const moTaKhoChon = [
    soKeKho != null ? `${soVN(soKeKho)} kệ` : null,
    thongTinKho ? (ttKhoChon?.ganNhat ? `kiểm toàn kho ${ngayNgan(ttKhoChon.ganNhat)}` : "chưa kiểm toàn kho") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const thongTinDongKho = (k) => {
    const tt = thongTinKho?.get(Number(k.id));
    if (!thongTinKho) return {};
    return {
      phu: tt?.ganNhat ? `Kiểm toàn kho ${ngayNgan(tt.ganNhat)}` : "Chưa kiểm toàn kho",
      ban: tt?.dangChay ? `${soVN(tt.dangChay)} đợt đang chạy` : undefined,
    };
  };

  // Quay lại thẻ này (vd. sau khi xếp kệ ở thẻ mới): tính lại xem trước để vướng mắc đã gỡ biến mất
  useTaiLaiKhiQuayLai(tinhLaiXem, { bat: suaDuoc && khoId != null && !thieuPhamVi && !dangGui, giaCach: 5000 });

  const thongBao = [
    laSua && !suaDuoc ? (
      <DongThongBao key="khong-sua" tone="warn">
        Đợt này không còn là nháp hoặc bạn không có quyền sửa (chỉ quản lý kho của {dot.kho?.ten}).
      </DongThongBao>
    ) : null,
    qKho.error && !qKho.loading ? (
      <DongThongBao key="loi-kho" tone="bad" actions={<NutChu onClick={qKho.reload}>Thử lại</NutChu>}>
        Không tải được danh sách kho: {getApiErrorMessage(qKho.error, "lỗi kết nối")}.
      </DongThongBao>
    ) : null,
    loi && !hopBatDau && !(loiTaiLanXem != null && lanXem > loiTaiLanXem && kqXem?.coTheBatDau) ? (
      <DongThongBao key="loi" tone="bad">
        {loi}
        {vanDeGui.length ? (
          <ul className="mt-1 list-disc pl-5">
            {vanDeGui.map((v, i) => (
              <li key={i}>{v.noiDung}</li>
            ))}
          </ul>
        ) : null}
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  const idLyDo = `${idForm}-ly-do`;

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        // overflow-clip (không phải hidden): vẫn cắt góc bo nhưng không thành vùng cuộn, để nội dung cột phải dính được khi cuộn trang
        className="overflow-clip"
        dau={
          <DauChungTu
            ma={laSua ? `Sửa ${dot.ma}` : "Tạo đợt kiểm kê"}
            dongPhu={laSua ? [dot.ten, "Nháp"] : undefined}
            onQuayLai={veTrangTruoc}
            nhanQuayLai={laSua ? "Về đợt kiểm kê" : "Về danh sách kiểm kê"}
            nutPhu={{
              nhan: "Lưu nháp",
              icon: Save,
              khoa: Boolean(lyDoKhoa) || Boolean(dangGui),
              lyDo: lyDoKhoa ?? undefined,
              dangChay: dangGui === "nhap",
              onClick: luuNhapNgay,
            }}
            nutChinh={{
              nhan: "Bắt đầu kiểm kê",
              icon: Play,
              khoa: !coTheBatDau || Boolean(dangGui),
              lyDo: lyDoBatDau ?? undefined,
              hienLyDo: true,
              dangChay: dangGui === "batDau",
              onClick: () => {
                setKhoaLenh(taoKhoaLenh());
                setLoi(null);
                setVanDeGui([]);
                setHopBatDau(true);
              },
            }}
          />
        }
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <form
            id={idForm}
            className="grid gap-8 px-4 py-6 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              luuNhapNgay();
            }}
          >
            {/* 1. Phạm vi: kho ngay trên các kiểu phạm vi (kho là một phần của phạm vi: "Khu A của Cửa hàng Hà Nội") */}
            <section className="grid gap-3">
              <TieuDeMuc so={1} phu="Chỉ phần đã chọn bị tạm dừng; phần còn lại của kho vẫn nhập xuất bình thường">
                Phạm vi kiểm kê
              </TieuDeMuc>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className={cn(NHAN_O, "w-10 shrink-0")}>Kho</span>
                  {laSua ? (
                    <span className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 text-sm">
                      <BieuTuongKho kho={dsKho.find((k) => Number(k.id) === Number(dot.kho?.id)) ?? dot.kho} className="text-bo-muted" />
                      <span className="truncate font-medium text-bo-foreground">{dot.kho?.ten}</span>
                    </span>
                  ) : dangTaiKho ? (
                    <span role="status" className="text-sm text-bo-muted">
                      Đang tải danh sách kho…
                    </span>
                  ) : !dsKho.length ? (
                    <span className="text-sm text-bo-muted">
                      {qKho.error ? "Chưa tải được danh sách kho." : "Bạn chưa được phân kho nào đang hoạt động để kiểm kê."}
                    </span>
                  ) : (
                    <ChonKhoKiemKe
                      dsKho={dsKho}
                      value={khoId}
                      // Chọn lại đúng kho đang dùng khi đang chờ xác nhận: thôi hỏi đổi kho
                      onChange={(id) => (Number(id) === Number(khoId) ? setKhoCho(null) : soDangChon ? setKhoCho(id) : doiKho(id))}
                      thongTin={thongTinDongKho}
                      nhan="Kho kiểm kê"
                      disabled={!suaDuoc || Boolean(dangGui)}
                      className="w-full sm:w-auto sm:min-w-[240px] sm:max-w-[340px]"
                    />
                  )}
                  {laSua ? (
                    <span className="text-xs text-bo-muted">Không đổi được kho của đợt đã lập</span>
                  ) : loiLichSu ? (
                    <span className="text-xs text-bo-muted">
                      Chưa tải được lịch sử kiểm kê. <NutChu onClick={qLichSu.reload} className="text-xs">Thử lại</NutChu>
                    </span>
                  ) : moTaKhoChon || ttKhoChon?.dangChay ? (
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-bo-muted tabular-nums">
                      {moTaKhoChon}
                      {ttKhoChon?.dangChay ? (
                        <span className="rounded-full bg-amber-50 px-2 font-medium leading-5 text-amber-700">
                          {soVN(ttKhoChon.dangChay)} đợt đang chạy
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                {khoChoDoi && soDangChon ? (
                  // role="status": trình đọc màn hình đọc câu hỏi ngay khi ô chọn kho đóng lại
                  <div role="status">
                    <DongThongBao
                      tone="warn"
                      actions={
                        <>
                          <NutChu onClick={() => setKhoCho(null)}>Giữ kho cũ</NutChu>
                          <NutChu onClick={() => doiKho(khoChoDoi.id)}>Đổi kho</NutChu>
                        </>
                      }
                    >
                      Đổi sang {khoChoDoi.tenKho} sẽ bỏ{" "}
                      {[soKhuDangChon ? `${soVN(soKhuDangChon)} khu vực` : null, soKeDangChon ? `${soVN(soKeDangChon)} kệ` : null]
                        .filter(Boolean)
                        .join(" và ")}{" "}
                      đã chọn ở {tenKho}.
                    </DongThongBao>
                  </div>
                ) : null}
              </div>
              <div role="radiogroup" aria-label="Kiểu phạm vi" className="grid gap-2 @2xl/khoi:grid-cols-2 @7xl/khoi:grid-cols-4">
                {THU_TU_PHAM_VI.map((ma) => {
                  const Icon = ICON_PHAM_VI[ma];
                  const chon = loai === ma;
                  return (
                    <button
                      key={ma}
                      type="button"
                      role="radio"
                      aria-checked={chon}
                      disabled={!suaDuoc}
                      onClick={() => {
                        setLoai(ma);
                        setKhoCho(null);
                      }}
                      className={cn(
                        "relative grid gap-1 rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 disabled:cursor-not-allowed disabled:opacity-60",
                        chon ? "border-bo-primary bg-bo-primary-soft shadow-[0_0_0_1px_var(--color-bo-primary)]" : "border-bo-border bg-bo-surface hover:border-slate-300 hover:bg-bo-surface-subtle",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("grid size-8 place-items-center rounded-md", chon ? "bg-bo-primary text-white" : "bg-slate-100 text-slate-600")}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold text-bo-heading">{LOAI_PHAM_VI[ma].nhan}</span>
                        {chon ? <Check className="ml-auto size-4 text-bo-primary" aria-hidden="true" /> : null}
                      </span>
                      <span className="text-xs leading-[18px] text-slate-600">{LOAI_PHAM_VI[ma].moTa}</span>
                    </button>
                  );
                })}
              </div>

              {loai === "toan_bo" ? (
                <DongThongBao tone="warn">
                  Toàn bộ {tenKho || "kho"} sẽ tạm dừng nhập, xuất, chuyển kho và bán tại quầy trong suốt đợt. Chỉ dùng cho kiểm kê
                  định kỳ cả kho.
                </DongThongBao>
              ) : null}

              {loai === "theo_khu_vuc" ? (
                <div className={KHOI_CHI_TIET}>
                  {khoId == null ? (
                    <DongTrangThai>Chưa có kho để chọn khu vực.</DongTrangThai>
                  ) : dangTaiSoDo ? (
                    // Khung xương đúng chiều cao bảng khu (tiêu đề + 2 hàng): bảng tải xong không đẩy phần dưới xuống
                    <div role="status" aria-label="Đang tải khu vực" className="overflow-hidden rounded-lg border border-bo-border bg-white">
                      <div className="h-9 border-b border-bo-border bg-bo-surface-subtle" />
                      {[0, 1].map((i) => (
                        <div key={i} className="flex h-[52px] items-center gap-3 border-b border-bo-border px-3 last:border-b-0">
                          <span className="size-4 rounded bg-slate-100" />
                          <span className="h-3.5 w-24 animate-pulse rounded bg-slate-100" />
                          <span className="ml-auto h-3 w-32 animate-pulse rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : loiSoDo ? (
                    <DongTrangThai loi={`Chưa tải được khu vực: ${loiSoDo}.`} onThuLai={qSoDo.reload} />
                  ) : !dsKhu.length ? (
                    <DongTrangThai>Kho chưa có khu vực nào. Thêm khu vực ở Vị trí kệ trước.</DongTrangThai>
                  ) : (
                    <ChonKhuVucKiemKe
                      dsKhu={dsKhu}
                      chon={khuVucIds}
                      onDoi={(ids, bat) => doiTapHop(setKhuVucIds, ids, bat)}
                      khoa={!suaDuoc}
                      phanLoai={phanLoaiKe}
                      kiemGanNhat={kiemGanNhat}
                      lichSu={trangThaiLichSu}
                    />
                  )}
                </div>
              ) : null}

              {loai === "theo_ke" ? (
                <div className={KHOI_CHI_TIET}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="relative flex min-w-[200px] max-w-xs flex-1 items-center">
                      <span className="sr-only">Tìm kệ</span>
                      <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
                      <input value={timKe} onChange={(e) => setTimKe(e.target.value)} placeholder="Tìm mã kệ, vd. A-01" className={cn(O_NHAP, "pl-8")} />
                    </label>
                    <span className="text-[13px] text-bo-muted tabular-nums">
                      Đã chọn <b className="font-semibold text-bo-foreground">{soVN(viTriIds.size)}</b> kệ
                    </span>
                    {viTriIds.size && suaDuoc ? <NutChu onClick={() => setViTriIds(new Set())}>Bỏ chọn hết</NutChu> : null}
                    {/* Không có kệ trống thì không có gì để ẩn / hiện. Mọi kệ khớp đều trống (danh sách rỗng): nút Hiện nằm
                        ngay trong dòng báo bên dưới, không lặp ở đây */}
                    {!ke.soTrong ? null : hienKeTrong ? (
                      <NutChu onClick={() => setHienKeTrong(false)} className="sm:ml-auto">
                        Ẩn kệ trống
                      </NutChu>
                    ) : ke.ds.length ? (
                      <NutChu onClick={() => setHienKeTrong(true)} className="sm:ml-auto">
                        Hiện cả kệ trống ({soVN(ke.soTrong)})
                      </NutChu>
                    ) : null}
                  </div>
                  {khoId == null ? (
                    <DongTrangThai>Chưa có kho để chọn kệ.</DongTrangThai>
                  ) : dangTaiSoDo ? (
                    <DongTrangThai dang>Đang tải kệ…</DongTrangThai>
                  ) : loiSoDo ? (
                    <DongTrangThai loi={`Chưa tải được kệ: ${loiSoDo}.`} onThuLai={qSoDo.reload} />
                  ) : !ke.tong ? (
                    <DongTrangThai>Kho chưa có kệ nào.</DongTrangThai>
                  ) : !ke.khop ? (
                    <DongTrangThai>Không có kệ nào khớp “{timKe.trim()}”.</DongTrangThai>
                  ) : !ke.ds.length ? (
                    <DongTrangThai>
                      {timKe.trim() ? `Các kệ khớp “${timKe.trim()}” đều đang trống.` : "Mọi kệ của kho đang trống."}{" "}
                      <NutChu onClick={() => setHienKeTrong(true)}>Hiện cả kệ trống ({soVN(ke.soTrong)})</NutChu>
                    </DongTrangThai>
                  ) : (
                    ke.ds.map((kv) => {
                      const chonDuoc = kv.ke.filter((k) => !lyDoKhongChon(k));
                      const chonHet = chonDuoc.length > 0 && chonDuoc.every((k) => viTriIds.has(k.id));
                      return (
                        <fieldset key={kv.id ?? "khac"} className="grid gap-2 rounded-lg border border-bo-border bg-white px-3 pb-3 pt-2">
                          <legend className="flex items-center gap-2 px-1 text-[13px] font-semibold text-bo-heading">
                            {laKhuThat(kv) ? kv.ten || kv.ma : "Chưa có khu vực"}
                            {chonDuoc.length && suaDuoc ? (
                              <NutChu onClick={() => doiTapHop(setViTriIds, chonDuoc.map((k) => k.id), !chonHet)}>
                                {chonHet
                                  ? "Bỏ cả khu"
                                  : kv.soAn
                                    ? `Chọn kệ có hàng (${soVN(chonDuoc.length)})`
                                    : `Chọn cả khu (${soVN(chonDuoc.length)})`}
                              </NutChu>
                            ) : null}
                          </legend>
                          <div className="flex flex-wrap gap-1.5">
                            {kv.ke.map((k) => {
                              const khong = lyDoKhongChon(k);
                              const chon = viTriIds.has(k.id);
                              const baoTri = k.trangThai === "BAO_TRI";
                              const nhanBan = khong ? (baoTri ? "bảo trì" : nhanDotGiu(dotKhacGiuKe(k, dot?.id))) : "";
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  aria-pressed={chon}
                                  // Kệ đã chọn mà nay bị khóa / bảo trì: vẫn bấm được để bỏ khỏi đợt
                                  disabled={(Boolean(khong) && !chon) || !suaDuoc}
                                  title={
                                    khong
                                      ? chon
                                        ? `${khong}. Bấm để bỏ khỏi đợt`
                                        : khong
                                      : k.dangChua
                                        ? `Đang chứa ${soVN(k.dangChua)} sản phẩm`
                                        : "Kệ trống"
                                  }
                                  onClick={() => doiTapHop(setViTriIds, [k.id], !chon)}
                                  className={cn(
                                    "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 cam-ung:h-11",
                                    chon
                                      ? "border-bo-primary bg-bo-primary text-white"
                                      : khong && !baoTri
                                        ? "cursor-not-allowed border-dashed border-amber-300 bg-bo-warning-soft text-amber-800"
                                        : khong
                                          ? "cursor-not-allowed border-dashed border-slate-300 bg-slate-50 text-slate-500"
                                          : "border-bo-border bg-white text-slate-700 hover:border-bo-primary/50 hover:bg-bo-primary-soft",
                                  )}
                                >
                                  {baoTri ? <Wrench className="size-3" aria-hidden="true" /> : khong ? <Lock className="size-3" aria-hidden="true" /> : chon ? <Check className="size-3" aria-hidden="true" /> : null}
                                  {k.ma}
                                  {khong ? (
                                    <span className={cn("font-sans text-[11px]", chon ? "text-white/85" : undefined)}>· {nhanBan}</span>
                                  ) : k.dangChua ? (
                                    <span className={cn("font-sans text-[11px] tabular-nums", chon ? "text-white/80" : "text-bo-muted")}>{soVN(k.dangChua)}</span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })
                  )}
                </div>
              ) : null}

              {loai === "theo_danh_muc" ? (
                <div className={KHOI_CHI_TIET}>
                  {qCay.loading && !qCay.data ? (
                    <DongTrangThai dang>Đang tải danh mục…</DongTrangThai>
                  ) : qCay.error && !qCay.data ? (
                    <DongTrangThai loi={`Chưa tải được danh mục: ${getApiErrorMessage(qCay.error, "lỗi kết nối")}.`} onThuLai={qCay.reload} />
                  ) : !qCay.data?.length ? (
                    <DongTrangThai>Chưa có danh mục hàng hóa nào.</DongTrangThai>
                  ) : (
                    <>
                      <ChonDanhMucKiemKe
                        ds={qCay.data}
                        chon={danhMucId}
                        onChon={setDanhMucId}
                        khoa={!suaDuoc}
                        tuKhoa={timDanhMuc}
                        onDoiTuKhoa={setTimDanhMuc}
                        soLieu={soLieuDanhMuc}
                        trangThaiSoLieu={trangThaiSoLieuDanhMuc}
                        lanKiem={kiemGanNhatDanhMuc}
                        onThuLaiSoLieu={qDanhMucTrenKe.reload}
                        tenChonNgoaiCay={tenDanhMuc}
                      />
                    </>
                  )}
                  <p className="text-xs leading-4 text-bo-muted">
                    Khóa mịn: chỉ lô thuộc danh mục (và mọi danh mục con) bị giữ; hàng khác trên cùng kệ vẫn bán.
                  </p>
                </div>
              ) : null}
            </section>

            {/* 2. Thông tin */}
            <section className="grid gap-4">
              <TieuDeMuc so={2}>Thông tin đợt</TieuDeMuc>
              <div className="grid gap-x-5 gap-y-4 @2xl/khoi:grid-cols-2">
                <label className="grid content-start gap-1.5">
                  <span className={NHAN_O}>
                    Tên đợt <span className="text-bo-danger">*</span>
                  </span>
                  <input
                    value={daSuaTen ? ten : ten || tenDeXuat}
                    maxLength={TEN_TOI_DA}
                    disabled={!suaDuoc}
                    onChange={(e) => {
                      setTen(e.target.value.slice(0, TEN_TOI_DA));
                      setDaSuaTen(true);
                    }}
                    className={O_NHAP}
                  />
                  {!daSuaTen ? <span className={GOI_Y_O}>Tên gợi ý theo phạm vi, sửa tùy ý</span> : null}
                </label>
                <label className="grid content-start gap-1.5">
                  <span className={NHAN_O}>Người chủ trì</span>
                  <select value={chuTri ?? ""} disabled={!suaDuoc || !dsNguoi.length} onChange={(e) => setNguoiChuTriId(Number(e.target.value))} className={O_NHAP}>
                    {!dsNguoi.length ? (
                      <option value="">
                        {khoId != null && qNguoi.loading ? "Đang tải…" : qNguoi.error ? "Chưa tải được danh sách" : "Chưa có quản lý kho của kho này"}
                      </option>
                    ) : chuTri == null ? (
                      <option value="" disabled>
                        Chọn người chủ trì
                      </option>
                    ) : null}
                    {dsNguoi.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.hoTen}
                        {n.id === nguoiDungId && n.hoTen !== "Bạn" ? " (bạn)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className={GOI_Y_O}>Mọi nhân viên kho đều đếm được</span>
                </label>
                <div className="grid gap-1.5 @2xl/khoi:col-span-2">
                  <label htmlFor={idLyDo} className={NHAN_O}>
                    Lý do kiểm kê <span className="text-bo-danger">*</span>
                  </label>
                  <textarea
                    id={idLyDo}
                    ref={oLyDoRef}
                    rows={2}
                    value={lyDo}
                    maxLength={LY_DO_TOI_DA}
                    disabled={!suaDuoc}
                    onChange={(e) => setLyDo(e.target.value)}
                    placeholder="Ví dụ: Lệch tồn kênh Shopee ở khu A"
                    className={cn(O_NHAP_NHIEU_DONG, "min-h-[60px]")}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    {suaDuoc
                      ? LY_DO_NHANH.map((x) => {
                          const daCo = lyDo.includes(x);
                          return (
                            <button
                              key={x}
                              type="button"
                              aria-pressed={daCo}
                              title={daCo ? "Bấm để gỡ khỏi lý do" : undefined}
                              onClick={() => batTatLyDoNhanh(x)}
                              className={cn(
                                "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 cam-ung:h-9",
                                daCo
                                  ? "border-bo-primary/40 bg-bo-primary-soft text-bo-primary-strong"
                                  : "border-bo-border bg-white text-slate-700 hover:border-bo-primary/40 hover:bg-bo-primary-soft hover:text-bo-primary-strong",
                              )}
                            >
                              {x}
                            </button>
                          );
                        })
                      : null}
                    {lyDo.length > LY_DO_HIEN_DEM ? (
                      <span className="ml-auto text-xs leading-4 text-bo-muted tabular-nums">
                        {soVN(lyDo.length)}/{soVN(LY_DO_TOI_DA)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <label className="grid content-start gap-1.5">
                  <span className={NHAN_O}>Dự kiến bắt đầu</span>
                  <input type="datetime-local" value={ngayDuKien} disabled={!suaDuoc} onChange={(e) => setNgayDuKien(e.target.value)} className={O_NHAP} />
                  <span className={GOI_Y_O}>Không bắt buộc. Hiện ở danh sách đợt để mọi người biết lịch</span>
                </label>
                <label className="grid content-start gap-1.5">
                  <span className={NHAN_O}>Ghi chú cho người đếm</span>
                  {ghiChuNhieuDong ? (
                    <textarea
                      value={ghiChu}
                      maxLength={LY_DO_TOI_DA}
                      disabled={!suaDuoc}
                      onChange={(e) => setGhiChu(e.target.value)}
                      className={cn(O_NHAP_NHIEU_DONG, "min-h-[60px]")}
                    />
                  ) : (
                    <input
                      value={ghiChu}
                      maxLength={LY_DO_TOI_DA}
                      disabled={!suaDuoc}
                      onChange={(e) => setGhiChu(e.target.value)}
                      placeholder="Ví dụ: Hàng lỗi để riêng thùng đỏ"
                      className={O_NHAP}
                    />
                  )}
                  <span className={GOI_Y_O}>Hiện ở đầu màn đếm</span>
                </label>
              </div>
            </section>
          </form>
        }
        cotPhai={
          // Cột phải giãn hết chiều cao thân (nền xám tới đáy); phần nội dung dính đầu màn khi cuộn (từ 1280px), cao tối đa
          // bằng vùng nội dung (màn trừ thanh đầu 56px + viền 1px) và tự cuộn, để phần xem trước không khuất trên laptop 720px.
          // Hẹp hơn: lớp bọc "contents" để các nhóm vẫn xếp 2 cột theo lưới của CotThuocTinh
          <CotThuocTinh nhan="Xem trước phạm vi">
            <div className="contents xl:sticky xl:top-0 xl:block xl:max-h-[calc(100dvh-57px)] xl:overflow-y-auto xl:overscroll-contain">
              <NhomThuocTinh nhan="Xem trước" rong>
                {thieuPhamVi ? (
                  <p className="flex items-center gap-2 rounded-lg border border-dashed border-bo-border px-3 py-3 text-[13px] text-bo-muted">
                    <Boxes className="size-4 shrink-0" aria-hidden="true" />
                    Số kệ sẽ khóa và các vướng mắc hiện ở đây khi đã chọn phạm vi.
                  </p>
                ) : (
                  <>
                    <XemTruocPhamVi
                      kq={kqXem}
                      dang={dangXem}
                      loi={loiXem}
                      onThuLai={tinhLaiXem}
                      cheDo={loai === "theo_danh_muc" ? "theo_lo" : "toan_ke"}
                      nutCuaVanDe={(v) =>
                        /hàng chưa có kệ/i.test(v.noiDung) ? (
                          // Thẻ mới: biểu mẫu đang điền ở thẻ này không mất; quay lại thẻ này thì xem trước tự tính lại
                          <NutChu onClick={() => window.open(`/stock-take/unshelved?khoId=${khoId}${laSua ? `&tuDot=${dot.id}` : ""}`, "_blank", "noopener")}>Xếp kệ ở thẻ mới</NutChu>
                        ) : null
                      }
                    />
                    {kqXem && xem.luc ? (
                      <p className="mt-2 flex items-center justify-between gap-3 text-xs leading-4 text-bo-muted">
                        <span className="tabular-nums">
                          Tính lúc {xem.luc.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <NutChu onClick={tinhLaiXem} disabled={dangXem} className="text-xs">
                          Tính lại
                        </NutChu>
                      </p>
                    ) : null}
                  </>
                )}
              </NhomThuocTinh>
              <NhomThuocTinh rong>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded text-[13px] font-medium text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 [&::-webkit-details-marker]:hidden">
                    Bắt đầu: khóa phạm vi, chốt sổ, rồi đếm
                    <ChevronDown className="ml-auto size-4 text-bo-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <ol className="m-0 mt-2 grid list-none gap-2 p-0 text-[13px] leading-5 text-slate-700">
                    {[
                      "Khóa phạm vi và chốt số trên sổ kệ của từng lô.",
                      "Nhân viên kho quét kệ, quét tem, nhập số; mỗi dòng tự lưu.",
                      "Dòng lệch cần giải trình, có thể kèm ảnh.",
                      "Quản lý thẩm định: đếm lại dòng nghi ngờ hoặc phê duyệt.",
                      "Phê duyệt tạo phiếu điều chỉnh, cập nhật tồn, mở khóa.",
                    ].map((x, i) => (
                      <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2">
                        <span className="grid size-5 place-items-center rounded-full bg-slate-200/80 text-[11px] font-semibold text-slate-600">{i + 1}</span>
                        {x}
                      </li>
                    ))}
                  </ol>
                </details>
              </NhomThuocTinh>
            </div>
          </CotThuocTinh>
        }
      />

      <HopXacNhanChungTu
        mo={hopBatDau}
        onDoiMo={(m) => !m && !dangGui && setHopBatDau(false)}
        tieuDe="Bắt đầu kiểm kê ngay?"
        moTa={`${tenGui} · ${moTaPhamViChon({
          loai,
          tenKho,
          tenKhu,
          maKe: maKeChon,
          tenDanhMuc,
          coDanhMucCon: Boolean(danhMucChon?.soCon),
        })}${loai !== "toan_bo" && tenKho ? ` · ${tenKho}` : ""}. Phạm vi khóa ngay và số trên sổ kệ được chốt; tới khi duyệt hoặc hủy, hàng trong phạm vi tạm dừng nhập, xuất và bán.`}
        nhanXacNhan="Bắt đầu kiểm kê"
        iconXacNhan={Play}
        rong
        dangChay={dangGui === "batDau"}
        loi={hopBatDau ? loi : null}
        onXacNhan={batDauNgay}
      >
        <XemTruocPhamVi
          kq={vanDeGui.length ? { ...(kqXem ?? {}), vanDe: vanDeGui, coTheBatDau: false } : kqXem}
          dang={dangXem}
          cheDo={loai === "theo_danh_muc" ? "theo_lo" : "toan_ke"}
        />
      </HopXacNhanChungTu>

      <HopXacNhanChungTu
        mo={Boolean(hoiRoi)}
        onDoiMo={(m) => {
          if (!m) setHoiRoi(null);
        }}
        tieuDe={laSua ? "Rời trang khi chưa lưu thay đổi?" : "Rời trang khi chưa lưu đợt?"}
        moTa="Phạm vi và thông tin đợt vừa nhập chưa được lưu sẽ mất. Muốn giữ lại thì quay lại và bấm Lưu nháp."
        nhanXacNhan="Rời trang"
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
