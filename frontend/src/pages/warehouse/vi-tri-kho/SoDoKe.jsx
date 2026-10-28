import { useMemo, useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import ChuGiaiMucDay from "@/components/mat-bang/ChuGiaiMucDay";
import { nhomTheoDay } from "@/components/mat-bang/matBang";
import { DaiO, ThanhMuc } from "@/components/nhap-kho/ThanhBuoc";
import { mucDay, nhomTrangThaiKe, toneMucDay } from "@/constants/nhapKho";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { cn } from "@/lib/utils";
import { viTriKhoService } from "@/services/viTriKhoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { NhomChon } from "./KhungHop";
import { NUT_CHINH, NUT_PHU, dinhDangSo } from "./kieuNhap";

/**
 * Sơ đồ kệ của một khu: mỗi dãy là một khung, mỗi cột là một hàng kệ, tầng cao nhất ở trên.
 * Bấm một ô để xem lô đang nằm trên kệ; quản lý chuyển được vị trí sang bảo trì / mở lại.
 */
export default function SoDoKe({
  khoId,
  khuVucs,
  viTris,
  khuId,
  viTriId,
  onChon,
  coTheSua,
  onThemViTri,
  onCapNhatViTri,
  onSuaViTri,
  onXoaViTri,
  onXemTrenMatBang,
}) {
  const khu = khuVucs.find((k) => k.id === khuId) ?? khuVucs.find((k) => viTris.some((v) => v.khuVucId === k.id)) ?? khuVucs[0];
  const viTriKhu = useMemo(() => viTris.filter((v) => v.khuVucId === khu?.id), [viTris, khu]);
  const days = useMemo(() => nhomTheoDay(viTriKhu), [viTriKhu]);
  const chon = viTriKhu.find((v) => v.id === viTriId) ?? viTriKhu[0] ?? null;

  if (!khu) return null;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface px-3 py-2.5 shadow-sm sm:px-4">
        <NhomChon
          nhan="Khu vực"
          value={khu.id}
          onChange={(id) => onChon({ khuId: id, viTriId: null })}
          luaChon={khuVucs.map((k) => ({ ma: k.id, ten: k.tenKhuVuc }))}
        />
        <ChuGiaiMucDay />
      </section>

      {!viTriKhu.length ? (
        <section className="rounded-lg border border-bo-border bg-bo-surface shadow-sm">
          <EmptyState
            title={`${khu.tenKhuVuc} chưa có vị trí kệ`}
            description="Thêm vị trí để thấy sơ đồ dãy, hàng và tầng của khu."
            action={
              coTheSua ? (
                <Button onClick={() => onThemViTri(khu.id)} className={cn("gap-1.5", NUT_CHINH)}>
                  <Plus className="size-4" />
                  Thêm vị trí kệ
                </Button>
              ) : null
            }
          />
        </section>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-4">
            {days.map(({ day, hangs, tangs, tim }) => (
              <section key={day} className="rounded-lg border border-bo-border bg-bo-surface shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-bo-border px-4 py-3">
                  <h2 className="text-sm font-semibold text-bo-heading">
                    Dãy {day} · {khu.tenKhuVuc}
                  </h2>
                  <span className="text-xs text-bo-muted">
                    {hangs.length} hàng × {tangs.length} tầng · tầng cao nhất ở trên
                  </span>
                </div>
                <div className="overflow-x-auto p-4">
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${hangs.length}, minmax(116px, 1fr))` }}>
                    {hangs.map((hang) => (
                      <div key={hang} className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-center text-xs font-semibold text-bo-muted">Hàng {hang}</span>
                        {tangs.map((tang) => (
                          <OKe key={tang} viTri={tim(hang, tang)} chon={chon} onChon={(v) => onChon({ khuId: khu.id, viTriId: v.id })} />
                        ))}
                        <span aria-hidden="true" className="mt-0.5 h-1.5 rounded-sm bg-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>

          {chon ? (
            <ChiTietViTri
              key={chon.id}
              khoId={khoId}
              khu={khu}
              viTri={chon}
              coTheSua={coTheSua}
              onCapNhatViTri={onCapNhatViTri}
              onSuaViTri={onSuaViTri}
              onXoaViTri={onXoaViTri}
              onXemTrenMatBang={onXemTrenMatBang}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function OKe({ viTri, chon, onChon }) {
  if (!viTri) return <span aria-hidden="true" className="h-[60px] rounded-md border border-dashed border-transparent" />;
  const baoTri = viTri.trangThai === "BAO_TRI";
  const muc = mucDay(viTri.dangChua, viTri.sucChua);
  const dangChon = chon?.id === viTri.id;
  return (
    <button
      type="button"
      aria-pressed={dangChon}
      onClick={() => onChon(viTri)}
      aria-label={`Vị trí ${viTri.maViTri}, ${baoTri ? "bảo trì" : `${viTri.dangChua ?? 0} trên ${viTri.sucChua ?? 0}`}`}
      className={cn(
        "flex h-[60px] min-w-0 flex-col justify-between gap-1.5 rounded-md border bg-bo-surface px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30",
        baoTri ? "border-dashed border-slate-300 bg-bo-surface-subtle" : "border-bo-border hover:border-slate-400",
        dangChon && "border-bo-primary ring-2 ring-bo-primary/25 hover:border-bo-primary",
      )}
    >
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate font-mono text-xs font-semibold text-bo-heading">{viTri.maViTri}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-bo-muted">
          {baoTri ? "Bảo trì" : `${dinhDangSo(viTri.dangChua)}/${dinhDangSo(viTri.sucChua)}`}
        </span>
      </span>
      {baoTri ? (
        <span className="text-[11px] text-bo-muted">Không nhận hàng</span>
      ) : (
        <ThanhMuc phanTram={muc * 100} tone={toneMucDay(muc)} />
      )}
    </button>
  );
}

function ChiTietViTri({ khoId, khu, viTri, coTheSua, onCapNhatViTri, onSuaViTri, onXoaViTri, onXemTrenMatBang }) {
  const nhom = nhomTrangThaiKe(viTri);
  const muc = mucDay(viTri.dangChua, viTri.sucChua);
  const conTrong = Math.max(0, Number(viTri.sucChua || 0) - Number(viTri.dangChua || 0));
  const [dangDoi, setDangDoi] = useState(false);
  const lo = useTaiDuLieu(() => viTriKhoService.loTrenKe(khoId, viTri.id), `${khoId}-${viTri.id}`);
  const dsLo = lo.data ?? [];
  const baoTri = viTri.trangThai === "BAO_TRI";

  const doiTrangThai = async () => {
    const trangThai = baoTri ? "HOAT_DONG" : "BAO_TRI";
    setDangDoi(true);
    try {
      await onCapNhatViTri(viTri, { trangThai });
      toast.success(baoTri ? `Đã mở lại ${viTri.maViTri}` : `Đã chuyển ${viTri.maViTri} sang bảo trì`, {
        description: !baoTri && Number(viTri.dangChua) > 0 ? "Kệ ngừng nhận hàng mới; hàng đang có vẫn giữ nguyên." : undefined,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không đổi được trạng thái vị trí."));
    } finally {
      setDangDoi(false);
    }
  };

  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm xl:sticky xl:top-4">
      <div className="border-b border-bo-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-mono text-base font-semibold text-bo-heading">{viTri.maViTri}</h2>
          <StatusBadge label={nhom.label} />
        </div>
        <p className="mt-0.5 text-xs text-bo-muted">
          {khu.tenKhuVuc} · Dãy {viTri.day} · Hàng {viTri.hang} · Tầng {viTri.tang}
        </p>
      </div>
      <DaiO soO={2} phang className="border-b border-bo-border sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 bg-bo-surface px-4 py-3">
          <span className="text-xs font-medium text-bo-muted">Đang chứa</span>
          <span className="text-lg font-semibold tabular-nums text-bo-heading">
            {dinhDangSo(viTri.dangChua)}
            <span className="text-sm font-normal text-bo-muted"> / {dinhDangSo(viTri.sucChua)}</span>
          </span>
          <ThanhMuc phanTram={muc * 100} tone={toneMucDay(muc)} />
        </div>
        <div className="flex flex-col gap-1.5 bg-bo-surface px-4 py-3">
          <span className="text-xs font-medium text-bo-muted">Còn trống</span>
          <span className="text-lg font-semibold tabular-nums text-bo-heading">{baoTri ? "—" : dinhDangSo(conTrong)}</span>
          <span className="text-xs text-bo-muted">{baoTri ? "Đang bảo trì" : "sản phẩm"}</span>
        </div>
      </DaiO>
      <div className="flex min-h-[160px] flex-col gap-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">Lô trên kệ{lo.loading ? "" : ` · ${dsLo.length}`}</p>
        {lo.initialLoading ? (
          <div className="flex flex-1 items-center justify-center text-bo-muted">
            <Loader2 className="size-4 animate-spin" aria-label="Đang tải lô trên kệ" />
          </div>
        ) : lo.error ? (
          <p className="text-[13px] text-bo-danger">Không tải được lô trên kệ.</p>
        ) : dsLo.length ? (
          <ul className="divide-y divide-bo-border">
            {dsLo.map((l) => (
              <li key={`${l.maLo}-${l.tenBienThe}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[13px] font-semibold text-bo-heading">{l.maLo}</span>
                  <span className="block truncate text-xs text-bo-muted">{l.tenBienThe}</span>
                </span>
                <b className="shrink-0 text-sm tabular-nums text-bo-heading">{dinhDangSo(l.soLuong)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-bo-muted">Kệ đang trống.</p>
        )}
      </div>
      <div className={cn("mt-auto grid gap-2 border-t border-bo-border bg-bo-surface-subtle p-3", coTheSua && "grid-cols-2")}>
        <Button variant="outline" onClick={() => onXemTrenMatBang({ viTriId: viTri.id })} className={cn("h-9 gap-1.5", NUT_PHU)}>
          <MapPin className="size-4" />
          Trên mặt bằng
        </Button>
        {coTheSua ? (
          <Button variant="outline" onClick={doiTrangThai} disabled={dangDoi} className={cn("h-9 gap-1.5", NUT_PHU)}>
            {dangDoi ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {baoTri ? "Mở lại hoạt động" : "Chuyển sang bảo trì"}
          </Button>
        ) : null}
        {coTheSua ? (
          <>
            <Button variant="outline" onClick={() => onSuaViTri(viTri)} className={cn("h-9 gap-1.5", NUT_PHU)}>
              <Pencil className="size-4" />
              Sửa vị trí
            </Button>
            <Button
              variant="outline"
              onClick={() => onXoaViTri(viTri)}
              disabled={Number(viTri.dangChua) > 0 || Number(viTri.choNhap) > 0 || Number(viTri.soLoChoNhap) > 0}
              title={
                Number(viTri.dangChua) > 0
                  ? "Kệ còn hàng, chuyển hàng đi trước khi xóa"
                  : Number(viTri.choNhap) > 0 || Number(viTri.soLoChoNhap) > 0
                    ? "Kệ đang gắn lô đã khóa của phiếu nhập chưa nhập kho"
                    : undefined
              }
              className="h-9 gap-1.5 border-bo-border bg-bo-surface text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
            >
              <Trash2 className="size-4" />
              Xóa vị trí
            </Button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
