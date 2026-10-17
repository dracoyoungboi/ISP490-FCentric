import { Fragment, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, CloudDownload, CloudUpload, ListRestart, Loader2, MoreHorizontal, PackageSearch, SearchX, Upload } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import ConfirmModal from "@/components/ui/confirm-modal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import StatusTabs from "@/components/shared/StatusTabs";
import SearchInput from "@/components/shared/SearchInput";
import TableShell from "@/components/shared/TableShell";
import TablePagination from "@/components/shared/TablePagination";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import AttentionBar from "@/components/shared/AttentionBar";
import MockModeNotice from "@/components/shared/MockModeNotice";
import SyncLogDetailSheet from "@/components/channel/SyncLogDetailSheet";
import GhepBienThe from "@/components/channel/GhepBienThe";
import { AnhSanPham } from "@/components/channel/HienThiKenh";
import StatusBadge from "@/components/shared/StatusBadge";
import { SWITCH_CLASS } from "@/components/channel/SettingsCard";
import { NUT_CHINH, NUT_PHU } from "@/components/channel/BottomActionBar";
import { daKetNoi } from "@/components/channel/ketNoiShopify";
import { quyTacTonKho } from "@/components/channel/cauHinhDongBo";
import { ketQuaDayLenSan, ketQuaDayTon, ketQuaTaiSanPham } from "@/components/channel/ketQuaThaoTac";
import { LIEN_KET_STATUS, LIEN_KET_TABS, SAN_BAN_HANG, tinhSoTonDayLenSan } from "@/constants/channel";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { isChannelMock, kenhBanHangService } from "@/services/kenhBanHangService";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const SAN = SAN_BAN_HANG.find((s) => s.maKenh === "SHOPIFY");
const TAB_MAS = LIEN_KET_TABS.map((tab) => tab.ma);
const TAB_MAC_DINH = "tat-ca";
const SEARCH_DEBOUNCE_MS = 350;
const TH = "h-10 whitespace-nowrap px-3 text-[11px] font-semibold uppercase tracking-wide text-bo-muted";
const CHECKBOX_CLASS =
  "border-slate-300 bg-white data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white";
const soVN = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("vi-VN"));
const dangDongBo = (dong) => dong.trangThaiLienKet !== "chua_lien_ket";
const coSo = (n) => n !== null && n !== undefined;

/** Giờ đẩy ngắn gọn: hôm nay chỉ ghi giờ, ngày khác ghi thêm ngày/tháng. */
function gioDayTon(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const gio = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString() ? gio : `${gio} ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`;
}

/**
 * Ô "Đã đẩy lên sàn": số sàn đã nhận ở lần đẩy thành công gần nhất, dòng dưới là giờ đẩy,
 * hoặc "→ sẽ đẩy N" (cam) khi theo khả dụng và quy tắc hiện tại, lần đẩy tới sẽ đổi số.
 */
function OTonDaDay({ dong, seDay }) {
  if (!dangDongBo(dong)) return <span className="text-bo-muted">—</span>;
  const daDay = dong.soLuongDaDay;
  const lech = coSo(seDay) && (!coSo(daDay) || Number(seDay) !== Number(daDay));
  const gio = coSo(daDay) && dong.ngayDayTonCuoi ? gioDayTon(dong.ngayDayTonCuoi) : null;
  return (
    <div className="flex flex-col items-end">
      {coSo(daDay) ? (
        <span className="tabular-nums text-bo-foreground" title={gio ? `${SAN.ten} đã nhận lúc ${gio}` : undefined}>
          {soVN(daDay)}
        </span>
      ) : (
        <span className="text-[13px] text-bo-muted">Chưa đẩy</span>
      )}
      {lech ? (
        <span className="text-[12px] font-medium tabular-nums text-amber-600">→ sẽ đẩy {soVN(seDay)}</span>
      ) : gio ? (
        <span className="text-[12px] tabular-nums text-slate-400">{gio}</span>
      ) : null}
    </div>
  );
}

/** Một mục đếm ở hàng sản phẩm: chấm màu + "N trạng thái". */
function DemTrangThai({ so, nhan, mau, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", mau)} aria-hidden="true" />
      <span className="tabular-nums">{soVN(so)}</span> {nhan}
    </span>
  );
}

/** Gom các SKU cùng sản phẩm trên trang đang xem, giữ thứ tự xuất hiện. */
function gomTheoSanPham(rows) {
  const nhom = [];
  const theoKhoa = new Map();
  rows.forEach((dong) => {
    const khoa = dong.sanPhamId != null ? `sp-${dong.sanPhamId}` : `ten-${dong.tenSanPham || dong.tenSanPhamSan || dong.id}`;
    if (!theoKhoa.has(khoa)) {
      const moi = { khoa, ten: dong.tenSanPham || dong.tenSanPhamSan || "—", anh: dong.anhDaiDien ?? null, dong: [] };
      theoKhoa.set(khoa, moi);
      nhom.push(moi);
    }
    const g = theoKhoa.get(khoa);
    if (!g.anh && dong.anhDaiDien) g.anh = dong.anhDaiDien;
    g.dong.push(dong);
  });
  return nhom;
}

/**
 * Sản phẩm đã liên kết với gian hàng Shopify, gom theo sản phẩm: ảnh, SKU, tồn khả dụng, số hiện trên Shopify,
 * công tắc đồng bộ từng dòng, chọn nhiều dòng để bật/tắt, ghép biến thể khác ngay tại dòng.
 */
export default function ChannelMappingsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useTabTrenUrl(TAB_MAS, TAB_MAC_DINH);
  const tabTrangThai = LIEN_KET_TABS.find((t) => t.ma === tab)?.trangThai ?? null;
  const [searchText, setSearchText] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState({ page: 0, size: SO_DONG_MAC_DINH });

  const cfg = useTaiDuLieu(() => kenhBanHangService.getShopifyConfig(), "cau-hinh-shopify");
  const ketNoi = daKetNoi(cfg.data);
  const ch = useTaiDuLieu(() => kenhBanHangService.getCauHinhDongBo(SAN.maKenh), "cau-hinh-dong-bo", { enabled: ketNoi });
  const tq = useTaiDuLieu(() => kenhBanHangService.getTongQuan(SAN.maKenh), "tong-quan", { enabled: ketNoi });
  const ds = useTaiDuLieu(
    () => kenhBanHangService.filterLienKet(SAN.maKenh, { page: trang.page, size: trang.size, search: tuKhoa, trangThai: tabTrangThai }),
    `${tab}|${tuKhoa}|${trang.page}|${trang.size}`,
    { enabled: ketNoi },
  );

  const [dangChay, setDangChay] = useState(null); // { ten, id? }
  const dangChayRef = useRef(null);
  const moGhepSauMenuRef = useRef(null); // dòng sẽ mở ô ghép khi menu ⋯ đóng xong
  const [hoiDayLen, setHoiDayLen] = useState(false);
  const [chiTietId, setChiTietId] = useState(null);
  const [ghepId, setGhepId] = useState(null); // dòng đang mở ô ghép biến thể khác
  const [chon, setChon] = useState(() => new Set());
  const [dongGon, setDongGon] = useState(() => new Set()); // nhóm đang thu gọn

  // Gõ tìm kiếm: chờ người dùng ngừng gõ rồi mới lọc
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const moi = searchText.trim();
      if (moi === tuKhoa) return;
      setTuKhoa(moi);
      setTrang((cu) => ({ ...cu, page: 0 }));
      setChon(new Set());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchText, tuKhoa]);

  if (cfg.data && !ketNoi) return <Navigate to={`${SAN.duongDan}/setup`} replace />;

  const quyTac = ch.data ? quyTacTonKho(ch.data) : null;
  const rows = ds.data?.content ?? [];
  const tong = ds.data?.totalElements ?? 0;
  const tongQuan = tq.data;
  const chiTiet = rows.find((r) => r.id === chiTietId) ?? null;
  const dangLoc = Boolean(tuKhoa);
  const nhom = gomTheoSanPham(rows);
  const daChon = rows.filter((r) => chon.has(r.id));
  const khoa = Boolean(dangChay);

  const chay = async (ten, viec, id) => {
    if (dangChayRef.current) return undefined;
    dangChayRef.current = ten;
    setDangChay({ ten, id });
    try {
      return await viec();
    } finally {
      dangChayRef.current = null;
      setDangChay(null);
    }
  };

  const taiLaiTatCa = () => {
    ds.reload();
    tq.reload();
  };

  const capNhatDong = (dongMoi) => {
    if (!dongMoi?.id) return;
    // Giữ số tồn khả dụng, ảnh và biến thể đang ghép của dòng cũ khi API không trả lại các giá trị này
    // (ngừng đồng bộ chỉ đổi trạng thái, vẫn giữ ghép để bật lại đúng biến thể cũ)
    ds.setData((cu) =>
      cu
        ? {
            ...cu,
            content: cu.content.map((r) =>
              r.id === dongMoi.id
                ? {
                    ...r,
                    ...dongMoi,
                    soLuongKhaDung: r.soLuongKhaDung ?? dongMoi.soLuongKhaDung,
                    anhDaiDien: dongMoi.anhDaiDien ?? r.anhDaiDien,
                    bienTheSanPhamId: dongMoi.bienTheSanPhamId ?? r.bienTheSanPhamId,
                    maSku: dongMoi.maSku ?? r.maSku,
                    tenBienThe: dongMoi.tenBienThe ?? r.tenBienThe,
                    tenSanPham: dongMoi.tenSanPham ?? r.tenSanPham,
                  }
                : r,
            ),
          }
        : cu,
    );
  };

  const taiTuSan = () =>
    chay("tai", async () => {
      try {
        const res = await kenhBanHangService.taiSanPham(SAN.maKenh);
        const kq = ketQuaTaiSanPham(res, SAN.ten);
        toast.success(kq.title, { description: kq.message });
        taiLaiTatCa();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không tải được sản phẩm từ Shopify"));
      }
    });

  const dayLenSan = () =>
    chay("day-len", async () => {
      try {
        const res = await kenhBanHangService.dayVaLienKetSanPham(SAN.maKenh);
        setHoiDayLen(false);
        const kq = ketQuaDayLenSan(res, SAN.ten);
        (kq.ok ? toast.success : toast.warning)(kq.title, { description: kq.message });
        taiLaiTatCa();
      } catch (error) {
        setHoiDayLen(false);
        toast.error(getApiErrorMessage(error, "Không đưa được sản phẩm lên Shopify"));
      }
    });

  const dayTonNgay = () =>
    chay("day-ton", async () => {
      // Chưa tải được quy tắc đẩy tồn thì không đẩy theo số mặc định
      if (!quyTac) return;
      try {
        const res = await kenhBanHangService.dayTon(SAN.maKenh, quyTac);
        const kq = ketQuaDayTon(res, SAN.ten);
        const bao = kq.tone === "error" ? toast.error : kq.tone === "warning" ? toast.warning : toast.success;
        bao(kq.title, kq.message ? { description: kq.message } : undefined);
        taiLaiTatCa();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Không đẩy được tồn kho"));
      }
    });

  /** Bật/tắt một dòng. Ngừng: bỏ khỏi đợt đẩy tồn (giữ ghép). Bật: ghép lại đúng biến thể cũ. */
  const doiDongBo = async (dong, bat) => {
    const res = await kenhBanHangService.capNhatLienKet(dong.id, {
      bienTheSanPhamId: bat ? dong.bienTheSanPhamId : null,
      choPhepDongBo: bat,
    });
    capNhatDong(res);
  };

  const batTat = (dong) =>
    chay(
      "bat-tat",
      async () => {
        const bat = !dangDongBo(dong);
        try {
          await doiDongBo(dong, bat);
          tq.reload();
          toast.success(bat ? `Đã bật đồng bộ ${dong.maSku}` : `Đã ngừng đồng bộ ${dong.maSku}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không đổi được trạng thái đồng bộ"));
        }
      },
      dong.id,
    );

  const batTatNhieu = (bat) =>
    chay("nhieu", async () => {
      const canDoi = daChon.filter((dong) => dangDongBo(dong) !== bat && (!bat || dong.bienTheSanPhamId));
      let ok = 0;
      let loi = 0;
      for (const dong of canDoi) {
        try {
          await doiDongBo(dong, bat);
          ok += 1;
        } catch {
          loi += 1;
        }
      }
      tq.reload();
      setChon(new Set());
      const cau = `${bat ? "Đã bật" : "Đã ngừng"} đồng bộ ${soVN(ok)} SKU`;
      if (loi) toast.warning(cau, { description: `${soVN(loi)} SKU không đổi được, thử lại sau.` });
      else toast.success(cau);
    });

  const thuLai = (dong) =>
    chay(
      "thu-lai",
      async () => {
        try {
          const res = await kenhBanHangService.thuLaiLienKet(dong.id);
          capNhatDong(res);
          tq.reload();
          if (res?.trangThaiLienKet === "loi") toast.error(`Vẫn lỗi: ${res.chiTietLoi || "không đẩy được tồn kho"}`);
          else toast.success(`Đã đẩy lại tồn ${dong.maSku}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không thử lại được"));
        }
      },
      dong.id,
    );

  const ghep = (dong, bienThe) =>
    chay(
      "ghep",
      async () => {
        try {
          const res = await kenhBanHangService.capNhatLienKet(dong.id, { bienTheSanPhamId: bienThe.id, choPhepDongBo: true });
          capNhatDong(res);
          tq.reload();
          setGhepId(null);
          toast.success(`Đã ghép với ${bienThe.maSku}`);
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Không ghép được biến thể"));
        }
      },
      dong.id,
    );

  const statusTabs = LIEN_KET_TABS.map((t) => ({
    value: t.ma,
    label: t.label,
    tone: t.ma === "loi" ? "danger" : t.ma === "ngung-dong-bo" ? "warning" : undefined,
    count: tongQuan
      ? t.ma === "tat-ca"
        ? tongQuan.tongSkuSan
        : t.ma === "dang-dong-bo"
          ? tongQuan.daLienKet
          : t.ma === "ngung-dong-bo"
            ? tongQuan.chuaLienKet
            : tongQuan.loiDongBo
      : null,
  }));

  const doiTab = (moi) => {
    setTab(moi);
    setTrang((cu) => ({ ...cu, page: 0 }));
    setChon(new Set());
  };
  const xoaLoc = () => {
    setSearchText("");
    setTuKhoa("");
    setTrang((cu) => ({ ...cu, page: 0 }));
    setChon(new Set());
  };
  const doiChon = (ids, them) =>
    setChon((cu) => {
      const moi = new Set(cu);
      ids.forEach((id) => (them ? moi.add(id) : moi.delete(id)));
      return moi;
    });
  const trangThaiChon = (ids) => {
    const so = ids.filter((id) => chon.has(id)).length;
    return so === 0 ? false : so === ids.length ? true : "indeterminate";
  };
  const doiGon = (khoaNhom) =>
    setDongGon((cu) => {
      const moi = new Set(cu);
      if (moi.has(khoaNhom)) moi.delete(khoaNhom);
      else moi.add(khoaNhom);
      return moi;
    });

  /** Số lần đẩy tới sẽ gửi lên sàn (khả dụng × quy tắc ở Cấu hình); null khi dòng ngừng hoặc chưa tải quy tắc. */
  const soSeDay = (dong) => (dangDongBo(dong) && quyTac ? tinhSoTonDayLenSan(dong.soLuongKhaDung, quyTac) : null);

  /** Một dòng SKU. `trongNhom`: nằm dưới hàng sản phẩm (chỉ ghi biến thể, thụt vào). */
  const dongSku = (dong, trongNhom) => {
    const meta = LIEN_KET_STATUS[dong.trangThaiLienKet] ?? { label: dong.trangThaiLienKet ? `Không xác định (mã ${dong.trangThaiLienKet})` : "Chưa có trạng thái" };
    const dangXuLyDong = dangChay?.id === dong.id;
    const choPhepBat = dangDongBo(dong) || Boolean(dong.bienTheSanPhamId);
    return (
      <tr
        key={dong.id}
        onClick={() => setChiTietId(dong.id)}
        className={cn("cursor-pointer transition-colors hover:bg-bo-surface-subtle", chon.has(dong.id) && "bg-bo-primary-soft/50")}
      >
        <td className="w-10 px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={chon.has(dong.id)}
            onCheckedChange={(v) => doiChon([dong.id], v === true)}
            aria-label={`Chọn ${dong.maSku || dong.skuSan}`}
            className={CHECKBOX_CLASS}
          />
        </td>
        <td className="max-w-[360px] px-3 py-2.5">
          {trongNhom ? (
            <p className="truncate pl-[30px] text-bo-foreground">{dong.tenBienThe || dong.tenBienTheSan || "—"}</p>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <AnhSanPham src={dong.anhDaiDien} />
              <div className="min-w-0">
                <p className="truncate font-medium text-bo-heading">{dong.tenSanPham || dong.tenSanPhamSan || "—"}</p>
                <p className="truncate text-[13px] text-bo-muted">{dong.tenBienThe || dong.tenBienTheSan || "—"}</p>
              </div>
            </div>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <p className="text-[13.5px] text-bo-foreground">{dong.maSku || "—"}</p>
          <p className="text-[12.5px] tabular-nums text-slate-400">
            {SAN.ten} {dong.skuSan || "—"}
          </p>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-bo-foreground">{soVN(dong.soLuongKhaDung)}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right">
          <OTonDaDay dong={dong} seDay={soSeDay(dong)} />
        </td>
        <td className="px-3 py-2.5">
          <StatusBadge label={meta.label} />
          {dong.trangThaiLienKet === "loi" && dong.chiTietLoi ? (
            <p className="mt-1 max-w-[220px] truncate text-xs text-bo-danger" title={dong.chiTietLoi}>
              {dong.chiTietLoi}
            </p>
          ) : null}
        </td>
        <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
          <Switch
            checked={dangDongBo(dong)}
            disabled={khoa || !choPhepBat}
            onCheckedChange={() => batTat(dong)}
            aria-label={`Đồng bộ ${dong.maSku || dong.skuSan}`}
            title={choPhepBat ? undefined : "Chưa ghép biến thể FCentric"}
            className={SWITCH_CLASS}
          />
        </td>
        <td className="w-12 px-2 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
          <Popover open={ghepId === dong.id} onOpenChange={(mo) => !mo && dangChay?.ten !== "ghep" && setGhepId(null)}>
            <PopoverAnchor asChild>
              <span className="inline-flex">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={khoa}
                      aria-label={`Thao tác khác cho ${dong.maSku || dong.skuSan}`}
                      className="size-8 rounded-md p-0 text-bo-muted hover:bg-slate-100 hover:text-bo-foreground"
                    >
                      {dangXuLyDong && dangChay?.ten !== "bat-tat" ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg"
                    onCloseAutoFocus={(event) => {
                      // Mở ô ghép sau khi menu đóng hẳn, không trả tiêu điểm về nút ⋯ (ô tìm sẽ nhận tiêu điểm)
                      if (moGhepSauMenuRef.current !== dong.id) return;
                      event.preventDefault();
                      moGhepSauMenuRef.current = null;
                      setGhepId(dong.id);
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        moGhepSauMenuRef.current = dong.id;
                      }}
                      className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
                    >
                      Ghép biến thể khác
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setChiTietId(dong.id)} className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                      Xem chi tiết
                    </DropdownMenuItem>
                    {dong.trangThaiLienKet === "loi" ? (
                      <>
                        <DropdownMenuSeparator className="bg-bo-border" />
                        <DropdownMenuItem onSelect={() => thuLai(dong)} className="cursor-pointer rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                          Thử lại
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </PopoverAnchor>
            <PopoverContent
              align="end"
              onFocusOutside={(event) => event.preventDefault()}
              className="w-auto rounded-xl border border-bo-border bg-white p-0 shadow-lg"
            >
              <GhepBienThe
                dong={dong}
                tenSan={SAN.ten}
                dangGhep={dangChay?.ten === "ghep" && dangChay?.id === dong.id}
                onHuy={() => setGhepId(null)}
                onGhep={(bienThe) => ghep(dong, bienThe)}
              />
            </PopoverContent>
          </Popover>
        </td>
      </tr>
    );
  };

  /** Hàng sản phẩm (khi có từ 2 SKU trên trang): mở/đóng, chọn cả nhóm, tổng tồn. */
  const hangNhom = (g) => {
    const ids = g.dong.map((d) => d.id);
    const gon = dongGon.has(g.khoa);
    const soLoi = g.dong.filter((d) => d.trangThaiLienKet === "loi").length;
    const soDangDongBo = g.dong.filter((d) => d.trangThaiLienKet === "da_lien_ket").length;
    const soNgung = g.dong.filter((d) => d.trangThaiLienKet === "chua_lien_ket").length;
    const tongKhaDung = g.dong.reduce((s, d) => s + (Number(d.soLuongKhaDung) || 0), 0);
    const daDay = g.dong.filter((d) => dangDongBo(d) && coSo(d.soLuongDaDay)).map((d) => Number(d.soLuongDaDay));
    return (
      <tr key={g.khoa} className="bg-white">
        <td className="w-10 px-3 py-2.5">
          <Checkbox checked={trangThaiChon(ids)} onCheckedChange={(v) => doiChon(ids, v === true)} aria-label={`Chọn cả ${g.ten}`} className={CHECKBOX_CLASS} />
        </td>
        <td className="max-w-[360px] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => doiGon(g.khoa)}
              aria-expanded={!gon}
              aria-label={gon ? `Mở các phân loại của ${g.ten}` : `Thu gọn các phân loại của ${g.ten}`}
              className="grid size-[22px] shrink-0 place-items-center rounded text-bo-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
            >
              {gon ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            </button>
            <AnhSanPham src={g.anh} />
            <div className="min-w-0">
              <p className="truncate font-medium text-bo-heading">{g.ten}</p>
              <p className="text-[13px] text-bo-muted">{soVN(g.dong.length)} phân loại</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5" />
        <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-bo-heading">{soVN(tongKhaDung)}</td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-bo-heading">
          {daDay.length ? soVN(daDay.reduce((s, v) => s + v, 0)) : "—"}
        </td>
        <td className="px-3 py-2.5">
          {/* Cùng kiểu chấm + chữ với dòng SKU bên dưới, chỉ ghi số theo từng trạng thái */}
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-bo-foreground">
            {soDangDongBo ? <DemTrangThai so={soDangDongBo} nhan="đang đồng bộ" mau="bg-bo-success" /> : null}
            {soNgung ? <DemTrangThai so={soNgung} nhan="ngừng" mau="bg-amber-500" /> : null}
            {soLoi ? <DemTrangThai so={soLoi} nhan="lỗi" mau="bg-bo-danger" className="text-bo-danger" /> : null}
          </span>
        </td>
        <td className="px-3 py-2.5" />
        <td className="px-2 py-2.5" />
      </tr>
    );
  };

  const tatCaIds = rows.map((r) => r.id);

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title={`Sản phẩm ${SAN.ten}`}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={taiTuSan}
              disabled={khoa || !ketNoi}
              className="h-10 gap-2 rounded-lg px-3 text-bo-foreground hover:bg-slate-100"
            >
              {dangChay?.ten === "tai" ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
              Tải từ {SAN.ten}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={khoa || !ketNoi}
                  className="h-10 gap-1.5 rounded-lg px-3 text-bo-foreground hover:bg-slate-100"
                >
                  {dangChay?.ten === "day-len" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Thao tác khác
                  <ChevronDown className="size-4 text-bo-muted" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-max min-w-60 z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg">
                <DropdownMenuItem onSelect={() => setHoiDayLen(true)} className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                  <CloudUpload className="size-4 text-bo-muted" />
                  Đưa sản phẩm FCentric lên {SAN.ten}…
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate(`${SAN.duongDan}/setup?buoc=4`)} className="cursor-pointer gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900">
                  <ListRestart className="size-4 text-bo-muted" />
                  Mở trình thiết lập
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              onClick={dayTonNgay}
              disabled={khoa || !ketNoi || !quyTac}
              title={!quyTac ? (ch.error ? "Chưa tải được quy tắc đẩy tồn" : "Đang tải quy tắc đẩy tồn") : undefined}
              className={NUT_CHINH}
            >
              {dangChay?.ten === "day-ton" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {dangChay?.ten === "day-ton" ? "Đang đẩy tồn…" : "Đẩy tồn ngay"}
            </Button>
          </>
        }
      />

      <MockModeNotice show={isChannelMock} />

      {tab !== "loi" ? (
        <AttentionBar count={tongQuan?.loiDongBo} tone="danger" actionLabel="Xem SKU lỗi" onAction={() => doiTab("loi")}>
          <strong className="font-semibold">{soVN(tongQuan?.loiDongBo)} SKU</strong> đồng bộ lỗi ở lần gần nhất.
        </AttentionBar>
      ) : null}

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={<StatusTabs label="Lọc SKU theo trạng thái đồng bộ" tabs={statusTabs} value={tab} onChange={doiTab} />}
              hasFilter={dangLoc}
              onClear={xoaLoc}
            >
              <SearchInput
                label="Tìm sản phẩm"
                placeholder="Tìm theo tên sản phẩm, SKU hoặc mã Shopify"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onClear={xoaLoc}
                className="sm:w-[360px]"
              />
            </ListToolbar>
            {daChon.length ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-bo-border bg-bo-primary-soft px-3 py-2 text-sm text-bo-heading">
                <span className="mr-1">
                  <strong className="font-semibold tabular-nums">{soVN(daChon.length)}</strong> SKU đã chọn
                </span>
                <Button type="button" variant="outline" disabled={khoa} onClick={() => batTatNhieu(false)} className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle">
                  Ngừng đồng bộ
                </Button>
                <Button type="button" variant="outline" disabled={khoa} onClick={() => batTatNhieu(true)} className="h-8 rounded-lg border-bo-border bg-white px-3 text-[13px] text-bo-foreground hover:bg-bo-surface-subtle">
                  Bật đồng bộ
                </Button>
                {dangChay?.ten === "nhieu" ? <Loader2 className="size-4 animate-spin text-bo-muted" aria-label="Đang cập nhật" /> : null}
                <Button type="button" variant="ghost" disabled={khoa} onClick={() => setChon(new Set())} className="ml-auto h-8 rounded-lg px-3 text-[13px] text-bo-foreground hover:bg-white/70">
                  Bỏ chọn
                </Button>
              </div>
            ) : null}
          </>
        }
        footer={
          !ds.error && tong > 0 ? (
            <TablePagination
              page={trang.page}
              size={trang.size}
              total={tong}
              onPageChange={(page) => {
                if (page < 0) return;
                setTrang((cu) => ({ ...cu, page }));
                setChon(new Set());
              }}
              onSizeChange={(size) => {
                setTrang({ page: 0, size });
                setChon(new Set());
              }}
            />
          ) : null
        }
      >
        {cfg.initialLoading || ds.initialLoading ? (
          <LoadingState label="Đang tải sản phẩm" />
        ) : ds.error || (cfg.error && !cfg.data) ? (
          <ErrorState description="Không tải được danh sách sản phẩm. Vui lòng thử lại." onRetry={taiLaiTatCa} />
        ) : rows.length === 0 ? (
          dangLoc ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy sản phẩm phù hợp"
              description="Thử từ khóa khác hoặc xóa lọc."
              action={
                <Button variant="outline" onClick={xoaLoc} className={NUT_PHU}>
                  Xóa lọc
                </Button>
              }
            />
          ) : tab !== TAB_MAC_DINH ? (
            <EmptyState
              icon={PackageSearch}
              title={`Không có SKU nào ở trạng thái "${LIEN_KET_TABS.find((t) => t.ma === tab)?.label}"`}
              description="Chọn tab Tất cả để xem mọi SKU đã liên kết."
              action={
                <Button variant="outline" onClick={() => doiTab(TAB_MAC_DINH)} className={NUT_PHU}>
                  Xem tất cả
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="Chưa có sản phẩm nào được liên kết"
              description={`Bấm "Tải từ ${SAN.ten}" để ghép theo SKU, hoặc đưa sản phẩm FCentric lên ${SAN.ten} ở "Thao tác khác".`}
            />
          )
        ) : (
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={`${TH} w-10 text-left`}>
                  <Checkbox
                    checked={trangThaiChon(tatCaIds)}
                    onCheckedChange={(v) => doiChon(tatCaIds, v === true)}
                    aria-label="Chọn mọi SKU trên trang"
                    className={CHECKBOX_CLASS}
                  />
                </th>
                <th className={`${TH} text-left`}>Sản phẩm</th>
                <th className={`${TH} text-left`}>SKU FCentric</th>
                <th className={`${TH} text-right`}>Khả dụng</th>
                <th className={`${TH} text-right`} title={`Số ${SAN.ten} đã nhận ở lần đẩy tồn thành công gần nhất`}>
                  Đã đẩy lên {SAN.ten}
                </th>
                <th className={`${TH} text-left`}>Trạng thái</th>
                <th className={`${TH} text-left`}>Đồng bộ</th>
                <th className={`${TH} w-12`}>
                  <span className="sr-only">Thao tác</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f5]">
              {nhom.map((g) =>
                g.dong.length === 1 ? (
                  dongSku(g.dong[0], false)
                ) : (
                  <Fragment key={g.khoa}>
                    {hangNhom(g)}
                    {dongGon.has(g.khoa) ? null : g.dong.map((dong) => dongSku(dong, true))}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        )}
      </TableShell>

      <SyncLogDetailSheet
        lienKet={chiTiet}
        open={Boolean(chiTiet)}
        onOpenChange={(mo) => !mo && setChiTietId(null)}
        quyTac={quyTac}
        tenSan={SAN.ten}
        duongDanCauHinh={`${SAN.duongDan}/settings`}
        dangXuLy={dangChay && dangChay.id === chiTiet?.id ? dangChay.ten : null}
        onThuLai={() => chiTiet && thuLai(chiTiet)}
        onBatTat={() => chiTiet && batTat(chiTiet)}
        onDoiBienThe={() => {
          if (!chiTiet) return;
          const id = chiTiet.id;
          setChiTietId(null);
          // Chờ ngăn chi tiết đóng xong (trả tiêu điểm về dòng) rồi mới mở ô ghép
          window.setTimeout(() => setGhepId(id), 350);
        }}
      />

      <ConfirmModal
        isOpen={hoiDayLen}
        onClose={() => setHoiDayLen(false)}
        onConfirm={dayLenSan}
        isLoading={dangChay?.ten === "day-len"}
        variant="info"
        title={`Đưa sản phẩm lên ${SAN.ten}?`}
        description={`Các sản phẩm đang bán ở FCentric mà ${SAN.ten} chưa có sẽ được tạo mới trên gian hàng thật, kèm ảnh và số tồn. Sản phẩm đã có được cập nhật thương hiệu, loại và thẻ.`}
        confirmText="Đưa lên"
        cancelText="Hủy bỏ"
      />
    </PageContainer>
  );
}
