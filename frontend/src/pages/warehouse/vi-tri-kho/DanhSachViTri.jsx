import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
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
import { mucDay, nhomTrangThaiKe, toneMucDay } from "@/constants/nhapKho";
import { cn } from "@/lib/utils";
import { NUT_CHINH, NUT_PHU, TAB_TRANG_THAI_KE, dinhDangSo, soSanhViTri } from "./kieuNhap";

const khopTab = (viTri, tab) => {
  const t = TAB_TRANG_THAI_KE.find((x) => x.value === tab);
  return !t?.ma || nhomTrangThaiKe(viTri).ma === t.ma;
};

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
}) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const [chonIds, setChonIds] = useState(() => new Set());

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
  const soTrongChon = dsChon.filter((v) => !Number(v.dangChua)).length;

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
      <section className="rounded-lg border border-bo-border bg-white shadow-sm">
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
      {/* Khu vực: cao theo số khu; nhiều khu quá chiều cao màn thì danh sách khu tự cuộn */}
      <section aria-label="Khu vực" className="flex flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm lg:max-h-full">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bo-border px-4 py-3">
          <h2 className="text-sm font-semibold text-bo-heading">Khu vực</h2>
          <span className="text-xs text-bo-muted">{khuVucs.length} khu</span>
        </div>
        <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-2">
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
                        className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-bo-muted hover:bg-white hover:text-bo-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 data-[state=open]:bg-white"
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
              hasFilter={Boolean(tuKhoa.trim())}
              onClear={xoaLoc}
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
            </ListToolbar>
            {/* Thanh thao tác hàng loạt: chỉ hiện khi đã chọn vị trí */}
            {dsChon.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bo-border bg-bo-primary-soft px-4 py-2.5">
                <p className="text-sm text-blue-800">
                  Đã chọn <b className="font-semibold">{dsChon.length}</b> vị trí
                  {coTheSua && soTrongChon < dsChon.length ? ` · ${dsChon.length - soTrongChon} kệ còn hàng` : ""}
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
                        title={soTrongChon ? undefined : "Các kệ đã chọn đều còn hàng"}
                        className="h-8 gap-1.5 border-bo-border bg-white text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
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
          <table className="w-full min-w-[860px] text-sm">
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
                  ["Khu vực", ""],
                  ["Dãy · Hàng · Tầng", ""],
                  ["Đang chứa / sức chứa", "w-[220px]"],
                  ["Trạng thái", "w-[132px]"],
                  ["Thao tác", coTheSua ? "w-[136px] text-center" : "w-[72px] text-center"],
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
                return (
                  <tr
                    key={v.id}
                    onClick={() => onMoSoDo(v)}
                    className={cn("cursor-pointer transition-colors", dangChon ? "bg-bo-primary-soft/60" : "hover:bg-bo-surface-subtle")}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Chọn vị trí ${v.maViTri}`} checked={dangChon} onCheckedChange={() => doiChon(v.id)} className={O_CHON} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] font-semibold leading-5 text-bo-heading">{v.maViTri}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-bo-foreground">{tenKhu.get(v.khuVucId) ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">
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
                      <StatusBadge label={nhom.label} tone={nhom.tone} />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions>
                        <RowActionButton icon={MapPin} label="Xem trên mặt bằng" onClick={() => onXemTrenMatBang({ viTriId: v.id })} />
                        {coTheSua ? (
                          <>
                            <RowActionButton icon={Pencil} label="Sửa vị trí" onClick={() => onSuaViTri(v)} />
                            <RowActionButton
                              icon={Trash2}
                              tone="danger"
                              label={conHang ? `Kệ còn ${v.dangChua} sản phẩm, không xóa được` : "Xóa vị trí"}
                              disabled={conHang}
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
