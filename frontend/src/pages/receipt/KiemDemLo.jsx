import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { ArrowLeft, Check, Loader2, Lock, ScanLine, SearchX, Trash2, XCircle } from "lucide-react";

import PageContainer from "@/components/backoffice/PageContainer";
import { PAGE_HEADING_TYPE, useClaimPageTitle } from "@/components/backoffice/pageTitle";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MetricStrip from "@/components/shared/MetricStrip";
import MockModeNotice from "@/components/shared/MockModeNotice";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import DongThongBao, { NutChu } from "@/components/nhap-kho/DongThongBao";
import HopGhiNhanLoi from "@/components/nhap-kho/HopGhiNhanLoi";
import { DaiO, OBuoc } from "@/components/nhap-kho/ThanhBuoc";
import HopViTriNamODau from "@/components/mat-bang/HopViTriNamODau";
import { goiYMaLo, nhomTrangThaiKe, trangThaiKiemDem } from "@/constants/nhapKho";
import useScanQueue from "@/hooks/useScanQueue";
import { cn } from "@/lib/utils";
import { maVachNhaCungCapService } from "@/services/maVachNhaCungCapService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import { THONG_BAO_CHUA_HO_TRO_VI_TRI, VI_TRI_KHO_DA_CO_MAY_CHU, viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import {
  docThungDangKiem,
  ghiThungDangKiem,
  hangLoiCuaBienThe,
  themHangLoi,
  tongSoLuong,
  xoaHangLoiCuaLo,
} from "@/utils/hangLoiTam";
import { playScanBeep } from "@/utils/scanBeep";

const so = (n) => Number(n || 0).toLocaleString("vi-VN");
const SL_TOI_DA_MOI_LAN = 500;
const THUNG_TRONG = { dat: 0, loi: [], maLo: "", ngaySanXuat: "", viTriId: null };
const O_NHAP =
  "h-9 w-full rounded-md border border-bo-border bg-white px-3 text-sm text-bo-foreground placeholder:text-bo-muted focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15 disabled:bg-bo-surface-subtle";
const gio = () => new Date().toLocaleTimeString("vi-VN", { hour12: false });

/**
 * Kiểm đếm & khóa lô một biến thể của phiếu nhập từ đơn mua — PA2 "Một ô quét cho mọi thứ" (FO-097 / FO-098).
 * Quét sản phẩm để cộng Đạt, quét mã dán trên kệ để chọn vị trí; đủ 3 điều kiện thì khóa lô.
 */
export default function KiemDemLo() {
  useClaimPageTitle(true);
  const { phieuNhapKhoId, bienTheSanPhamId } = useParams();
  const btId = Number(bienTheSanPhamId);
  const navigate = useNavigate();

  const [phieu, setPhieu] = useState(null);
  const [lots, setLots] = useState([]);
  const [loiTai, setLoiTai] = useState(null);
  const [viTris, setViTris] = useState([]);
  const [khuVucs, setKhuVucs] = useState([]);
  const [thung, setThungState] = useState(() => docThungDangKiem(phieuNhapKhoId, btId) ?? THUNG_TRONG);
  const [thongBao, setThongBao] = useState(null);
  const [nhatKy, setNhatKy] = useState([]);
  const [soLuongMoiLan, setSoLuongMoiLan] = useState("1");
  const [tab, setTab] = useState("lo");
  const [maQuet, setMaQuet] = useState("");
  const [hopLoi, setHopLoi] = useState(null);
  const [loXoa, setLoXoa] = useState(null);
  const [moViTri, setMoViTri] = useState(false);
  const [dangKhoa, setDangKhoa] = useState(false);
  const [dangXoa, setDangXoa] = useState(false);
  const [hangLoiLo, setHangLoiLo] = useState(() => hangLoiCuaBienThe(phieuNhapKhoId, btId));
  const oQuetRef = useRef(null);
  const thungRef = useRef(thung);

  const setThung = useCallback(
    (capNhat) => {
      setThungState((cu) => {
        const moi = typeof capNhat === "function" ? capNhat(cu) : capNhat;
        thungRef.current = moi;
        ghiThungDangKiem(phieuNhapKhoId, btId, moi);
        return moi;
      });
    },
    [phieuNhapKhoId, btId],
  );

  const taiLai = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const [chiTiet, resLo] = await Promise.all([
          phieuNhapKhoService.getDetail(phieuNhapKhoId),
          phieuNhapKhoService.getLotInput(phieuNhapKhoId, btId),
        ]);
        setPhieu(chiTiet?.data ?? chiTiet);
        setLots(Array.isArray(resLo?.data) ? resLo.data : []);
        setLoiTai(null);
      } catch (error) {
        if (silent) {
          toast.error(getApiErrorMessage(error, "Không tải lại được dữ liệu lô hàng"));
          return;
        }
        const status = getApiErrorStatus(error);
        setLoiTai(status === 400 || status === 404 ? "khong-thay" : getApiErrorMessage(error, "Không tải được dữ liệu kiểm đếm"));
      }
    },
    [phieuNhapKhoId, btId],
  );

  useEffect(() => {
    queueMicrotask(() => taiLai());
  }, [taiLai]);

  const khoId = phieu?.khoId;
  useEffect(() => {
    if (!viTriKhoService.hoTro || !khoId) return undefined;
    let huy = false;
    Promise.all([viTriKhoService.dsViTri(khoId), viTriKhoService.dsKhuVuc(khoId)])
      .then(([ds, khu]) => {
        if (huy) return;
        setViTris(ds ?? []);
        setKhuVucs(khu ?? []);
      })
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [khoId]);

  const item = phieu?.items?.find((i) => i.bienTheSanPhamId === btId) ?? null;
  const laDonMua = Boolean(phieu?.soDonMua);
  const choSua = phieu?.trangThai === 0 && laDonMua;

  // Gợi ý mã lô cho thùng mới (không trùng lô đã khóa)
  const maLoGoiY = useMemo(() => {
    const daCo = new Set(lots.map((l) => String(l.maLo).toUpperCase()));
    let n = lots.length + 1;
    while (daCo.has(goiYMaLo(n).toUpperCase())) n += 1;
    return goiYMaLo(n);
  }, [lots]);
  const maLo = thung.maLo || maLoGoiY;

  // ── Số liệu ──
  const canNhap = Number(item?.soLuongCanNhap || 0);
  const datDaKhoa = lots.reduce((t, l) => t + Number(l.soLuongNhap || 0), 0);
  const loiDaKhoa = tongSoLuong(hangLoiLo);
  const loiThung = tongSoLuong(thung.loi);
  const trongThung = thung.dat + loiThung;
  const daKiem = datDaKhoa + loiDaKhoa + trongThung;
  const conLai = Math.max(0, canNhap - daKiem);
  const ttKiem = trangThaiKiemDem(daKiem, canNhap);

  const viTriChon = viTris.find((v) => v.id === thung.viTriId) ?? null;
  const khuCuaViTri = viTriChon ? khuVucs.find((k) => k.id === viTriChon.khuVucId) : null;
  const maLoTrung = lots.some((l) => String(l.maLo).trim().toUpperCase() === maLo.trim().toUpperCase());
  const dk1 = trongThung > 0;
  const dk2 = viTriKhoService.hoTro ? Boolean(viTriChon) : true;
  const dk3 = Boolean(maLo.trim()) && Boolean(thung.ngaySanXuat) && !maLoTrung;
  const coTheKhoa = choSua && dk1 && dk2 && dk3 && !dangKhoa;
  const thieu = [!dk1 && "sản phẩm", !dk2 && "vị trí kệ", !maLo.trim() && "mã lô", !thung.ngaySanXuat && "ngày sản xuất"].filter(Boolean);
  const xongBienThe = canNhap > 0 && daKiem >= canNhap && trongThung === 0;

  const ghiNhatKy = (ma, ketQua, tone) => setNhatKy((cu) => [{ id: `${Date.now()}-${cu.length}`, gio: gio(), ma, ketQua, tone }, ...cu].slice(0, 200));

  // ── Quét ──
  const xuLyMa = useCallback(
    async ({ ma, soLuong }) => {
      const code = String(ma || "").trim();
      if (!code) {
        setThongBao({ tone: "bad", chu: "Chưa có mã để nhận. Hãy quét hoặc nhập mã vạch." });
        return;
      }
      const hoa = code.toUpperCase();

      // Mã dán trên kệ
      if (viTriKhoService.hoTro) {
        const ke = viTris.find((v) => String(v.maViTri).toUpperCase() === hoa);
        if (ke) {
          const nhom = nhomTrangThaiKe(ke);
          if (nhom.ma !== "CON_CHO") {
            playScanBeep(false);
            setThongBao({ tone: "bad", chu: `Kệ ${ke.maViTri} đang ${nhom.label.toLowerCase()}, hãy chọn kệ khác.` });
            ghiNhatKy(code, "Kệ không dùng được", "bad");
            return;
          }
          setThung((t) => ({ ...t, viTriId: ke.id }));
          playScanBeep(true);
          setThongBao({ tone: "info", chu: `Đã chọn kệ ${ke.maViTri} cho thùng đang kiểm (còn trống ${so(ke.sucChua - ke.dangChua)}).` });
          ghiNhatKy(code, `Chọn kệ ${ke.maViTri}`, "pri");
          return;
        }
      }

      const congDat = (nguon) => {
        const conLaiHienTai = Math.max(0, canNhap - (datDaKhoa + loiDaKhoa + thungRef.current.dat + tongSoLuong(thungRef.current.loi)));
        if (conLaiHienTai <= 0) {
          playScanBeep(false);
          setThongBao({ tone: "warn", chu: `Đã đủ ${so(canNhap)} sản phẩm theo đơn mua, không cộng thêm.` });
          ghiNhatKy(code, "Vượt số lượng đặt", "warn");
          return;
        }
        const q = Math.min(soLuong, conLaiHienTai);
        setThung((t) => ({ ...t, dat: t.dat + q }));
        playScanBeep(true);
        setThongBao({
          tone: "ok",
          chu: `Đạt +${q} · ${code}${q < soLuong ? ` (chỉ cộng ${q} vì đã đủ số đặt)` : ""}`,
          vuaQuet: { code, q },
        });
        ghiNhatKy(code, `Đạt +${q}${nguon ? ` · ${nguon}` : ""}`, "ok");
      };

      // Mã của biến thể đang kiểm (SKU; mã vạch SKU khi máy chủ trả về)
      if (hoa === String(item?.sku || "").toUpperCase() || (item?.maVachSku && hoa === String(item.maVachSku).toUpperCase())) {
        congDat();
        return;
      }

      // Mã của biến thể khác trong phiếu
      const khac = phieu?.items?.find(
        (i) => i.bienTheSanPhamId !== btId && (String(i.sku).toUpperCase() === hoa || (i.maVachSku && String(i.maVachSku).toUpperCase() === hoa)),
      );
      if (khac) {
        playScanBeep(false);
        setThongBao({ tone: "bad", chu: `Mã ${code} thuộc ${khac.tenBienThe}, không phải biến thể đang kiểm. Để riêng sản phẩm này.` });
        ghiNhatKy(code, "Sai biến thể", "bad");
        return;
      }

      // Mã vạch nhà cung cấp
      if (maVachNhaCungCapService.hoTro) {
        try {
          const lienKet = await maVachNhaCungCapService.tra(code, phieu?.nhaCungCapId);
          if (lienKet?.bienTheSanPhamId === btId) {
            congDat("mã NCC");
            return;
          }
          if (lienKet) {
            playScanBeep(false);
            setThongBao({ tone: "bad", chu: `Mã ${code} đã liên kết với ${lienKet.tenBienThe}, không phải biến thể đang kiểm.` });
            ghiNhatKy(code, "Sai biến thể", "bad");
            return;
          }
          playScanBeep(false);
          setThongBao({ tone: "warn", chu: `Mã ${code} chưa được liên kết với biến thể nào của ${phieu?.tenNhaCungCap || "nhà cung cấp"}.`, lienKet: code });
          ghiNhatKy(code, "Mã NCC chưa liên kết", "warn");
          return;
        } catch (error) {
          setThongBao({ tone: "bad", chu: getApiErrorMessage(error, "Không tra được mã vạch nhà cung cấp") });
          return;
        }
      }

      playScanBeep(false);
      setThongBao({ tone: "bad", chu: `Mã ${code} không khớp SKU của biến thể đang kiểm. Kiểm tra lại tem hoặc quét mã SKU.` });
      ghiNhatKy(code, "Mã không khớp", "bad");
    },
    [btId, canNhap, datDaKhoa, item, loiDaKhoa, phieu, setThung, viTris],
  );

  const { enqueue } = useScanQueue(xuLyMa);

  const nhanMa = (e) => {
    e.preventDefault();
    if (!choSua) return;
    const q = Math.max(1, Math.min(SL_TOI_DA_MOI_LAN, Math.floor(Number(soLuongMoiLan)) || 1));
    enqueue({ ma: maQuet, soLuong: q });
    setMaQuet("");
    setSoLuongMoiLan("1");
    oQuetRef.current?.focus();
  };

  const lienKetMa = async (code) => {
    try {
      await maVachNhaCungCapService.lienKet({
        maVach: code,
        nhaCungCapId: phieu?.nhaCungCapId,
        bienTheSanPhamId: btId,
        phieuNhapKhoId: Number(phieuNhapKhoId),
      });
      toast.success(`Đã liên kết mã ${code} với biến thể đang kiểm`);
      enqueue({ ma: code, soLuong: 1 });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không liên kết được mã vạch"));
    }
  };

  const hoanTac = () => {
    const vua = thongBao?.vuaQuet;
    if (!vua) return;
    setThung((t) => ({ ...t, dat: Math.max(0, t.dat - vua.q) }));
    setThongBao({ tone: "warn", chu: `Đã hoàn tác lượt quét ${vua.code} (bớt ${vua.q} Đạt).` });
    ghiNhatKy(vua.code, "Hoàn tác", "warn");
    oQuetRef.current?.focus();
  };

  const ghiNhanLoi = ({ soLuong, lyDo, ghiChu }) => {
    const tuLuotQuet = hopLoi?.tuLuotQuet;
    setThung((t) => ({
      ...t,
      dat: tuLuotQuet ? Math.max(0, t.dat - soLuong) : t.dat,
      loi: [...t.loi, { lyDo, soLuong, ghiChu }],
    }));
    setThongBao({ tone: "warn", chu: `Ghi nhận ${soLuong} lỗi: ${lyDo}${ghiChu ? ` (${ghiChu})` : ""}.` });
    ghiNhatKy(hopLoi?.code || "Ghi tay", `Lỗi · ${lyDo}${soLuong > 1 ? ` ×${soLuong}` : ""}`, "bad");
    setHopLoi(null);
    queueMicrotask(() => oQuetRef.current?.focus());
  };

  const khoaLo = async () => {
    if (!coTheKhoa) return;
    setDangKhoa(true);
    const t = thungRef.current;
    const ma = maLo.trim();
    try {
      if (t.dat > 0 || tongSoLuong(t.loi) > 0) {
        await phieuNhapKhoService.khaiBaoLo(phieuNhapKhoId, {
          bienTheSanPhamId: btId,
          maLo: ma,
          ngaySanXuat: `${t.ngaySanXuat}T00:00:00.000Z`,
          soLuongNhap: t.dat,
          ...(tongSoLuong(t.loi) > 0 ? {
            soLuongLoi: tongSoLuong(t.loi),
            lyDoLoi: t.loi.map((l) => l.lyDo).join(", "),
          } : {}),
          // Chỉ gửi vị trí khi máy chủ thật đã có vị trí kệ (id của dữ liệu mẫu không có ở máy chủ)
          ...(VI_TRI_KHO_DA_CO_MAY_CHU && t.viTriId ? { viTriKhoId: t.viTriId } : {}),
        });
      }
      themHangLoi(phieuNhapKhoId, btId, t.loi.map((l) => ({ maLo: ma, lyDo: l.lyDo, soLuong: l.soLuong })));
      setHangLoiLo(hangLoiCuaBienThe(phieuNhapKhoId, btId));
      setThung({ ...THUNG_TRONG, ngaySanXuat: t.ngaySanXuat, viTriId: t.viTriId });
      setThongBao({
        tone: "ok",
        chu: `Đã khóa lô ${ma}: ${t.dat} đạt, ${tongSoLuong(t.loi)} lỗi${viTriChon ? ` tại kệ ${viTriChon.maViTri}` : ""}. Bộ đếm về 0 cho thùng tiếp theo.`,
      });
      ghiNhatKy(ma, `Khóa lô · ${t.dat} đạt, ${tongSoLuong(t.loi)} lỗi`, "pri");
      await taiLai({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không khóa được lô"));
    } finally {
      setDangKhoa(false);
      oQuetRef.current?.focus();
    }
  };

  const xoaLo = async () => {
    if (!loXoa) return;
    setDangXoa(true);
    try {
      await phieuNhapKhoService.deleteLo(phieuNhapKhoId, loXoa.chiTietPhieuNhapKhoId);
      xoaHangLoiCuaLo(phieuNhapKhoId, btId, loXoa.maLo);
      setHangLoiLo(hangLoiCuaBienThe(phieuNhapKhoId, btId));
      toast.success(`Đã xóa lô ${loXoa.maLo}`);
      setLoXoa(null);
      await taiLai({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không xóa được lô"));
    } finally {
      setDangXoa(false);
    }
  };

  // ── Trạng thái tải ──
  if (loiTai) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
          {loiTai === "khong-thay" ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy phiếu nhập kho"
              description="Phiếu nhập kho không tồn tại hoặc đã bị xóa khỏi hệ thống."
              action={<Button onClick={() => navigate("/goods-receipts")} className="bg-bo-primary text-white hover:bg-bo-primary-hover">Quay lại danh sách</Button>}
            />
          ) : (
            <ErrorState title="Không tải được dữ liệu kiểm đếm" description={loiTai} onRetry={() => taiLai()} />
          )}
        </div>
      </PageContainer>
    );
  }
  if (!phieu) {
    return (
      <PageContainer>
        <LoadingState label="Đang tải dữ liệu kiểm đếm" />
      </PageContainer>
    );
  }
  // Phiếu chuyển kho / hoàn trả: lô tự động, dùng màn khai báo lô cũ
  if (!laDonMua) return <Navigate to={`/goods-receipts/${phieuNhapKhoId}/lot-input/${btId}`} replace />;
  if (!item) {
    return (
      <PageContainer>
        <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
          <EmptyState
            icon={SearchX}
            title="Không tìm thấy biến thể trong phiếu nhập"
            description="Biến thể này không có trong phiếu nhập kho."
            action={<Button onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)} className="bg-bo-primary text-white hover:bg-bo-primary-hover">Quay lại phiếu nhập</Button>}
          />
        </div>
      </PageContainer>
    );
  }

  const loCuoi = lots[lots.length - 1];
  const thongBaoMacDinh = viTriKhoService.hoTro
    ? "Mỗi lần quét sản phẩm tính 1 Đạt. Quét mã dán trên kệ để chọn vị trí. Hàng lỗi bấm “Ghi nhận hàng lỗi”."
    : "Mỗi lần quét sản phẩm tính 1 Đạt (quét hoặc nhập mã SKU). Hàng lỗi bấm “Ghi nhận hàng lỗi”.";

  return (
    <PageContainer className="flex flex-col gap-4 pb-28">
      <button
        type="button"
        onClick={() => navigate(`/goods-receipts/${phieuNhapKhoId}`)}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
      >
        <ArrowLeft className="size-4" /> Phiếu nhập {phieu.soPhieuNhap}
      </button>

      <div className="min-w-0">
        <div className="flex min-h-9 flex-wrap items-center gap-3">
          <h1 className={cn("min-w-0 truncate", PAGE_HEADING_TYPE)}>{item.tenBienThe}</h1>
          <StatusBadge label={ttKiem.label} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-bo-muted">
          <span>SKU <span className="font-mono">{item.sku}</span></span>
          {phieu.tenNhaCungCap ? <span>{phieu.tenNhaCungCap}</span> : null}
          {phieu.tenKho ? <span>{phieu.tenKho}</span> : null}
        </p>
      </div>

      {viTriKhoService.mau || maVachNhaCungCapService.mau ? (
        <MockModeNotice
          show
          reason="máy chủ chưa có API vị trí kệ và mã vạch nhà cung cấp"
          note="Chỉ vị trí kệ và mã vạch NCC là mẫu; số đạt, mã lô và ngày sản xuất vẫn ghi vào phiếu nhập thật."
        />
      ) : null}

      <MetricStrip
        label="Số liệu kiểm đếm"
        items={[
          { label: "Đã kiểm theo đơn mua", value: `${so(daKiem)} / ${so(canNhap)}`, hint: conLai ? `Còn ${so(conLai)} sản phẩm` : "Đã đủ số lượng đặt" },
          { label: "Đạt", value: so(datDaKhoa + thung.dat), hint: `${so(thung.dat)} trong thùng đang kiểm` },
          { label: "Lỗi", value: so(loiDaKhoa + loiThung), hint: `${so(loiThung)} trong thùng đang kiểm`, tone: loiDaKhoa + loiThung ? "danger" : undefined },
          { label: "Lô đã khóa", value: so(lots.length), hint: loCuoi ? `Gần nhất ${loCuoi.maLo}` : "Chưa khóa lô nào" },
        ]}
      />

      {choSua ? (
        <>
          <section className="rounded-lg border border-bo-border bg-white p-4 shadow-sm">
            <form onSubmit={nhanMa} className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 sm:grid-cols-[minmax(0,1fr)_96px_auto]">
              <label className="relative min-w-0">
                <span className="sr-only">Mã vạch</span>
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-bo-muted" aria-hidden="true" />
                <input
                  ref={oQuetRef}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={maQuet}
                  onChange={(e) => setMaQuet(e.target.value)}
                  placeholder={viTriKhoService.hoTro ? "Quét sản phẩm để đếm, hoặc quét mã trên kệ để chọn vị trí" : "Quét hoặc nhập mã SKU rồi nhấn Enter"}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 font-mono text-[15px] text-bo-heading placeholder:font-sans placeholder:text-sm placeholder:text-slate-400 focus:border-bo-primary focus:outline-none focus:ring-[3px] focus:ring-bo-primary/20"
                />
              </label>
              <label className="flex h-10 items-center overflow-hidden rounded-md border border-slate-300 bg-white focus-within:border-bo-primary focus-within:ring-[3px] focus-within:ring-bo-primary/20" title="Số lượng mỗi lần quét">
                <span className="pl-3 pr-1 text-xs font-semibold text-bo-muted">SL</span>
                <input
                  inputMode="numeric"
                  aria-label="Số lượng mỗi lần quét"
                  value={soLuongMoiLan}
                  onChange={(e) => setSoLuongMoiLan(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  className="h-full w-full min-w-0 bg-transparent pr-3 text-right text-[15px] font-semibold tabular-nums focus:outline-none"
                />
              </label>
              <Button type="submit" className="col-span-2 h-10 min-w-28 bg-bo-primary text-white hover:bg-bo-primary-hover sm:col-span-1">
                Nhận mã
              </Button>
            </form>
            <DongThongBao
              className="mt-3"
              tone={thongBao?.tone ?? "neutral"}
              actions={
                thongBao?.vuaQuet ? (
                  <>
                    <NutChu onClick={hoanTac}>Hoàn tác</NutChu>
                    <NutChu onClick={() => setHopLoi({ tuLuotQuet: true, code: thongBao.vuaQuet.code, soLuong: thongBao.vuaQuet.q })}>Chuyển thành lỗi</NutChu>
                  </>
                ) : thongBao?.lienKet ? (
                  <NutChu onClick={() => lienKetMa(thongBao.lienKet)}>Liên kết với biến thể này</NutChu>
                ) : null
              }
            >
              {thongBao?.chu ?? thongBaoMacDinh}
            </DongThongBao>
          </section>

          <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
            <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-bo-border px-4 py-2">
              <h2 className="text-base font-semibold text-bo-foreground">
                Thùng đang kiểm · <span className="font-mono font-medium">{maLo || "—"}</span>
              </h2>
              <span className="text-xs text-bo-muted">Đủ điều kiện thì khóa lô được</span>
            </div>
            <DaiO soO={3} phang>
              <OBuoc
                trangThai={dk1 ? "xong" : "dang"}
                so={1}
                nhan="Sản phẩm trong thùng"
                nhanTrangThai={dk1 ? "Đã có" : "Còn thiếu"}
                giaTri={
                  dk1 ? (
                    <span>
                      {so(thung.dat)} đạt · <span className={loiThung ? "text-bo-danger" : "font-medium text-bo-muted"}>{so(loiThung)} lỗi</span>
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-bo-muted">Chưa quét sản phẩm nào</span>
                  )
                }
                moTa={thung.loi.length ? `Lỗi: ${thung.loi.map((l) => `${l.lyDo} ${l.soLuong}`).join(" · ")}` : "Quét sản phẩm để cộng Đạt."}
                hanhDong={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={conLai <= 0}
                    onClick={() => setHopLoi({ tuLuotQuet: false, code: "", soLuong: 1 })}
                    className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                  >
                    <XCircle className="size-4 text-bo-danger" /> Ghi nhận hàng lỗi
                  </Button>
                }
              />
              {viTriKhoService.hoTro ? (
                <OBuoc
                  trangThai={dk2 ? "xong" : dk1 ? "dang" : "cho"}
                  so={2}
                  nhan="Vị trí kệ"
                  nhanTrangThai={dk2 ? "Đã có" : "Còn thiếu"}
                  giaTri={viTriChon ? <span className="font-mono">{viTriChon.maViTri}</span> : <span className="text-sm font-medium text-bo-muted">Quét mã dán trên kệ</span>}
                  moTa={
                    viTriChon ? (
                      <span>
                        {khuCuaViTri?.tenKhuVuc ?? "—"} · còn trống {so(viTriChon.sucChua - viTriChon.dangChua)} ·{" "}
                        <NutChu onClick={() => setMoViTri(true)}>Xem trên mặt bằng</NutChu>
                      </span>
                    ) : (
                      "Hoặc chọn tay nếu kệ chưa dán mã."
                    )
                  }
                  hanhDong={
                    <select
                      aria-label="Chọn tay vị trí kệ"
                      value={thung.viTriId ?? ""}
                      onChange={(e) => setThung((t) => ({ ...t, viTriId: e.target.value ? Number(e.target.value) : null }))}
                      className="h-8 max-w-[260px] rounded-md border border-bo-border bg-white px-2 text-[13px] text-bo-foreground focus:border-bo-primary focus:outline-none"
                    >
                      <option value="">Chọn tay vị trí kệ</option>
                      {khuVucs.map((k) => (
                        <optgroup key={k.id} label={k.tenKhuVuc}>
                          {viTris
                            .filter((v) => v.khuVucId === k.id && nhomTrangThaiKe(v).ma === "CON_CHO")
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.maViTri} · còn trống {so(v.sucChua - v.dangChua)}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  }
                />
              ) : (
                <OBuoc
                  trangThai="cho"
                  so={2}
                  nhan="Vị trí kệ"
                  nhanTrangThai="Không bắt buộc"
                  giaTri={<span className="text-sm font-medium text-bo-muted">Chờ máy chủ</span>}
                  moTa={`${THONG_BAO_CHUA_HO_TRO_VI_TRI} Khóa lô không cần vị trí kệ.`}
                />
              )}
              <OBuoc
                trangThai={dk3 ? "xong" : dk1 && dk2 ? "dang" : "cho"}
                so={3}
                nhan="Mã lô & ngày sản xuất"
                nhanTrangThai={dk3 ? "Đã có" : "Còn thiếu"}
                giaTri={
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                    <input
                      aria-label="Mã lô"
                      value={maLo}
                      onChange={(e) => setThung((t) => ({ ...t, maLo: e.target.value }))}
                      className={cn(O_NHAP, "font-mono text-[13px]")}
                    />
                    <input
                      type="date"
                      aria-label="Ngày sản xuất"
                      value={thung.ngaySanXuat}
                      onChange={(e) => setThung((t) => ({ ...t, ngaySanXuat: e.target.value }))}
                      className={O_NHAP}
                    />
                  </div>
                }
                moTa={
                  maLoTrung ? (
                    <span className="text-bo-danger">Mã lô đã có trong phiếu, hãy đổi mã khác.</span>
                  ) : (
                    "Mã lô tự gợi ý theo ngày, sửa được."
                  )
                }
              />
            </DaiO>
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-bo-border bg-bo-surface-subtle px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-bo-foreground">
                {thieu.length ? (
                  <>Còn thiếu: {thieu.join(", ")}.</>
                ) : (
                  <>
                    <Check className="size-4 text-bo-success" aria-hidden="true" /> Đủ điều kiện. Khóa lô xong, bộ đếm về 0 cho thùng tiếp theo.
                  </>
                )}
              </span>
              <Button disabled={!coTheKhoa} onClick={khoaLo} className="min-w-[120px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                {dangKhoa ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Khóa lô
              </Button>
            </div>
          </section>
        </>
      ) : (
        <DongThongBao>
          {phieu.trangThai === 3 ? "Phiếu đã nhập kho, chỉ xem lô đã khóa." : "Phiếu không còn ở trạng thái kiểm đếm, chỉ xem lô đã khóa."}
        </DongThongBao>
      )}

      <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        <div role="tablist" aria-label="Lịch sử kiểm đếm" className="flex gap-1 border-b border-bo-border px-2">
          {[
            ["lo", "Lô đã khóa", lots.length],
            ["log", "Nhật ký quét", nhatKy.length],
          ].map(([ma, nhan, soLuong]) => (
            <button
              key={ma}
              type="button"
              role="tab"
              aria-selected={tab === ma}
              onClick={() => setTab(ma)}
              className={cn(
                "-mb-px inline-flex h-12 items-center gap-2 border-b-2 px-2.5 text-sm",
                tab === ma ? "border-bo-primary font-semibold text-bo-foreground" : "border-transparent font-medium text-bo-muted hover:text-bo-foreground",
              )}
            >
              {nhan}
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">{soLuong}</span>
            </button>
          ))}
        </div>
        {tab === "lo" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  {["Mã lô", "Ngày sản xuất"].map((t) => (
                    <th key={t} className="h-10 px-4 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{t}</th>
                  ))}
                  <th className="h-10 w-24 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đạt</th>
                  <th className="h-10 w-24 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Lỗi</th>
                  <th className="h-10 w-16 px-4"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {lots.map((l) => {
                  const loi = tongSoLuong(hangLoiLo.filter((d) => d.maLo === l.maLo));
                  return (
                    <tr key={l.chiTietPhieuNhapKhoId ?? l.loHangId}>
                      <td className="h-14 px-4 font-mono font-semibold text-bo-foreground">{l.maLo}</td>
                      <td className="px-4 tabular-nums">{formatDate(l.ngaySanXuat)}</td>
                      <td className="px-4 text-right tabular-nums">{so(l.soLuongNhap)}</td>
                      <td className={cn("px-4 text-right tabular-nums", loi ? "font-semibold text-bo-danger" : "text-bo-muted")}>{so(loi)}</td>
                      <td className="px-4 text-right">
                        {choSua ? (
                          <Button variant="ghost" size="icon-sm" aria-label={`Xóa lô ${l.maLo}`} onClick={() => setLoXoa(l)} className="text-bo-muted hover:bg-bo-danger-soft hover:text-bo-danger">
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 px-4 text-center text-sm text-bo-muted">Chưa có lô nào được khóa.</td>
                  </tr>
                ) : null}
              </tbody>
              {lots.length ? (
                <tfoot>
                  <tr className="border-t border-bo-border bg-bo-surface-subtle font-semibold">
                    <td className="h-12 px-4" colSpan={2}>Tổng đã khóa</td>
                    <td className="px-4 text-right tabular-nums">{so(datDaKhoa)}</td>
                    <td className={cn("px-4 text-right tabular-nums", loiDaKhoa ? "text-bo-danger" : "")}>{so(loiDaKhoa)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        ) : (
          <ul className="divide-y divide-bo-border">
            {nhatKy.slice(0, 50).map((n) => (
              <li key={n.id} className="grid min-h-11 grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 px-4 py-1.5 text-[13px] sm:grid-cols-[72px_minmax(0,1fr)_260px]">
                <time className="tabular-nums text-bo-muted">{n.gio}</time>
                <span className="truncate font-mono text-xs text-slate-600">{n.ma}</span>
                <span className="col-start-2 flex min-w-0 items-center gap-2 sm:col-start-auto">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      n.tone === "ok" ? "bg-bo-success" : n.tone === "bad" ? "bg-bo-danger" : n.tone === "warn" ? "bg-amber-500" : n.tone === "pri" ? "bg-bo-primary" : "bg-slate-300",
                    )}
                  />
                  <span className="truncate">{n.ketQua}</span>
                </span>
              </li>
            ))}
            {nhatKy.length === 0 ? <li className="flex h-24 items-center justify-center text-sm text-bo-muted">Chưa có lượt quét nào trong phiên này.</li> : null}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 z-10 flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-bo-border bg-white px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(16,24,40,0.16)]">
        <span className="flex min-w-0 items-center gap-2 text-sm text-bo-foreground">
          {xongBienThe ? (
            <>
              <Check className="size-4 text-bo-success" aria-hidden="true" /> Đã đủ {so(canNhap)} sản phẩm theo đơn mua.
            </>
          ) : trongThung > 0 ? (
            "Khóa thùng đang kiểm trước khi hoàn tất biến thể."
          ) : (
            `Còn ${so(conLai)} sản phẩm nữa mới đủ số lượng đặt (${so(canNhap)}).`
          )}
        </span>
        <Button
          disabled={!xongBienThe}
          onClick={async () => {
            try {
              await phieuNhapKhoService.hoanTatKiemDemBienThe(phieuNhapKhoId, btId);
            } catch (_) {
              // Bỏ qua nếu máy chủ đã tự chốt ở khaiBaoLo
            }
            navigate(`/goods-receipts/${phieuNhapKhoId}`);
          }}
          className="gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
        >
          <Check className="size-4" /> Hoàn tất kiểm đếm biến thể
        </Button>
      </div>

      <HopGhiNhanLoi
        open={Boolean(hopLoi)}
        onOpenChange={(mo) => !mo && setHopLoi(null)}
        moTa={hopLoi?.tuLuotQuet ? `Chuyển sản phẩm vừa quét (${hopLoi.code}) từ Đạt sang Lỗi.` : `${item.tenBienThe} · thùng đang kiểm`}
        soLuongBanDau={hopLoi?.soLuong ?? 1}
        toiDa={hopLoi?.tuLuotQuet ? thung.dat : conLai}
        onXacNhan={ghiNhanLoi}
      />
      <ConfirmModal
        isOpen={Boolean(loXoa)}
        onClose={() => !dangXoa && setLoXoa(null)}
        onConfirm={xoaLo}
        title="Xóa lô hàng"
        description={<>Xóa lô <span className="font-semibold text-bo-danger">{loXoa?.maLo}</span>? Số lượng của lô bị trừ khỏi tiến độ.</>}
        confirmText="Xóa lô"
        isLoading={dangXoa}
      />
      <HopViTriNamODau
        open={moViTri}
        onOpenChange={setMoViTri}
        khoId={khoId}
        viTriId={viTriChon?.id ?? null}
        onMoSoDoKe={({ khuVucId, viTriId }) => navigate(`/warehouse/locations?xem=so-do&khu=${khuVucId}${viTriId ? `&viTri=${viTriId}` : ""}`)}
      />
    </PageContainer>
  );
}
