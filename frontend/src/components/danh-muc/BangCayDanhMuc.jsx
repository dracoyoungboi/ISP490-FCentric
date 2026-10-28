import { useEffect, useRef, useState } from "react";
import { ChevronRight, CornerLeftUp, Pencil, Plus, ScanSearch } from "lucide-react";

import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/utils/formatters";
import { kiemTraChuyen, laConChau, tachChuKhop } from "./cayDanhMuc";
import MenuDanhMuc from "./MenuDanhMuc";

/** Thụt lề mỗi cấp 24px (không cộng dồn); mỗi cấp cha có một đường gióng đi qua giữa nút mở/đóng của nó. */
const LE_TRAI = 12;
const MOI_CAP = 24;
/** Rê bản kéo lên một nhánh đang đóng chừng này thì tự mở nhánh đó. */
const CHO_TU_MO_MS = 700;
const DICH_GOC = "goc";

const COT_CON = "hidden lg:table-column";
const O_CON = "hidden lg:table-cell";
const COT_NGAY = "hidden xl:table-column";
const O_NGAY = "hidden xl:table-cell";

const TIEU_DE =
  "h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

/**
 * Bảng cây danh mục (máy tính và máy tính bảng): mỗi danh mục một dòng 48px, thụt lề đều, có đường gióng.
 * - Bấm dòng có danh mục con (hoặc nút mũi tên) để mở / thu gọn nhánh.
 * - Quản trị viên: nút + (Thêm danh mục con) và Sửa luôn hiện; menu ⋯ có Chuyển đến…, Xem riêng nhánh,
 *   Ngừng hoạt động / Cho hoạt động lại. Kéo một dòng thả vào danh mục khác để chuyển nhánh.
 * - `goc`: nhánh đang xem riêng (null = cả cây). Dải thả cuối bảng chuyển vào nhánh đó hoặc thành danh mục gốc.
 */
export default function BangCayDanhMuc({
  dong,
  cay,
  trangThai,
  tuKhoaChuan,
  goc = null,
  coTheSua,
  layThaoTac,
  onMoDong,
  onThemCon,
  onSua,
  onChuyen,
  onXemNhanh,
  onDoiTrangThai,
  onTha,
  onDangKeo,
}) {
  const [keo, setKeo] = useState(null);
  const [dich, setDich] = useState(null);
  const henMo = useRef({ id: null, hen: null });
  // Dòng đang được rê lên (để hẹn tự mở chỉ chạy khi con trỏ vẫn còn trên dòng đó)
  const dangRe = useRef(null);
  const baoKeo = useRef(onDangKeo);
  useEffect(() => {
    baoKeo.current = onDangKeo;
  }, [onDangKeo]);

  // Bảng bị gỡ giữa lúc kéo (VD đổi bộ lọc): xóa gợi ý kéo thả ở chân bảng
  useEffect(() => () => {
    clearTimeout(henMo.current.hen);
    baoKeo.current?.(null);
  }, []);

  const huyHenMo = () => {
    clearTimeout(henMo.current.hen);
    henMo.current = { id: null, hen: null };
  };

  const ketThucKeo = () => {
    huyHenMo();
    dangRe.current = null;
    setKeo(null);
    setDich(null);
    onDangKeo?.(null);
  };

  const batDauKeo = (event, id) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
    // Đổi giao diện sau khi trình duyệt chụp xong ảnh kéo (đổi ngay có thể làm hủy lần kéo)
    setTimeout(() => {
      setKeo(id);
      onDangKeo?.({ idChuyen: id, idDich: undefined, duoc: false, lyDo: "" });
    }, 0);
  };

  const reLen = (event, idDich) => {
    if (keo == null) return;
    const kq = kiemTraChuyen(cay, keo, idDich, trangThai);
    event.preventDefault();
    event.dataTransfer.dropEffect = kq.duoc ? "move" : "none";
    const khoa = idDich ?? DICH_GOC;
    dangRe.current = khoa;
    if (!dich || dich.khoa !== khoa) {
      setDich({ khoa, ...kq });
      onDangKeo?.({ idChuyen: keo, idDich, ...kq });
    }
  };

  const reLenDong = (event, d) => {
    reLen(event, d.id);
    // Không tự mở chính nhánh đang kéo (bên trong nó không thả vào được)
    const moDuoc = keo != null && d.id !== keo && !laConChau(cay, keo, d.id);
    if (moDuoc && d.coCon && !d.dangMo) {
      if (henMo.current.id === d.id) return;
      huyHenMo();
      henMo.current = {
        id: d.id,
        hen: setTimeout(() => {
          henMo.current = { id: null, hen: null };
          if (dangRe.current === d.id) onMoDong(d.id, true);
        }, CHO_TU_MO_MS),
      };
    } else {
      huyHenMo();
    }
  };

  const tha = (event, idDich) => {
    event.preventDefault();
    const idChuyen = keo;
    ketThucKeo();
    if (idChuyen == null) return;
    const kq = kiemTraChuyen(cay, idChuyen, idDich, trangThai);
    if (kq.duoc) onTha?.({ idChuyen, idDich });
  };

  const nutGoc = goc != null ? cay.theoId.get(goc) : null;
  const dichGoc = goc ?? null;
  const dangReGoc = dich?.khoa === (dichGoc ?? DICH_GOC) && keo != null;

  return (
    <>
      {/* Màn hẹp bớt cột phụ để cột Thao tác luôn nằm trong khung, không phải cuộn ngang:
          dưới 1280px ẩn Ngày tạo, dưới 1024px ẩn Danh mục con (số con vẫn thấy khi mở nhánh). */}
      <table className="w-full min-w-[480px] table-fixed text-sm">
        <colgroup>
          <col />
          <col className="w-[96px] lg:w-[148px]" />
          <col className={cn("w-[132px]", COT_CON)} />
          <col className={cn("w-[128px]", COT_NGAY)} />
          <col className={coTheSua ? "w-[136px]" : "w-[96px]"} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-bo-border bg-bo-surface-subtle">
            <th scope="col" className={TIEU_DE} style={{ paddingLeft: LE_TRAI + MOI_CAP + 8 }}>Danh mục</th>
            <th scope="col" className={TIEU_DE}>Mã</th>
            <th scope="col" className={cn(TIEU_DE, "pr-5 text-right", O_CON)}>Danh mục con</th>
            <th scope="col" className={cn(TIEU_DE, O_NGAY)}>Ngày tạo</th>
            <th scope="col" className={cn(TIEU_DE, "text-center")}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {dong.map((d) => {
            const thaoTac = layThaoTac(d);
            const laDich = keo != null && dich?.khoa === d.id;
            return (
              <DongDanhMuc
                key={d.id}
                d={d}
                thaoTac={thaoTac}
                tuKhoaChuan={tuKhoaChuan}
                coTheSua={coTheSua}
                dangKeo={keo === d.id}
                laDich={laDich}
                dichDuoc={laDich && dich.duoc}
                onMoDong={onMoDong}
                onThemCon={onThemCon}
                onSua={onSua}
                onChuyen={onChuyen}
                onXemNhanh={onXemNhanh}
                onDoiTrangThai={onDoiTrangThai}
                keoProps={
                  coTheSua
                    ? {
                      draggable: true,
                      onDragStart: (event) => batDauKeo(event, d.id),
                      onDragEnd: ketThucKeo,
                      onDragOver: (event) => reLenDong(event, d),
                      onDragLeave: (event) => {
                        // Rời hẳn dòng (không phải đi vào ô con bên trong) thì bỏ hẹn tự mở
                        if (!event.currentTarget.contains(event.relatedTarget) && dangRe.current === d.id) dangRe.current = null;
                      },
                      onDrop: (event) => tha(event, d.id),
                    }
                    : {}
                }
              />
            );
          })}
        </tbody>
      </table>

      {coTheSua && keo != null ? (
        <div
          onDragOver={(event) => {
            huyHenMo();
            reLen(event, dichGoc);
          }}
          onDrop={(event) => tha(event, dichGoc)}
          className="sticky bottom-0 z-10 shrink-0 border-t border-bo-border bg-bo-surface p-2"
        >
          <div
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-md border border-dashed text-sm transition-colors",
              dangReGoc && dich.duoc
                ? "border-bo-primary bg-bo-primary-soft text-bo-primary-hover"
                : "border-slate-300 bg-bo-surface-subtle text-bo-muted",
            )}
          >
            <CornerLeftUp className="size-4" aria-hidden="true" />
            {kiemTraChuyen(cay, keo, dichGoc, trangThai).dangOday
              ? nutGoc
                ? `Đang nằm ngay trong “${nutGoc.ten}”`
                : "Đang là danh mục gốc"
              : nutGoc
                ? `Thả vào đây để chuyển thẳng vào “${nutGoc.ten}”`
                : "Thả vào đây để chuyển thành danh mục gốc"}
          </div>
        </div>
      ) : null}
    </>
  );
}

function DongDanhMuc({
  d,
  thaoTac,
  tuKhoaChuan,
  coTheSua,
  dangKeo,
  laDich,
  dichDuoc,
  onMoDong,
  onThemCon,
  onSua,
  onChuyen,
  onXemNhanh,
  onDoiTrangThai,
  keoProps,
}) {
  const { nut, cap, coCon, dangMo, tt, laNguCanh, soCon } = d;
  const phan = tachChuKhop(nut.ten, tuKhoaChuan);
  const nhat = laNguCanh || tt.ngung;
  const dongPhu = tt.ngung && !tt.tuNgung && tt.doCha
    ? `Ngừng theo “${tt.doCha.ten}”`
    : nut.moTa?.trim() || "";
  const doiMo = () => onMoDong(d.id, !dangMo);

  return (
    <tr
      {...keoProps}
      data-id={d.id}
      onClick={coCon ? doiMo : undefined}
      className={cn(
        "h-12 border-b border-slate-100 transition-colors",
        coCon && "cursor-pointer",
        dangKeo ? "opacity-40" : "hover:bg-bo-surface-subtle",
        laDich && dichDuoc && "bg-bo-primary-soft shadow-[inset_0_0_0_2px_var(--color-bo-primary)] hover:bg-bo-primary-soft",
        laDich && !dichDuoc && "cursor-not-allowed bg-bo-surface-subtle",
      )}
    >
      <td className="relative py-1 pr-3" style={{ paddingLeft: LE_TRAI + cap * MOI_CAP }}>
        {Array.from({ length: cap }, (_, k) => (
          <span
            key={k}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-px bg-bo-border"
            style={{ left: LE_TRAI + k * MOI_CAP + MOI_CAP / 2 }}
          />
        ))}
        <div className="relative flex min-w-0 items-center gap-2">
          {coCon ? (
            <button
              type="button"
              aria-expanded={dangMo}
              aria-label={`${dangMo ? "Thu gọn" : "Mở"} ${nut.ten}`}
              onClick={(event) => {
                event.stopPropagation();
                doiMo();
              }}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-bo-muted hover:bg-slate-200/70 hover:text-bo-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary"
            >
              <ChevronRight className={cn("size-4 transition-transform duration-150", dangMo && "rotate-90")} aria-hidden="true" />
            </button>
          ) : (
            <span aria-hidden="true" className="inline-flex size-6 shrink-0 items-center justify-center">
              <span className="size-[5px] rounded-full bg-slate-300" />
            </span>
          )}
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span
                title={nut.ten}
                className={cn(
                  "truncate",
                  laNguCanh ? "font-normal text-bo-muted" : cap === 0 && d.capThat === 0 ? "font-semibold" : "font-medium",
                  !laNguCanh && (nhat ? "text-bo-muted" : "text-bo-foreground"),
                )}
              >
                {phan.truoc}
                {phan.khop ? <mark className="rounded-[2px] bg-yellow-200 text-inherit">{phan.khop}</mark> : null}
                {phan.sau}
              </span>
              {tt.tuNgung ? <StatusBadge label="Ngừng hoạt động" /> : null}
            </div>
            {dongPhu ? (
              <span title={dongPhu} className="truncate text-xs leading-4 text-bo-muted">{dongPhu}</span>
            ) : null}
          </div>
        </div>
      </td>
      <td className={cn("truncate px-3 font-mono text-xs font-semibold", nhat ? "text-slate-400" : "text-slate-600")} title={nut.ma}>
        {nut.ma || "—"}
      </td>
      <td className={cn("px-3 pr-5 text-right tabular-nums", O_CON, soCon ? (nhat ? "text-slate-400" : "text-bo-foreground") : "text-slate-400")}>
        {soCon || "—"}
      </td>
      <td className={cn("whitespace-nowrap px-3 tabular-nums", O_NGAY, nhat ? "text-slate-400" : "text-slate-600")}>
        {nut.ngayTao ? formatDate(nut.ngayTao) : "—"}
      </td>
      {/* Bấm vào ô thao tác (kể cả nút đang khóa, khoảng trống giữa các nút) không mở / thu gọn dòng */}
      <td className="px-3" onClick={(event) => event.stopPropagation()}>
        {coTheSua ? (
          <RowActions>
            <RowActionButton
              icon={Plus}
              label={thaoTac.themCon.khoa ? `Không thêm được danh mục con: ${thaoTac.themCon.lyDo}` : `Thêm danh mục con vào ${nut.ten}`}
              disabled={thaoTac.themCon.khoa}
              onClick={() => onThemCon(nut)}
            />
            <RowActionButton
              icon={Pencil}
              label={thaoTac.sua.khoa ? `Không sửa được: ${thaoTac.sua.lyDo}` : `Sửa ${nut.ten}`}
              disabled={thaoTac.sua.khoa}
              onClick={() => onSua(nut)}
            />
            <MenuDanhMuc
              thaoTac={thaoTac}
              onChuyen={() => onChuyen(nut)}
              onXemNhanh={() => onXemNhanh(nut.id)}
              onDoiTrangThai={() => onDoiTrangThai(nut, thaoTac.trangThai)}
            />
          </RowActions>
        ) : coCon ? (
          // Người chỉ có quyền xem: không có thao tác sửa, chỉ còn lối xem riêng một nhánh
          <RowActions>
            <RowActionButton icon={ScanSearch} label={`Xem riêng nhánh ${nut.ten}`} onClick={() => onXemNhanh(nut.id)} />
          </RowActions>
        ) : null}
      </td>
    </tr>
  );
}
