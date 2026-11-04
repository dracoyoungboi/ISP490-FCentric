// src/pages/stock-take/StockTakeCreate.jsx
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Boxes, Check, Layers, Lock, MapPin, Play, Save, Search, Tags, Warehouse, Wrench } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import CotThuocTinh, { NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { boDau, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import XemTruocPhamVi from "@/components/kiem-ke/XemTruocPhamVi";
import { LOAI_PHAM_VI, THU_TU_PHAM_VI, TT_DOT, vanDeTuLoi } from "@/components/kiem-ke/kiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getKhoList } from "@/services/khoService";
import {
  batDau,
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
// Đổi phạm vi xong chờ ngần này rồi mới xem trước
const CHO_XEM_TRUOC_MS = 400;

const ICON_PHAM_VI = { toan_bo: Warehouse, theo_khu_vuc: Layers, theo_ke: MapPin, theo_danh_muc: Tags };

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
function tenGoiY({ loai, kho, khuVuc, soKe, danhMuc }) {
  const ngay = new Date().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  if (loai === "theo_khu_vuc" && khuVuc?.length) return `Kiểm kê ${khuVuc.slice(0, 2).join(", ")}${khuVuc.length > 2 ? ` +${khuVuc.length - 2}` : ""} ${ngay}`;
  if (loai === "theo_ke" && soKe) return `Kiểm kê ${soKe} kệ ${ngay}`;
  if (loai === "theo_danh_muc" && danhMuc) return `Kiểm kê danh mục ${danhMuc} ${ngay}`;
  return `Kiểm kê ${kho ? `toàn ${kho}` : "toàn kho"} ${ngay}`;
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

/**
 * Tạo / sửa đợt kiểm kê khoanh vùng (/stock-take/new, /stock-take/:id/edit) — UC-STK-01 của đặc tả BA 03/11/2026.
 * Quản lý kho (của kho) và quản trị viên lập đợt: chọn kho → kiểu phạm vi (toàn kho, khu vực, kệ, danh mục) → phạm vi cụ thể →
 * thông tin. Cột phải xem trước ngay số kệ sẽ khóa / số dòng sẽ chốt và mọi vướng mắc (kệ đang thuộc đợt khác, hàng chưa có
 * kệ, phiếu nhặt đang giữ hàng…). "Lưu nháp" chưa khóa gì; "Bắt đầu kiểm kê" khóa và chốt ngay.
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

  // ── Phạm vi ────────────────────────────────────────────────────────────────────────────────────────
  const [loai, setLoai] = useState(dot?.loaiKiemKe && THU_TU_PHAM_VI.includes(dot.loaiKiemKe) ? dot.loaiKiemKe : "theo_khu_vuc");
  const [khuVucIds, setKhuVucIds] = useState(() => new Set((dot?.khuVuc ?? []).map((k) => k.id)));
  const [viTriIds, setViTriIds] = useState(() => new Set((dot?.viTri ?? []).map((v) => v.id)));
  const [danhMucId, setDanhMucId] = useState(dot?.danhMuc?.id ?? null);
  const [timKe, setTimKe] = useState("");
  const [timDanhMuc, setTimDanhMuc] = useState("");

  const taiSoDo = useCallback(() => laySoDo(khoId), [khoId]);
  const qSoDo = useTaiDuLieu(taiSoDo, `kk-so-do-${khoId}`, { enabled: khoId != null });
  const khuVuc = useMemo(() => (qSoDo.data?.khuVuc ?? []).filter((kv) => kv.id != null || kv.ke?.length), [qSoDo.data]);
  const taiCay = useCallback(async () => phangCay((await danhMucQuanAoService.getCayDanhMuc()).data?.data ?? []), []);
  const qCay = useTaiDuLieu(taiCay, "kk-cay-danh-muc", { enabled: loai === "theo_danh_muc" });

  // Kệ đang thuộc đợt khác (không phải đợt đang sửa) hoặc bảo trì: không chọn được
  const lyDoKhongChon = (k) => {
    if (k.trangThai === "BAO_TRI") return "Đang bảo trì";
    const khac = (k.dot ?? []).filter((d) => d.id !== dot?.id);
    if (k.khoa && khac.length) return `Đang thuộc ${khac.map((d) => d.ma).join(", ")}`;
    return null;
  };

  // ── Thông tin ──────────────────────────────────────────────────────────────────────────────────────
  const [ten, setTen] = useState(dot?.ten ?? "");
  const [daSuaTen, setDaSuaTen] = useState(laSua);
  const [nguoiChuTriId, setNguoiChuTriId] = useState(dot?.nguoiChuTri?.id ?? null);
  const [lyDo, setLyDo] = useState(dot?.lyDo ?? "");
  const [ngayDuKien, setNgayDuKien] = useState(veONgay(dot?.ngayDuKienBatDau));
  const [ghiChu, setGhiChu] = useState(dot?.ghiChu ?? "");
  const taiNguoi = useCallback(() => layNguoiChuTri(khoId), [khoId]);
  const qNguoi = useTaiDuLieu(taiNguoi, `kk-chu-tri-${khoId}`, { enabled: khoId != null });
  const dsNguoi = useMemo(() => qNguoi.data ?? [], [qNguoi.data]);
  const chuTri = dsNguoi.some((n) => n.id === nguoiChuTriId)
    ? nguoiChuTriId
    : dsNguoi.find((n) => n.id === nguoiDungId)?.id ?? dsNguoi[0]?.id ?? null;

  const tenKhu = khuVuc.filter((kv) => khuVucIds.has(kv.id)).map((kv) => kv.ten || kv.ma);
  const tenDanhMuc = (qCay.data ?? []).find((x) => x.id === danhMucId)?.ten;
  const tenDeXuat = tenGoiY({ loai, kho: tenKho, khuVuc: tenKhu, soKe: viTriIds.size, danhMuc: tenDanhMuc });
  const tenGui = (daSuaTen ? ten : ten || tenDeXuat).trim();

  // ── Yêu cầu + xem trước ───────────────────────────────────────────────────────────────────────────
  const thieuPhamVi =
    loai === "theo_khu_vuc" && !khuVucIds.size
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
      khuVucIds: loai === "theo_khu_vuc" ? [...khuVucIds] : [],
      viTriIds: loai === "theo_ke" ? [...viTriIds] : [],
      danhMucId: loai === "theo_danh_muc" ? danhMucId : null,
    }),
    [khoId, loai, khuVucIds, viTriIds, danhMucId],
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
  const thanGui = () => ({
    ...yeuCau,
    tenDotKiemKe: tenGui,
    nguoiChuTriId: chuTri,
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
        : thieuPhamVi || (!tenGui ? "Nhập tên đợt" : !lyDo.trim() ? "Nhập lý do kiểm kê" : null);

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
      toast.success("Đã bắt đầu kiểm kê", { description: "Phạm vi đã khóa, số trên sổ kệ đã chốt." });
      navigate(`/stock-take/${idDot}`, { replace: true });
    } catch (error) {
      loiGui(error, "Chưa bắt đầu được đợt kiểm kê");
      setLoiTaiLanXem(lanXem + 1);
      setDangGui(null);
      setLanXem((n) => n + 1);
    }
  };

  const keTheoKhu = useMemo(() => {
    const tu = boDau(timKe.trim()).toLowerCase();
    return khuVuc
      .map((kv) => ({ ...kv, ke: (kv.ke ?? []).filter((k) => !tu || boDau(k.ma).toLowerCase().includes(tu)) }))
      .filter((kv) => kv.ke.length);
  }, [khuVuc, timKe]);
  const dsDanhMuc = useMemo(() => {
    const tu = boDau(timDanhMuc.trim()).toLowerCase();
    return (qCay.data ?? []).filter((x) => !tu || boDau(`${x.ten} ${x.ma ?? ""}`).toLowerCase().includes(tu));
  }, [qCay.data, timDanhMuc]);

  const doiTapHop = (setter, ids, bat) =>
    setter((cu) => {
      const moi = new Set(cu);
      ids.forEach((x) => (bat ? moi.add(x) : moi.delete(x)));
      return moi;
    });

  const dangTaiKho = qKho.loading && qKho.data === undefined;
  const coTheBatDau = Boolean(kqXem?.coTheBatDau) && !lyDoKhoa;
  // Lý do chưa bắt đầu được, hiện ngay cạnh nút (không cần rê chuột): gom mọi thứ còn thiếu trong biểu mẫu thành một câu
  const conThieu = [
    thieuPhamVi ? { theo_khu_vuc: "khu vực", theo_ke: "kệ", theo_danh_muc: "danh mục" }[loai] : null,
    !tenGui ? "tên đợt" : null,
    !lyDo.trim() ? "lý do kiểm kê" : null,
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
            ? "Gỡ các vướng mắc ở cột Xem trước"
            : null;

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

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={laSua ? `Sửa ${dot.ma}` : "Tạo đợt kiểm kê"}
            dongPhu={laSua ? [dot.ten, "Nháp"] : "Chọn phạm vi càng hẹp, phần kho phải tạm dừng càng ít"}
            onQuayLai={() => navigate(laSua ? `/stock-take/${dot.id}` : "/stock-take")}
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
            {/* 1. Kho */}
            <section className="grid gap-3">
              <TieuDeMuc so={1}>Kho kiểm kê</TieuDeMuc>
              {laSua ? (
                <p className="max-w-md rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm font-medium text-bo-foreground">
                  {dot.kho?.ten}
                  <span className="ml-2 text-xs font-normal text-bo-muted">Không đổi được kho của đợt đã lập</span>
                </p>
              ) : dangTaiKho ? (
                <p role="status" className="text-sm text-bo-muted">Đang tải danh sách kho…</p>
              ) : !dsKho.length ? (
                <p className="text-sm text-bo-muted">Bạn chưa được phân kho nào đang hoạt động để kiểm kê.</p>
              ) : (
                <div className="grid gap-2 @2xl/khoi:grid-cols-2 @5xl/khoi:grid-cols-3">
                  {dsKho.map((k) => {
                    const chon = Number(k.id) === Number(khoId);
                    return (
                      <label
                        key={k.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                          chon ? "border-bo-primary bg-bo-primary-soft text-bo-foreground" : "border-bo-border bg-bo-surface text-slate-700 hover:bg-bo-surface-subtle",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${idForm}-kho`}
                          checked={chon}
                          onChange={() => {
                            setKhoChon(k.id);
                            setKhuVucIds(new Set());
                            setViTriIds(new Set());
                          }}
                          className="size-4 accent-bo-primary"
                        />
                        <Warehouse className={cn("size-4 shrink-0", chon ? "text-bo-primary" : "text-bo-muted")} aria-hidden="true" />
                        <span className="min-w-0 truncate font-medium" title={k.tenKho}>
                          {k.tenKho}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Phạm vi */}
            <section className="grid gap-3">
              <TieuDeMuc so={2} phu="Chỉ phần đã chọn bị tạm dừng; phần còn lại của kho vẫn nhập xuất bình thường">
                Phạm vi kiểm kê
              </TieuDeMuc>
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
                      onClick={() => setLoai(ma)}
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
                qSoDo.loading && !qSoDo.data ? (
                  <p role="status" className="text-sm text-bo-muted">Đang tải khu vực…</p>
                ) : !khuVuc.length ? (
                  <p className="text-sm text-bo-muted">Kho chưa có khu vực nào. Thêm khu vực ở Vị trí kệ trước.</p>
                ) : (
                  <div className="grid gap-2 @2xl/khoi:grid-cols-2 @5xl/khoi:grid-cols-3">
                    {khuVuc
                      .filter((kv) => kv.id != null)
                      .map((kv) => {
                        const chon = khuVucIds.has(kv.id);
                        const soKhoa = (kv.ke ?? []).filter((k) => lyDoKhongChon(k)).length;
                        const coHang = (kv.ke ?? []).filter((k) => k.dangChua > 0).length;
                        return (
                          <label
                            key={kv.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                              chon ? "border-bo-primary bg-bo-primary-soft" : "border-bo-border bg-bo-surface hover:bg-bo-surface-subtle",
                              !suaDuoc && "cursor-not-allowed opacity-60",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={chon}
                              disabled={!suaDuoc}
                              onChange={(e) => doiTapHop(setKhuVucIds, [kv.id], e.target.checked)}
                              className="mt-0.5 size-4 accent-bo-primary"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-bo-heading">{kv.ten || kv.ma}</span>
                              <span className="block text-xs text-bo-muted tabular-nums">
                                {soVN(kv.ke?.length ?? 0)} kệ · {soVN(coHang)} kệ có hàng
                              </span>
                              {soKhoa ? (
                                <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-bo-warning">
                                  <Lock className="size-3" aria-hidden="true" />
                                  {soVN(soKhoa)} kệ đang bận
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                )
              ) : null}

              {loai === "theo_ke" ? (
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="relative flex min-w-[200px] max-w-xs flex-1 items-center">
                      <span className="sr-only">Tìm kệ</span>
                      <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
                      <input value={timKe} onChange={(e) => setTimKe(e.target.value)} placeholder="Tìm mã kệ, vd. A-01" className={cn(O_NHAP, "pl-8")} />
                    </label>
                    <span className="text-[13px] text-bo-muted tabular-nums">
                      Đã chọn <b className="font-semibold text-bo-foreground">{soVN(viTriIds.size)}</b> kệ
                    </span>
                    {viTriIds.size ? <NutChu onClick={() => setViTriIds(new Set())}>Bỏ chọn hết</NutChu> : null}
                  </div>
                  {qSoDo.loading && !qSoDo.data ? (
                    <p role="status" className="text-sm text-bo-muted">Đang tải kệ…</p>
                  ) : !keTheoKhu.length ? (
                    <p className="text-sm text-bo-muted">{timKe.trim() ? `Không có kệ nào khớp “${timKe.trim()}”.` : "Kho chưa có kệ nào."}</p>
                  ) : (
                    keTheoKhu.map((kv) => {
                      const chonDuoc = kv.ke.filter((k) => !lyDoKhongChon(k));
                      const chonHet = chonDuoc.length > 0 && chonDuoc.every((k) => viTriIds.has(k.id));
                      return (
                        <fieldset key={kv.id ?? "khac"} className="grid gap-2 rounded-lg border border-bo-border px-3 pb-3 pt-2">
                          <legend className="flex items-center gap-2 px-1 text-[13px] font-semibold text-bo-heading">
                            {kv.ten || kv.ma || "Chưa có khu vực"}
                            {chonDuoc.length && suaDuoc ? (
                              <NutChu onClick={() => doiTapHop(setViTriIds, chonDuoc.map((k) => k.id), !chonHet)}>
                                {chonHet ? "Bỏ cả khu" : `Chọn cả khu (${soVN(chonDuoc.length)})`}
                              </NutChu>
                            ) : null}
                          </legend>
                          <div className="flex flex-wrap gap-1.5">
                            {kv.ke.map((k) => {
                              const khong = lyDoKhongChon(k);
                              const chon = viTriIds.has(k.id);
                              return (
                                <button
                                  key={k.id}
                                  type="button"
                                  aria-pressed={chon}
                                  disabled={Boolean(khong) || !suaDuoc}
                                  title={khong ?? (k.dangChua ? `Đang chứa ${soVN(k.dangChua)} sản phẩm` : "Kệ trống")}
                                  onClick={() => doiTapHop(setViTriIds, [k.id], !chon)}
                                  className={cn(
                                    "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 cam-ung:h-11",
                                    chon
                                      ? "border-bo-primary bg-bo-primary text-white"
                                      : khong
                                        ? "cursor-not-allowed border-dashed border-slate-300 bg-slate-50 text-slate-400"
                                        : "border-bo-border bg-white text-slate-700 hover:border-bo-primary/50 hover:bg-bo-primary-soft",
                                  )}
                                >
                                  {k.trangThai === "BAO_TRI" ? <Wrench className="size-3" aria-hidden="true" /> : khong ? <Lock className="size-3" aria-hidden="true" /> : chon ? <Check className="size-3" aria-hidden="true" /> : null}
                                  {k.ma}
                                  {!khong && k.dangChua ? (
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
                <div className="grid gap-2">
                  <label className="relative flex max-w-sm items-center">
                    <span className="sr-only">Tìm danh mục</span>
                    <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
                    <input value={timDanhMuc} onChange={(e) => setTimDanhMuc(e.target.value)} placeholder="Tìm danh mục" className={cn(O_NHAP, "pl-8")} />
                  </label>
                  {qCay.loading && !qCay.data ? (
                    <p role="status" className="text-sm text-bo-muted">Đang tải danh mục…</p>
                  ) : (
                    <ul role="radiogroup" aria-label="Danh mục kiểm kê" className="m-0 max-h-80 list-none overflow-y-auto rounded-lg border border-bo-border p-1">
                      {dsDanhMuc.map((x) => {
                        const chon = danhMucId === x.id;
                        return (
                          <li key={x.id}>
                            <button
                              type="button"
                              role="radio"
                              aria-checked={chon}
                              disabled={!suaDuoc}
                              onClick={() => setDanhMucId(x.id)}
                              // data-viz: thụt lề theo độ sâu của danh mục
                              style={{ paddingLeft: `${12 + (timDanhMuc.trim() ? 0 : x.sau) * 20}px` }}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-md py-2 pr-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                                chon ? "bg-bo-primary-soft font-semibold text-bo-primary-strong" : "text-bo-foreground hover:bg-bo-surface-subtle",
                              )}
                            >
                              <span aria-hidden="true" className={cn("size-4 shrink-0 rounded-full border-2", chon ? "border-bo-primary bg-bo-primary shadow-[inset_0_0_0_2px_white]" : "border-slate-300")} />
                              <span className="min-w-0 truncate">{x.ten}</span>
                              {x.soCon ? <span className="ml-auto shrink-0 text-xs font-normal text-bo-muted">gồm {soVN(x.soCon)} nhóm con</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="text-xs leading-4 text-bo-muted">
                    Khóa mịn: chỉ lô thuộc danh mục (và mọi danh mục con) bị giữ; hàng khác trên cùng kệ vẫn bán.
                  </p>
                </div>
              ) : null}
            </section>

            {/* 3. Thông tin */}
            <section className="grid max-w-3xl gap-4">
              <TieuDeMuc so={3}>Thông tin đợt</TieuDeMuc>
              <div className="grid gap-4 @2xl/khoi:grid-cols-2">
                <label className="grid gap-1.5 @2xl/khoi:col-span-2">
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
                <label className="grid gap-1.5">
                  <span className={NHAN_O}>Người chủ trì</span>
                  <select value={chuTri ?? ""} disabled={!suaDuoc || !dsNguoi.length} onChange={(e) => setNguoiChuTriId(Number(e.target.value))} className={O_NHAP}>
                    {!dsNguoi.length ? <option value="">{qNguoi.loading ? "Đang tải…" : "Chưa có quản lý kho của kho này"}</option> : null}
                    {dsNguoi.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.hoTen}
                        {n.id === nguoiDungId ? " (bạn)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className={GOI_Y_O}>Quản lý kho của kho; mọi nhân viên kho đều đếm được</span>
                </label>
                <label className="grid gap-1.5">
                  <span className={NHAN_O}>Dự kiến bắt đầu</span>
                  <input type="datetime-local" value={ngayDuKien} disabled={!suaDuoc} onChange={(e) => setNgayDuKien(e.target.value)} className={O_NHAP} />
                  <span className={GOI_Y_O}>Không bắt buộc, để nhắc lịch</span>
                </label>
                <label className="grid gap-1.5 @2xl/khoi:col-span-2">
                  <span className={NHAN_O}>
                    Lý do kiểm kê <span className="text-bo-danger">*</span>
                  </span>
                  <input
                    value={lyDo}
                    maxLength={LY_DO_TOI_DA}
                    disabled={!suaDuoc}
                    onChange={(e) => setLyDo(e.target.value)}
                    placeholder="Ví dụ: Lệch tồn kênh Shopee ở khu A, kiểm định kỳ tháng 11"
                    className={O_NHAP}
                  />
                </label>
                <label className="grid gap-1.5 @2xl/khoi:col-span-2">
                  <span className={NHAN_O}>Ghi chú cho người đếm</span>
                  <textarea
                    value={ghiChu}
                    maxLength={LY_DO_TOI_DA}
                    disabled={!suaDuoc}
                    onChange={(e) => setGhiChu(e.target.value)}
                    placeholder="Ví dụ: Đếm từ kệ trong ra ngoài, hàng lỗi để riêng thùng đỏ"
                    className={O_NHAP_NHIEU_DONG}
                  />
                </label>
              </div>
            </section>
          </form>
        }
        cotPhai={
          <CotThuocTinh nhan="Xem trước phạm vi" className="xl:sticky xl:top-0 xl:self-start">
            <NhomThuocTinh nhan="Xem trước" rong>
              {thieuPhamVi ? (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-bo-border px-3 py-3 text-[13px] text-bo-muted">
                  <Boxes className="size-4" aria-hidden="true" />
                  {thieuPhamVi} để xem trước.
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
                      <NutChu onClick={() => window.open(`/stock-take/unshelved?khoId=${khoId}`, "_blank", "noopener")}>Xếp kệ ở thẻ mới</NutChu>
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
            <NhomThuocTinh nhan="Sau khi bắt đầu" rong>
              <ol className="m-0 grid list-none gap-2 p-0 text-[13px] leading-5 text-slate-700">
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
            </NhomThuocTinh>
          </CotThuocTinh>
        }
      />

      <HopXacNhanChungTu
        mo={hopBatDau}
        onDoiMo={(m) => !m && !dangGui && setHopBatDau(false)}
        tieuDe="Bắt đầu kiểm kê ngay?"
        moTa={`${tenGui} · ${LOAI_PHAM_VI[loai].nhan} · ${tenKho ?? ""}. Phạm vi khóa ngay và số trên sổ kệ được chốt; tới khi duyệt hoặc hủy, hàng trong phạm vi tạm dừng nhập, xuất và bán.`}
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
    </PageContainer>
  );
}
