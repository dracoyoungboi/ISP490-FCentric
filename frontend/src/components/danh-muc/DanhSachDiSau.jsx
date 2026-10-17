import { ArrowLeft, ChevronRight } from "lucide-react";

import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { demConHien, layDongCap, layDuongDan, tachChuKhop, timPhang } from "./cayDanhMuc";
import MenuDanhMuc from "./MenuDanhMuc";

/**
 * Bản điện thoại (< 640px): không thụt lề. Bấm một danh mục có danh mục con để vào cấp con;
 * đường dẫn dạng chip và nút quay lại ở trên. Tìm kiếm hiện danh sách phẳng kèm đường dẫn.
 * Thao tác nằm trong menu ⋯ (nút 44px).
 */
export default function DanhSachDiSau({
  cay,
  trangThai,
  cha,
  loc,
  tuKhoa,
  tuKhoaChuan,
  coTheSua,
  layThaoTac,
  onVao,
  onThemCon,
  onSua,
  onChuyen,
  onDoiTrangThai,
  trong,
}) {
  const dangTim = Boolean(tuKhoaChuan);
  const duongDan = cha != null ? layDuongDan(cay, cha) : [];
  const dong = dangTim
    ? timPhang(cay, tuKhoa, { loc, trangThai }).map((k) => ({
      id: k.id,
      nut: k.nut,
      tt: k.tt,
      soCon: demConHien(cay, trangThai, k.id, loc),
      duongDan: k.duongDan,
    }))
    : layDongCap(cay, trangThai, cha, loc);

  return (
    <div className="flex flex-col">
      {!dangTim && duongDan.length ? (
        <nav aria-label="Cấp đang xem" className="flex items-center gap-1 border-b border-bo-border bg-bo-surface-subtle py-1.5 pl-1 pr-3">
          <button
            type="button"
            aria-label="Quay lại cấp trên"
            onClick={() => onVao(duongDan.length > 1 ? duongDan[duongDan.length - 2].id : null)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-bo-foreground hover:bg-slate-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <ol className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
            <li className="shrink-0">
              <Chip onClick={() => onVao(null)}>Tất cả</Chip>
            </li>
            {duongDan.map((n, i) => (
              <li key={n.id} className="flex shrink-0 items-center gap-1.5">
                <ChevronRight className="size-3.5 text-slate-400" aria-hidden="true" />
                {i === duongDan.length - 1 ? (
                  <Chip hienTai>{n.ten}</Chip>
                ) : (
                  <Chip onClick={() => onVao(n.id)}>{n.ten}</Chip>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {dong.length === 0 ? trong : (
        <ul className="divide-y divide-slate-100">
          {dong.map((d) => (
            <MucDienThoai
              key={d.id}
              cay={cay}
              d={d}
              dangTim={dangTim}
              tuKhoaChuan={tuKhoaChuan}
              coTheSua={coTheSua}
              thaoTac={layThaoTac({ id: d.id, nut: d.nut, tt: d.tt, coCon: d.soCon > 0 })}
              onVao={onVao}
              onThemCon={onThemCon}
              onSua={onSua}
              onChuyen={onChuyen}
              onDoiTrangThai={onDoiTrangThai}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ children, onClick, hienTai = false }) {
  if (hienTai) {
    return (
      <span aria-current="page" className="inline-flex h-8 max-w-[180px] items-center truncate rounded-full bg-slate-100 px-2.5 text-[13px] font-medium text-bo-foreground">
        <span className="truncate">{children}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 max-w-[160px] items-center rounded-full border border-bo-border bg-white px-2.5 text-[13px] font-medium text-bo-primary hover:bg-bo-primary-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
    >
      <span className="truncate">{children}</span>
    </button>
  );
}

function MucDienThoai({ cay, d, dangTim, tuKhoaChuan, coTheSua, thaoTac, onVao, onThemCon, onSua, onChuyen, onDoiTrangThai }) {
  const { nut, tt, soCon } = d;
  const phan = tachChuKhop(nut.ten, tuKhoaChuan);
  const duongDanCha = layDuongDan(cay, d.id).slice(0, -1).map((n) => n.ten).join(" › ");
  const vaoDuoc = soCon > 0;
  const dongPhu = tt.ngung && !tt.tuNgung && tt.doCha
    ? `Ngừng theo “${tt.doCha.ten}”`
    : [nut.ma, soCon ? `${soCon} danh mục con` : ""].filter(Boolean).join(" · ");

  const noiDung = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {dangTim && d.duongDan?.length ? (
          <span className="truncate text-xs leading-4 text-bo-muted">{d.duongDan.join(" › ")}</span>
        ) : null}
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-medium", tt.ngung ? "text-bo-muted" : "text-bo-foreground")}>
            {phan.truoc}
            {phan.khop ? <mark className="rounded-[2px] bg-yellow-200 text-inherit">{phan.khop}</mark> : null}
            {phan.sau}
          </span>
          {tt.tuNgung ? <StatusBadge label="Ngừng hoạt động" /> : null}
        </span>
        {dongPhu ? <span className="truncate text-xs leading-4 text-bo-muted">{dongPhu}</span> : null}
      </span>
      {vaoDuoc ? <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" /> : null}
    </>
  );

  return (
    <li className="flex min-h-16 items-center gap-1 pr-1">
      {vaoDuoc ? (
        <button
          type="button"
          onClick={() => onVao(d.id)}
          aria-label={`${nut.ten}, ${soCon} danh mục con. Mở cấp con`}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 pl-4 pr-1 text-left text-sm hover:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
        >
          {noiDung}
        </button>
      ) : (
        <div className="flex min-h-16 min-w-0 flex-1 items-center gap-2 py-2 pl-4 pr-1 text-sm">{noiDung}</div>
      )}
      {coTheSua ? (
        <MenuDanhMuc
          thaoTac={{ ...thaoTac, xemNhanh: null }}
          kieu="dien-thoai"
          phu={duongDanCha}
          onThemCon={() => onThemCon(nut)}
          onSua={() => onSua(nut)}
          onChuyen={() => onChuyen(nut)}
          onDoiTrangThai={() => onDoiTrangThai(nut, thaoTac.trangThai)}
        />
      ) : null}
    </li>
  );
}
