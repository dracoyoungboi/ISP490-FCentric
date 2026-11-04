import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { SettingsFieldHint, SettingsPill, SettingsTextButton } from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { THUE_SUAT } from "@/components/ke-toan/tinhKeToan";
import { TOI_DA_DONG, formDong, idTuNgay, khoangNgay, sapXep, trangThaiDong } from "./vatLich";

const SELECT_CLASS = "h-9 w-full min-w-0 rounded-md border border-[#8a96a6] bg-white px-2 text-sm text-bo-foreground hover:border-bo-muted focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 focus-visible:outline-none disabled:opacity-60";
const SELECT_LOI = "border-bo-danger hover:border-bo-danger focus-visible:border-bo-danger focus-visible:ring-bo-danger/15";

// Bố cục hàng sửa theo độ rộng khung danh sách (container query), không theo màn hình: trong app còn thanh bên và menu
// Cấu hình nên cùng một màn hình rộng mà khung có thể rất hẹp. Hẹp thì xếp hai cột và hiện nhãn từng ô.
const KIEU = {
  chung: {
    luoi: "grid grid-cols-2 gap-2 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem_2.25rem] @lg:items-end",
    nhan: "mb-1 block text-xs text-bo-muted @lg:sr-only",
    tieuDe: "hidden @lg:grid",
  },
  rieng: {
    luoi: "grid grid-cols-2 gap-2 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem_2.25rem] @2xl:items-end",
    nhan: "mb-1 block text-xs text-bo-muted @2xl:sr-only",
    tieuDe: "hidden @2xl:grid",
  },
};

/** Một dòng khi xem: khoảng ngày + ghi chú nhỏ bên dưới, nhãn trạng thái, thuế suất. */
function DongXem({ t, homNay }) {
  const tt = trangThaiDong(t, homNay);
  return (
    <li className={cn("flex min-h-12 items-center gap-3 px-3.5 py-2", tt === "qua" ? "text-bo-muted" : "text-bo-foreground")}>
      <span className="min-w-0 flex-1">
        <span className="tabular-nums">
          {t.danhMucId ? <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-px text-xs text-slate-700">{t.tenDanhMuc ?? `Danh mục #${t.danhMucId}`}</span> : null}
          {khoangNgay(t)}
        </span>
        {t.ghiChu ? <span className={cn("mt-0.5 block text-xs leading-4", tt === "qua" ? "text-bo-muted" : "text-[#5b6676]")}>{t.ghiChu}</span> : null}
      </span>
      {tt === "hien" ? <SettingsPill tone="info">Hiện hành</SettingsPill> : null}
      {tt === "toi" ? <SettingsPill tone="off">Sắp tới</SettingsPill> : null}
      {tt === "qua" ? <span className="text-xs">Đã qua</span> : null}
      <span className="w-11 shrink-0 text-right font-semibold tabular-nums">{Number(t.tyLe)}%</span>
    </li>
  );
}

const NHOM_RIENG = "Theo danh mục · chỉ dùng khi xuất kế toán, hóa đơn vẫn in mức chung";

/** Lịch thuế suất khi xem (bảng đã lưu). */
export function LichThueSuatXem({ thueSuat, homNay }) {
  const { chung, rieng } = sapXep(thueSuat);
  return (
    <>
      <ul className="m-0 list-none divide-y divide-[#eef1f5] rounded-md border border-bo-border p-0 text-sm">
        {chung.length ? chung.map((t) => <DongXem key={t.id} t={t} homNay={homNay} />) : (
          <li className="flex min-h-12 items-center gap-3 px-3.5 py-2">
            <span className="min-w-0 flex-1 text-[#5b6676]">Chưa có mức chung</span>
            <SettingsPill tone="warn">Chưa đặt</SettingsPill>
          </li>
        )}
      </ul>
      {rieng.length ? (
        <>
          <p className="mt-3.5 mb-1.5 text-[12.5px] leading-5 text-[#5b6676]">{NHOM_RIENG}</p>
          <ul className="m-0 list-none divide-y divide-[#eef1f5] rounded-md border border-bo-border p-0 text-sm">
            {rieng.map((t) => <DongXem key={t.id} t={t} homNay={homNay} />)}
          </ul>
        </>
      ) : null}
    </>
  );
}

/** Ngày liền sau (yyyy-MM-dd), để gợi ý ngày bắt đầu mốc mới ngay sau mốc cuối. */
function ngaySau(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function DongSua({ d, so, loi, danhMuc, disabled, onDoi, onBo }) {
  const kieu = d.rieng ? KIEU.rieng : KIEU.chung;
  const ten = `dòng ${so}`;
  const idLoi = loi ? `ts-loi-${d.khoa}` : undefined;
  const o = (khoa) => `ts-${khoa}-${d.khoa}`;
  const doi = (khoa) => (e) => onDoi(d.khoa, khoa, e.target.value);
  const chung = { disabled, "aria-invalid": loi ? true : undefined, "aria-describedby": idLoi };
  // Danh mục của dòng chưa có trong danh sách (danh sách chưa tải xong, hoặc danh mục đã xóa): vẫn hiện đúng tên
  const thieuDanhMuc = d.rieng && d.danhMucId && !danhMuc.some((m) => String(m.id) === d.danhMucId);
  return (
    <li className="px-3 py-2.5">
      <div className={kieu.luoi}>
        {d.rieng ? (
          <div className="col-span-2 min-w-0 @2xl:col-span-1">
            <label htmlFor={o("dm")} className={kieu.nhan}>Danh mục</label>
            <select id={o("dm")} value={d.danhMucId} onChange={doi("danhMucId")} {...chung} aria-label={`Danh mục, ${ten}`}
              className={cn(SELECT_CLASS, loi && !d.danhMucId && SELECT_LOI)}>
              <option value="">Chọn danh mục</option>
              {thieuDanhMuc ? <option value={d.danhMucId}>{d.tenDanhMuc ?? `Danh mục #${d.danhMucId}`}</option> : null}
              {danhMuc.map((m) => <option key={m.id} value={String(m.id)}>{m.ten}</option>)}
            </select>
          </div>
        ) : null}
        <div className="min-w-0">
          <label htmlFor={o("tu")} className={kieu.nhan}>Từ ngày</label>
          <Input id={idTuNgay(d.khoa)} type="date" value={d.hieuLucTu} onChange={doi("hieuLucTu")} {...chung}
            aria-label={`Từ ngày, ${ten}`} className={settingsInputClass({ error: Boolean(loi), className: "tabular-nums" })} />
        </div>
        <div className="min-w-0">
          <label htmlFor={o("den")} className={kieu.nhan}>Đến ngày</label>
          <Input id={o("den")} type="date" value={d.hieuLucDen} onChange={doi("hieuLucDen")} {...chung}
            aria-label={`Đến ngày, ${ten}`} className={settingsInputClass({ error: Boolean(loi), className: "tabular-nums" })} />
        </div>
        <div className="min-w-0">
          <label htmlFor={o("ts")} className={kieu.nhan}>Thuế suất</label>
          <select id={o("ts")} value={d.tyLe} onChange={doi("tyLe")} {...chung} aria-label={`Thuế suất, ${ten}`}
            className={cn(SELECT_CLASS, loi && d.tyLe === "" && SELECT_LOI)}>
            <option value="">Chọn</option>
            {THUE_SUAT.map((t) => <option key={t} value={String(t)}>{t}%</option>)}
          </select>
        </div>
        <button type="button" onClick={() => onBo(d.khoa)} disabled={disabled} aria-label={`Bỏ ${ten}`}
          className="relative flex size-9 items-center justify-center self-end justify-self-end rounded-md text-bo-muted before:absolute before:-inset-1 before:content-[''] hover:bg-bo-danger-soft hover:text-bo-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bo-primary disabled:opacity-40">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2">
        <label htmlFor={o("ghi")} className={kieu.nhan}>Căn cứ / ghi chú (không bắt buộc)<span className="sr-only">, {ten}</span></label>
        <Input id={o("ghi")} value={d.ghiChu} onChange={doi("ghiChu")} disabled={disabled} maxLength={255}
          placeholder="Căn cứ / ghi chú, vd. NQ 204/2025/QH15" className={settingsInputClass()} />
      </div>
      {loi ? <SettingsFieldHint id={idLoi} className="mt-1.5" error={loi} /> : null}
    </li>
  );
}

function TieuDeCot({ rieng }) {
  const kieu = rieng ? KIEU.rieng : KIEU.chung;
  return (
    // Lưới trước, "hidden" sau: tailwind-merge giữ lớp hiển thị đứng sau, nên tiêu đề cột ẩn khi khung hẹp
    <div className={cn(kieu.luoi, kieu.tieuDe, "px-3 pb-1.5 text-xs text-bo-muted")} aria-hidden="true">
      {rieng ? <span>Danh mục</span> : null}
      <span>Từ ngày</span>
      <span>Đến ngày</span>
      <span>Thuế suất</span>
      <span />
    </div>
  );
}

/**
 * Lịch thuế suất khi sửa: cả bảng sửa tại chỗ, lưu một lần cùng công tắc In thuế (trang cha). bang: các dòng formDong;
 * loi: { [khoa]: câu lỗi }; danhMuc: danh mục phẳng cho ô chọn (phangDanhMuc); onThemDong(khoa): đưa con trỏ tới dòng mới.
 */
export function LichThueSuatSua({ bang, loi, danhMuc, disabled, onDoiBang, onThemDong }) {
  const chung = bang.filter((d) => !d.rieng);
  const rieng = bang.filter((d) => d.rieng);
  const day = bang.length >= TOI_DA_DONG;
  const soDong = (d) => bang.indexOf(d) + 1;
  const doi = (khoa, truong, giaTri) => onDoiBang((ds) => ds.map((d) => (d.khoa === khoa ? { ...d, [truong]: giaTri } : d)));
  const bo = (khoa) => onDoiBang((ds) => ds.filter((d) => d.khoa !== khoa));
  const themMoc = () => {
    const cuoi = [...chung].sort((a, b) => a.hieuLucTu.localeCompare(b.hieuLucTu)).at(-1);
    const moi = formDong(null, false);
    if (cuoi?.hieuLucDen) moi.hieuLucTu = ngaySau(cuoi.hieuLucDen);
    // Mốc mới đứng cuối nhóm mức chung (trước các dòng theo danh mục)
    onDoiBang((ds) => [...ds.filter((d) => !d.rieng), moi, ...ds.filter((d) => d.rieng)]);
    onThemDong?.(moi.khoa);
  };
  const themRieng = () => {
    const moi = formDong(null, true);
    onDoiBang((ds) => [...ds, moi]);
    onThemDong?.(moi.khoa);
  };
  const props = { danhMuc, disabled, onDoi: doi, onBo: bo };
  return (
    <div className="@container">
      <TieuDeCot />
      <ul className="m-0 list-none divide-y divide-[#eef1f5] rounded-md border border-bo-border p-0 text-sm">
        {chung.map((d) => <DongSua key={d.khoa} {...props} d={d} so={soDong(d)} loi={loi[d.khoa]} />)}
        {!chung.length ? <li className="px-3.5 py-3 text-[#5b6676]">Chưa có mức chung: hóa đơn sẽ không in thuế.</li> : null}
      </ul>
      {/* Chưa có dòng theo danh mục: hai nút chung một hàng ngay dưới lịch; có rồi thì mỗi nút dưới nhóm của nó */}
      <div className="mt-1.5 -ml-2.5 flex flex-wrap gap-x-3">
        <SettingsTextButton className="mr-0" onClick={themMoc} disabled={disabled || day}>
          <Plus className="size-[15px]" aria-hidden="true" />Thêm mốc
        </SettingsTextButton>
        {rieng.length ? null : (
          <SettingsTextButton className="mr-0" onClick={themRieng} disabled={disabled || day}>
            <Plus className="size-[15px]" aria-hidden="true" />Thêm thuế riêng cho danh mục
          </SettingsTextButton>
        )}
      </div>

      {rieng.length ? (
        <>
          <p className="mt-3 mb-1.5 text-[12.5px] leading-5 text-[#5b6676]">{NHOM_RIENG}</p>
          <TieuDeCot rieng />
          <ul className="m-0 list-none divide-y divide-[#eef1f5] rounded-md border border-bo-border p-0 text-sm">
            {rieng.map((d) => <DongSua key={d.khoa} {...props} d={d} so={soDong(d)} loi={loi[d.khoa]} />)}
          </ul>
          <SettingsTextButton className="mt-1.5 -ml-2.5" onClick={themRieng} disabled={disabled || day}>
            <Plus className="size-[15px]" aria-hidden="true" />Thêm thuế riêng cho danh mục
          </SettingsTextButton>
        </>
      ) : null}
      <p className="mt-1.5 mb-0 text-xs leading-5 text-[#5b6676]">
        Để trống Đến ngày khi chưa có ngày kết thúc.{day ? ` Tối đa ${TOI_DA_DONG} dòng.` : ""}
      </p>
    </div>
  );
}
