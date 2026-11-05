import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  History,
  Layers,
  Map as MapIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  SearchX,
  Trash2,
  X,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListToolbar from "@/components/shared/ListToolbar";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThanhMuc } from "@/components/nhap-kho/ThanhBuoc";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { useIsMobile } from "@/hooks/use-mobile";
import { mucDay, nhomTrangThaiKe, toneMucDay } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import { NUT_CHINH, NUT_PHU, TAB_TRANG_THAI_KE, dinhDangSo, soSanhViTri } from "./kieuNhap";

const khopTab = (viTri, tab) => {
  const t = TAB_TRANG_THAI_KE.find((x) => x.value === tab);
  return !t?.ma || nhomTrangThaiKe(viTri).ma === t.ma;
};

/** Kệ còn hàng / đang chờ nhập thì không xóa được: câu lý do (chú thích nút xóa); xóa được thì null. */
function lyDoKhongXoa(v) {
  if (Number(v.dangChua) > 0) return `Kệ còn ${v.dangChua} sản phẩm, không xóa được`;
  if (Number(v.choNhap) > 0) return `Kệ đang chờ nhập ${v.choNhap} sản phẩm, không xóa được`;
  if (Number(v.soLoChoNhap) > 0) return `Kệ đang gắn ${v.soLoChoNhap} lô đã khóa của phiếu nhập, không xóa được`;
  return null;
}

const O_CHON = "border-slate-300 data-[state=checked]:border-bo-primary data-[state=checked]:bg-bo-primary data-[state=checked]:text-white data-[state=indeterminate]:border-bo-primary data-[state=indeterminate]:bg-bo-primary data-[state=indeterminate]:text-white";
const MENU = "backoffice-user-menu z-50 min-w-[180px] rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const MUC_MENU = "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/**
 * Vị trí kệ — PA1 "Danh sách theo khu" (màn chính FO-094).
 * - Bên trái: danh sách khu (cao theo nội dung, dính khi cuộn); nút ⋯ mỗi khu để sửa / xóa khu.
 * - Bên phải: bảng vị trí có tab trạng thái; chọn nhiều dòng để in tem, chuyển khu hoặc xóa hàng loạt.
 * Bấm một dòng mở Sơ đồ kệ tại vị trí đó; nút ghim mở hộp "Vị trí này nằm ở đâu?".
 */
export default function DanhSachViTri({
  khuVucs,
  viTris,
  khuId,
  onChonKhu,
  tab,
  onDoiTab,
  coTheSua,
  onThemKhu,
  onSuaKhu,
  onXoaKhu,
  onThemViTri,
  onSuaViTri,
  onXoaViTri,
  onInTem,
  onChuyenKhu,
  onXoaNhieu,
  onMoSoDo,
  onXemTrenMatBang,
  // Có thì hiện "Lịch sử thay đổi" của khu vực / vị trí (trang chỉ truyền cho quản trị viên, quản lý kho)
  onLichSuKhu,
  onLichSuViTri,
}) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const [chonIds, setChonIds] = useState(() => new Set());
  // Điện thoại: cột Khu vực bên trái ẩn đi, chọn khu bằng ô lọc "Khu vực" trong sheet Bộ lọc (chip dưới ô tìm)
  const laDienThoai = useIsMobile();

  const tenKhu = useMemo(() => new Map(khuVucs.map((k) => [k.id, k.tenKhuVuc])), [khuVucs]);
  const soTheoKhu = useMemo(() => {
    const m = new Map();
    for (const v of viTris) m.set(v.khuVucId, (m.get(v.khuVucId) ?? 0) + 1);
    return m;
  }, [viTris]);

  const daLoc = useMemo(() => {
    const q = tuKhoa.trim().toUpperCase();
    return viTris
      .filter((v) => (!khuId || v.khuVucId === khuId) && (!q || String(v.maViTri).toUpperCase().includes(q)))
      .sort((a, b) =>
        a.khuVucId === b.khuVucId
          ? soSanhViTri(a, b)
          : String(tenKhu.get(a.khuVucId)).localeCompare(String(tenKhu.get(b.khuVucId)), "vi"),
      );
  }, [viTris, khuId, tuKhoa, tenKhu]);
  const hienThi = useMemo(() => daLoc.filter((v) => khopTab(v, tab)), [daLoc, tab]);
  const tabs = TAB_TRANG_THAI_KE.map((t) => ({ ...t, count: daLoc.filter((v) => khopTab(v, t.value)).length }));

  const tongTrang = Math.max(1, Math.ceil(hienThi.length / soDong));
  const trangAnToan = Math.min(trang, tongTrang - 1);
  const dongTrang = hienThi.slice(trangAnToan * soDong, (trangAnToan + 1) * soDong);

  // Vị trí đã chọn (giữ qua các trang); bỏ những vị trí vừa bị xóa khỏi dữ liệu
  const dsChon = useMemo(() => viTris.filter((v) => chonIds.has(v.id)), [viTris, chonIds]);
  const soChonTrang = dongTrang.filter((v) => chonIds.has(v.id)).length;
  const chonCaTrang = dongTrang.length > 0 && soChonTrang === dongTrang.length;
  const boChon = () => setChonIds(new Set());
  const doiChon = (id) =>
    setChonIds((cu) => {
      const moi = new Set(cu);
      if (moi.has(id)) moi.delete(id);
      else moi.add(id);
      return moi;
    });
  const doiChonTrang = () =>
    setChonIds((cu) => {
      const moi = new Set(cu);
      for (const v of dongTrang) {
        if (chonCaTrang) moi.delete(v.id);
        else moi.add(v.id);
      }
      return moi;
    });
  const soTrongChon = dsChon.filter((v) => !Number(v.dangChua) && !Number(v.choNhap) && !Number(v.soLoChoNhap)).length;

  const doiTab = (t) => {
    onDoiTab(t);
    setTrang(0);
  };
  const doiKhu = (id) => {
    onChonKhu(id);
    setTrang(0);
  };
  const xoaLoc = () => {
    setTuKhoa("");
    setTrang(0);
  };
  // Thao tác hàng loạt xong (trả về true) thì bỏ chọn
  const chayHangLoat = async (fn) => {
    const xong = await fn(dsChon);
    if (xong) boChon();
  };

  if (!khuVucs.length) {
    return (
      <section className="rounded-lg border border-bo-border bg-bo-surface shadow-sm">
        <EmptyState
          icon={Layers}
          title="Kho này chưa có khu vực"
          description="Tạo khu vực trước (VD Khu A – Áo), sau đó thêm vị trí kệ trong khu."
          action={
            coTheSua ? (
              <Button onClick={onThemKhu} className={cn("gap-1.5", NUT_CHINH)}>
                <Plus className="size-4" />
                Thêm khu vực
              </Button>
            ) : null
          }
        />
      </section>
    );
  }

  return (
    // bo-fill-grid: khung bảng giãn tới đáy màn, thân bảng tự cuộn, phân trang luôn ở đáy (như các trang danh sách khác)
    <div className="bo-fill-grid grid items-start gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Khu vực: cao theo số khu; nhiều khu quá chiều cao màn thì danh sách khu tự cuộn.
          Điện thoại: ẩn (chọn khu ở ô lọc Khu vực). Máy tính bảng dọc (cảm ứng): khu xếp 3 cột, dòng cao 44px */}
      <section aria-label="Khu vực" className="flex flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm lg:max-h-full max-md:hidden">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bo-border px-4 py-3">
          <h2 className="text-sm font-semibold text-bo-heading">Khu vực</h2>
          <span className="text-xs text-bo-muted">{khuVucs.length} khu</span>
        </div>
        <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-2 cam-ung:max-lg:grid cam-ung:max-lg:grid-cols-3 cam-ung:max-lg:gap-x-2">
          {[{ id: null, tenKhuVuc: "Tất cả khu vực", so: viTris.length }, ...khuVucs.map((k) => ({ ...k, so: soTheoKhu.get(k.id) ?? 0 }))].map((k) => {
            const chon = (khuId ?? null) === k.id;
            return (
              <div
                key={k.id ?? "tat-ca"}
                className={cn(
                  "group/khu flex h-9 items-center rounded-md transition-colors",
                  chon ? "bg-bo-primary-soft" : "hover:bg-bo-surface-subtle",
                )}
              >
                <button
                  type="button"
                  aria-pressed={chon}
                  onClick={() => doiKhu(k.id)}
                  className={cn(
                    "flex h-full min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
                    chon ? "font-medium text-bo-primary" : "text-bo-foreground",
                  )}
                >
                  <span className="truncate">{k.tenKhuVuc}</span>
                  <span className={cn("shrink-0 text-xs tabular-nums", chon ? "text-bo-primary" : "text-bo-muted")}>{dinhDangSo(k.so)}</span>
                </button>
                {coTheSua && k.id != null ? (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Thao tác với ${k.tenKhuVuc}`}
                        className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-bo-surface hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:bg-bo-surface"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className={MENU}>
                      <DropdownMenuItem onClick={() => onSuaKhu(k)} className={MUC_MENU}>
                        <Pencil className="size-4 text-bo-muted" />
                        Sửa khu vực
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onXemTrenMatBang({ khuVucId: k.id })} className={MUC_MENU}>
                        <MapIcon className="size-4 text-bo-muted" />
                        Xem trên mặt bằng
                      </DropdownMenuItem>
                      {onLichSuKhu ? (
                        <DropdownMenuItem onClick={() => onLichSuKhu(k)} className={MUC_MENU}>
                          <History className="size-4 text-bo-muted" />
                          Lịch sử thay đổi
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => onXoaKhu(k)} className={cn(MUC_MENU, "text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger")}>
                        <Trash2 className="size-4" />
                        Xóa khu vực
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-bo-border p-3">
          <Button variant="outline" onClick={() => onXemTrenMatBang({ khuVucId: khuId ?? null })} className={cn("h-9 w-full gap-1.5", NUT_PHU)}>
            <MapIcon className="size-4" />
            {khuId ? "Xem khu trên mặt bằng" : "Xem mặt bằng kho"}
          </Button>
        </div>
      </section>

      <TableShell
        fill
        toolbar={
          <>
            <ListToolbar
              tabs={<StatusTabs label="Lọc vị trí theo trạng thái" tabs={tabs} value={tab} onChange={doiTab} />}
              hasFilter={Boolean(tuKhoa.trim()) || (laDienThoai && Boolean(khuId))}
              // Điện thoại: khu là một ô lọc nên "Xóa lọc" bỏ cả khu đang chọn
              onClear={laDienThoai ? () => { xoaLoc(); doiKhu(null); } : xoaLoc}
            >
              <SearchInput
                label="Tìm mã vị trí"
                placeholder="Tìm mã vị trí, VD: A-01"
                value={tuKhoa}
                onChange={(e) => {
                  setTuKhoa(e.target.value);
                  setTrang(0);
                }}
                onClear={xoaLoc}
                className="sm:w-[280px]"
              />
              {laDienThoai ? (
                <FilterSelect
                  label="Khu vực"
                  value={khuId ? String(khuId) : ""}
                  options={[
                    { value: "", label: `Tất cả khu vực · ${dinhDangSo(viTris.length)}` },
                    ...khuVucs.map((k) => ({ value: String(k.id), label: `${k.tenKhuVuc} · ${dinhDangSo(soTheoKhu.get(k.id) ?? 0)}` })),
                  ]}
                  onChange={(v) => doiKhu(v ? Number(v) : null)}
                />
              ) : null}
            </ListToolbar>
            {/* Điện thoại: đang xem một khu thì thao tác của khu (thay nút ⋯ ở cột Khu vực) nằm ngay dưới thanh lọc;
                Xóa khu vực ở trong hộp Sửa khu vực */}
            {laDienThoai && khuId ? (
              <div className={cn("grid gap-2 border-b border-bo-border px-3 py-2.5", coTheSua && (onLichSuKhu ? "grid-cols-[1fr_1fr_auto]" : "grid-cols-2"))}>
                <Button variant="outline" onClick={() => onXemTrenMatBang({ khuVucId: khuId })} className={cn("h-9 gap-1.5 px-3", NUT_PHU)}>
                  <MapIcon className="size-4" />
                  Mặt bằng khu
                </Button>
                {coTheSua ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const khu = khuVucs.find((k) => k.id === khuId);
                      if (khu) onSuaKhu(khu);
                    }}
                    className={cn("h-9 gap-1.5 px-3", NUT_PHU)}
                  >
                    <Pencil className="size-4" />
                    Sửa khu vực
                  </Button>
                ) : null}
                {coTheSua && onLichSuKhu ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const khu = khuVucs.find((k) => k.id === khuId);
                      if (khu) onLichSuKhu(khu);
                    }}
                    // 375px: hai nút chữ đã chiếm gần hết hàng, nút Lịch sử chỉ còn biểu tượng (có nhãn đọc màn hình)
                    aria-label="Lịch sử khu vực"
                    title="Lịch sử khu vực"
                    className={cn("size-9 px-0", NUT_PHU)}
                  >
                    <History className="size-4" />
                  </Button>
                ) : null}
              </div>
            ) : null}
            {/* Thanh thao tác hàng loạt: chỉ hiện khi đã chọn vị trí */}
            {dsChon.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bo-border bg-bo-primary-soft px-4 py-2.5">
                <p className="text-sm text-blue-800">
                  Đã chọn <b className="font-semibold">{dsChon.length}</b> vị trí
                  {coTheSua && soTrongChon < dsChon.length ? ` · ${dsChon.length - soTrongChon} kệ còn hàng hoặc đang chờ nhập` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={boChon}
                    className="inline-flex items-center gap-1 px-1 text-sm font-medium text-bo-primary hover:text-bo-primary-hover"
                  >
                    <X className="size-4" />
                    Bỏ chọn
                  </button>
                  <Button variant="outline" onClick={() => onInTem(dsChon)} className={cn("h-8 gap-1.5", NUT_PHU)}>
                    <Printer className="size-4" />
                    In tem
                  </Button>
                  {coTheSua ? (
                    <>
                      <Button variant="outline" onClick={() => chayHangLoat(onChuyenKhu)} className={cn("h-8 gap-1.5", NUT_PHU)}>
                        <ArrowRightLeft className="size-4" />
                        Chuyển khu
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => chayHangLoat(onXoaNhieu)}
                        disabled={!soTrongChon}
                        title={soTrongChon ? undefined : "Các kệ đã chọn đều còn hàng hoặc đang chờ nhập"}
                        className="h-8 gap-1.5 border-bo-border bg-bo-surface text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                      >
                        <Trash2 className="size-4" />
                        Xóa {soTrongChon ? `${soTrongChon} kệ trống` : ""}
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        }
        footer={
          dongTrang.length ? (
            <TablePagination
              page={trangAnToan}
              size={soDong}
              total={hienThi.length}
              onPageChange={(p) => p >= 0 && p < tongTrang && setTrang(p)}
              onSizeChange={(s) => {
                setSoDong(s);
                setTrang(0);
              }}
            />
          ) : null
        }
      >
        {dongTrang.length ? (
          <>
          {/* Điện thoại: mỗi vị trí một thẻ — ô chọn (in tem, chuyển khu, xóa hàng loạt) bên trái, chạm thẻ mở Sơ đồ kệ,
              ⋯ bên phải: Xem trên mặt bằng, Sửa, Xóa */}
          <ul className="divide-y divide-bo-border md:hidden">
            {dongTrang.map((v) => {
              const nhom = nhomTrangThaiKe(v);
              const muc = mucDay(v.dangChua, v.sucChua);
              const dangChon = chonIds.has(v.id);
              const lyDo = lyDoKhongXoa(v);
              return (
                <li key={v.id} className={cn("flex items-stretch", dangChon && "bg-bo-primary-soft/60")}>
                  <label className="grid w-12 shrink-0 cursor-pointer place-items-center">
                    <Checkbox aria-label={`Chọn vị trí ${v.maViTri}`} checked={dangChon} onCheckedChange={() => doiChon(v.id)} className={cn("size-5", O_CHON)} />
                  </label>
                  <button type="button" onClick={() => onMoSoDo(v)} className="grid min-w-0 flex-1 gap-1 py-3 text-left active:bg-bo-surface-subtle">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate font-mono text-[15px] font-semibold text-bo-heading">{v.maViTri}</span>
                      <StatusBadge label={nhom.label} />
                    </span>
                    <span className="truncate text-[13px] text-bo-muted">
                      Dãy {v.day} · Hàng {v.hang} · Tầng {v.tang} · {tenKhu.get(v.khuVucId) ?? "—"}
                    </span>
                    {nhom.ma === "BAO_TRI" ? (
                      <span className="text-[13px] text-bo-muted">Không nhận hàng · sức chứa {dinhDangSo(v.sucChua)}</span>
                    ) : (
                      <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                        <ThanhMuc phanTram={muc * 100} tone={toneMucDay(muc)} label={`Đang chứa ${v.dangChua ?? 0} trên ${v.sucChua ?? 0}`} />
                        <span className="text-right text-[13px] tabular-nums text-slate-600">
                          {dinhDangSo(v.dangChua)}/{dinhDangSo(v.sucChua)}
                        </span>
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-start px-1 pt-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Thao tác với ${v.maViTri}`}
                          className="grid size-9 place-items-center rounded-md text-bo-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:bg-bo-surface-subtle"
                        >
                          <MoreHorizontal className="size-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={MENU}>
                        <DropdownMenuItem onClick={() => onXemTrenMatBang({ viTriId: v.id })} className={cn(MUC_MENU, "py-2.5")}>
                          <MapPin className="size-4 text-bo-muted" />
                          Xem trên mặt bằng
                        </DropdownMenuItem>
                        {coTheSua ? (
                          <>
                            <DropdownMenuItem onClick={() => onSuaViTri(v)} className={cn(MUC_MENU, "py-2.5")}>
                              <Pencil className="size-4 text-bo-muted" />
                              Sửa vị trí
                            </DropdownMenuItem>
                            {onLichSuViTri ? (
                              <DropdownMenuItem onClick={() => onLichSuViTri(v)} className={cn(MUC_MENU, "py-2.5")}>
                                <History className="size-4 text-bo-muted" />
                                Lịch sử thay đổi
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              disabled={Boolean(lyDo)}
                              onClick={() => onXoaViTri(v)}
                              className={cn(MUC_MENU, "items-start py-2.5 text-bo-danger focus:bg-bo-danger-soft focus:text-bo-danger")}
                            >
                              <Trash2 className="mt-0.5 size-4" />
                              <span className="flex min-w-0 flex-col gap-0.5">
                                Xóa vị trí
                                {lyDo ? <span className="max-w-[220px] text-xs leading-4 text-bo-muted">{lyDo}</span> : null}
                              </span>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
          {/* Máy tính bảng dọc (cảm ứng): bỏ cột Khu vực, Dãy · Hàng · Tầng (thành dòng phụ dưới mã vị trí),
              thu hẹp cột mức đầy, nút thao tác 40px để bảng vừa khung, không vuốt ngang */}
          <table className="w-full min-w-[860px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className="h-10 w-11 px-3 text-center">
                  <Checkbox
                    aria-label="Chọn tất cả vị trí trong trang"
                    checked={chonCaTrang ? true : soChonTrang ? "indeterminate" : false}
                    onCheckedChange={doiChonTrang}
                    className={O_CHON}
                  />
                </th>
                {[
                  ["Mã vị trí", ""],
                  ["Khu vực", "cam-ung:max-lg:hidden"],
                  ["Dãy · Hàng · Tầng", "cam-ung:max-lg:hidden"],
                  ["Đang chứa / sức chứa", "w-[220px] cam-ung:max-lg:w-[168px]"],
                  ["Trạng thái", "w-[132px] cam-ung:max-lg:w-[112px]"],
                  ["Thao tác", coTheSua ? "w-[164px] text-center cam-ung:max-lg:w-[184px]" : "w-[72px] text-center"],
                ].map(([h, c]) => (
                  <th key={h} className={cn("h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted", c)}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {dongTrang.map((v) => {
                const nhom = nhomTrangThaiKe(v);
                const muc = mucDay(v.dangChua, v.sucChua);
                const dangChon = chonIds.has(v.id);
                const conHang = Number(v.dangChua) > 0;
                const choNhap = Number(v.choNhap) > 0 || Number(v.soLoChoNhap) > 0;
                return (
                  <tr
                    key={v.id}
                    onClick={() => onMoSoDo(v)}
                    className={cn("cursor-pointer transition-colors", dangChon ? "bg-bo-primary-soft/60" : "hover:bg-bo-surface-subtle")}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Chọn vị trí ${v.maViTri}`} checked={dangChon} onCheckedChange={() => doiChon(v.id)} className={O_CHON} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] font-semibold leading-5 text-bo-heading">
                      {v.maViTri}
                      <span className="hidden max-w-[220px] truncate font-sans text-xs font-normal text-bo-muted cam-ung:max-lg:block">
                        {tenKhu.get(v.khuVucId) ?? "—"} · {v.day} · {v.hang} · {v.tang}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-bo-foreground cam-ung:max-lg:hidden">{tenKhu.get(v.khuVucId) ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600 cam-ung:max-lg:hidden">
                      {v.day} · {v.hang} · {v.tang}
                    </td>
                    <td className="px-3 py-3">
                      {nhom.ma === "BAO_TRI" ? (
                        <span className="text-[13px] text-bo-muted">Không nhận hàng · sức chứa {dinhDangSo(v.sucChua)}</span>
                      ) : (
                        <div className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3">
                          <ThanhMuc phanTram={muc * 100} tone={toneMucDay(muc)} label={`Đang chứa ${v.dangChua ?? 0} trên ${v.sucChua ?? 0}`} />
                          <span className="text-right text-[13px] tabular-nums text-slate-600">
                            {dinhDangSo(v.dangChua)}/{dinhDangSo(v.sucChua)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusBadge label={nhom.label} />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions>
                        <RowActionButton icon={MapPin} label="Xem trên mặt bằng" onClick={() => onXemTrenMatBang({ viTriId: v.id })} />
                        {coTheSua ? (
                          <>
                            <RowActionButton icon={Pencil} label="Sửa vị trí" onClick={() => onSuaViTri(v)} />
                            {onLichSuViTri ? (
                              <RowActionButton icon={History} label={`Lịch sử vị trí ${v.maViTri}`} onClick={() => onLichSuViTri(v)} />
                            ) : null}
                            <RowActionButton
                              icon={Trash2}
                              tone="danger"
                              label={lyDoKhongXoa(v) ?? "Xóa vị trí"}
                              disabled={conHang || choNhap}
                              onClick={() => onXoaViTri(v)}
                            />
                          </>
                        ) : null}
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </>
        ) : !viTris.length || (khuId && !soTheoKhu.get(khuId)) ? (
          <EmptyState
            icon={Layers}
            title={khuId ? "Khu này chưa có vị trí kệ" : "Kho này chưa có vị trí kệ"}
            description="Thêm từng vị trí hoặc tạo hàng loạt theo khoảng hàng × tầng."
            action={
              coTheSua ? (
                <Button onClick={() => onThemViTri(khuId)} className={cn("gap-1.5", NUT_CHINH)}>
                  <Plus className="size-4" />
                  Thêm vị trí kệ
                </Button>
              ) : null
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Không có vị trí kệ nào khớp bộ lọc"
            description={tuKhoa.trim() ? "Thử đổi từ khóa tìm kiếm." : "Chọn tab Tất cả để xem mọi vị trí trong khu."}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  xoaLoc();
                  doiTab("tat-ca");
                }}
                className={NUT_PHU}
              >
                Xóa lọc
              </Button>
            }
          />
        )}
      </TableShell>
    </div>
  );
}
