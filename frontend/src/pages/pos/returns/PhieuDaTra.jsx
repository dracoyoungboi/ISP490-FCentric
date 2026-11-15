import { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { traHangService } from '@/services/traHangService';
import { getApiErrorMessage } from '@/utils/apiError';
import LoadingState from '@/components/shared/LoadingState';
import { formatMoney } from '../pos-format';
import { usePosDuLieuChung } from '../pos-du-lieu-chung';
import { nhanLuc } from './nhan-thoi-gian';
import { HOAN_TIEN_MAT } from './tra-hang';
import { NutTaiLai } from './TheDanhSach';
import { KHOANG, MOC_KY, khoangCuaLoc, loiKhoang, ngayIso, nhanKhoang, nhanKhoangNgan } from './loc-phieu-tra';
import { t, tDuLieu } from "@/i18n";

const oNhap = 'h-8 rounded-lg border border-bo-border bg-bo-surface text-[13px] outline-none transition placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15';
const mucMenu = 'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-none';
const th = 'border-b border-bo-border px-3 py-2.5 font-semibold';
const td = 'border-b border-bo-border/70 px-3 py-2.5';
const ngayVn = (iso) => iso.split('-').reverse().join('/');

/**
 * Nút kỳ của thẻ Phiếu đã trả, cùng kiểu nút kỳ ở các báo cáo: luôn ghi rõ ngày đang xem ("7 ngày qua 10/11 – 16/11").
 * Bấm mở danh sách mốc, mỗi mốc có ngày ở dòng phụ; cuối danh sách là "Chọn khoảng ngày…" mở hai ô ngày ngay trong
 * khung, bấm Áp dụng mới đổi (ngày gõ dở không gọi máy chủ, bảng không bị đẩy xuống).
 */
function NutKy({ loc, bayGio, onDoiLoc }) {
  const [mo, setMo] = useState(false);
  // Khoảng đang gõ trong khung; null = đang ở danh sách mốc
  const [nhap, setNhap] = useState(null);
  const khoang = khoangCuaLoc(loc, bayGio);
  const moc = MOC_KY.find((x) => x.ma === loc.moc);
  const homNay = ngayIso(new Date(bayGio));
  const loi = nhap ? loiKhoang(nhap, bayGio) : '';
  const nhanNut = moc ? `${t(moc.nhan)} ${nhanKhoangNgan(khoang)}` : nhanKhoang(khoang);

  const doiMo = (m) => {
    setMo(m);
    if (!m) setNhap(null);
  };
  const chonMoc = (ma) => {
    onDoiLoc({ moc: ma });
    doiMo(false);
  };
  const apDung = () => {
    if (loi) return;
    onDoiLoc({ moc: KHOANG, khoang: nhap });
    doiMo(false);
  };

  return (
    <Popover onOpenChange={doiMo} open={mo}>
      <PopoverTrigger asChild>
        <button
          aria-label={t("Chọn kỳ, đang xem: {{nhanMoc}}", { nhanMoc: nhanNut })}
          className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border bg-bo-surface px-2.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30 ${mo ? 'border-bo-primary ring-2 ring-bo-primary/15' : 'border-bo-border hover:bg-bo-surface-subtle'}`}
          type="button"
        >
          <CalendarDays aria-hidden="true" className="size-4 text-bo-muted" />
          {moc ? (
            <>
              <span className="font-semibold text-bo-foreground">{t(moc.nhan)}</span>
              <span className="tabular-nums text-bo-muted">{nhanKhoangNgan(khoang)}</span>
            </>
          ) : <span className="font-semibold tabular-nums text-bo-foreground">{nhanKhoang(khoang)}</span>}
          <ChevronDown aria-hidden="true" className="size-3.5 text-bo-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-xl border-bo-border bg-white p-1.5 text-bo-foreground shadow-lg" sideOffset={6}>
        <ul aria-label={t("Chọn kỳ")} className="space-y-0.5">
          {MOC_KY.map((x) => {
            const dangChon = loc.moc === x.ma;
            return (
              <li key={x.ma}>
                <button aria-pressed={dangChon} className={mucMenu} onClick={() => chonMoc(x.ma)} type="button">
                  <span className="min-w-0 flex-1">
                    <span className={`block ${dangChon ? 'font-medium text-bo-primary-hover' : ''}`}>{t(x.nhan)}</span>
                    <span className="block text-xs tabular-nums text-bo-muted">{nhanKhoang(khoangCuaLoc({ moc: x.ma }, bayGio))}</span>
                  </span>
                  {dangChon ? <Check aria-hidden="true" className="size-4 shrink-0 text-bo-primary" /> : <span className="size-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="my-1 h-px bg-bo-border" />
        {nhap ? (
          <form className="space-y-2 px-2.5 pb-1.5 pt-1" noValidate onSubmit={(e) => { e.preventDefault(); apDung(); }}>
            <p className="text-[13px] font-medium">{t("Chọn khoảng ngày")}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1 text-xs text-bo-muted" htmlFor="phieu-tra-tu-ngay">
                <span className="block">{t("Từ ngày")}</span>
                <input aria-describedby="phieu-tra-loi-ngay" aria-invalid={loi ? true : undefined} className={`${oNhap} w-full px-2 text-bo-foreground`} id="phieu-tra-tu-ngay" max={nhap.denNgay || homNay} min="2000-01-01" onChange={(e) => setNhap({ ...nhap, tuNgay: e.target.value })} type="date" value={nhap.tuNgay} />
              </label>
              <label className="space-y-1 text-xs text-bo-muted" htmlFor="phieu-tra-den-ngay">
                <span className="block">{t("Đến ngày")}</span>
                <input aria-describedby="phieu-tra-loi-ngay" aria-invalid={loi ? true : undefined} className={`${oNhap} w-full px-2 text-bo-foreground`} id="phieu-tra-den-ngay" max={homNay} min={nhap.tuNgay || '2000-01-01'} onChange={(e) => setNhap({ ...nhap, denNgay: e.target.value })} type="date" value={nhap.denNgay} />
              </label>
            </div>
            <p className={`text-xs ${loi ? 'text-bo-danger' : 'text-bo-muted'}`} id="phieu-tra-loi-ngay" role={loi ? 'alert' : undefined}>{loi || t("Xem tối đa 1 năm.")}</p>
            <div className="flex justify-end gap-2 pt-0.5">
              <button className="h-8 rounded-lg border border-bo-border px-3 text-[13px] font-medium transition hover:bg-bo-surface-subtle" onClick={() => setNhap(null)} type="button">{t("Hủy")}</button>
              <button className="h-8 rounded-lg bg-bo-primary px-3 text-[13px] font-semibold text-white transition hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(loi)} type="submit">{t("Áp dụng")}</button>
            </div>
          </form>
        ) : (
          <button aria-pressed={loc.moc === KHOANG} className={mucMenu} onClick={() => setNhap(loc.khoang)} type="button">
            <span className="min-w-0 flex-1">
              <span className={`block ${loc.moc === KHOANG ? 'font-medium text-bo-primary-hover' : ''}`}>{t("Chọn khoảng ngày…")}</span>
              {loc.moc === KHOANG ? <span className="block text-xs tabular-nums text-bo-muted">{nhanKhoang(loc.khoang)}</span> : null}
            </span>
            {loc.moc === KHOANG
              ? <Check aria-hidden="true" className="size-4 shrink-0 text-bo-primary" />
              : <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-bo-muted" />}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Ô lọc theo khách / số điện thoại / mã hóa đơn: gõ xong 0,4 giây (hoặc Enter) mới gọi máy chủ, để không tải lại theo
 * từng chữ. Máy chủ lọc nên vẫn thấy phiếu nằm ngoài 200 dòng đang hiện.
 */
function OLoc({ giaTri, onDoi }) {
  const [chu, setChu] = useState(giaTri);
  useEffect(() => {
    if (chu.trim() === giaTri) return undefined;
    const hen = setTimeout(() => onDoi(chu.trim()), 400);
    return () => clearTimeout(hen);
  }, [chu, giaTri, onDoi]);
  return (
    <form className="relative min-w-0 max-w-sm flex-1 basis-56" onSubmit={(e) => { e.preventDefault(); onDoi(chu.trim()); }} role="search">
      <label className="sr-only" htmlFor="phieu-tra-loc">{t("Lọc phiếu trả")}</label>
      <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-bo-muted" size={14} />
      <input
        autoComplete="off"
        className={`${oNhap} w-full pl-8 pr-8`}
        id="phieu-tra-loc"
        onChange={(e) => setChu(e.target.value)}
        placeholder={t("Tên khách, số điện thoại, mã hóa đơn")}
        value={chu}
      />
      {chu ? (
        <button
          aria-label={t("Xóa lọc")}
          className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-bo-muted hover:bg-bo-surface-subtle hover:text-bo-foreground"
          onClick={() => { setChu(''); onDoi(''); }}
          title={t("Xóa lọc")}
          type="button"
        >
          <X aria-hidden="true" size={14} />
        </button>
      ) : null}
    </form>
  );
}

/**
 * Thẻ "Phiếu đã trả": phiếu trả NHẬN tại cửa hàng đang chọn (nơi chi tiền hoàn), mới nhất trước, kèm dòng tổng tiền
 * mặt / chuyển khoản để đối soát. Bấm một dòng thì khung Phiếu trả bên phải hiện lại phiếu (chỉ xem, in lại).
 * Bộ lọc do trang giữ ({@code loc}: mốc, khoảng tự chọn, chữ lọc) để mở rồi đóng một hóa đơn không đặt lại.
 */
export default function PhieuDaTra({ khoId, tenKho, bayGio, loc, onDoiLoc, chonId, onChon, dauThe }) {
  const { moc, q } = loc;
  // Mốc tính theo đồng hồ của trang: qua nửa đêm thì "Hôm nay" ra ngày mới, khóa đổi nên tự tải lại
  const { tuNgay, denNgay } = khoangCuaLoc(loc, bayGio);
  const [lanTai, setLanTai] = useState(0);
  const pham = `${khoId}|${tuNgay}~${denNgay}|${q}`;
  const khoa = `${pham}|${lanTai}`;
  // Cùng cách giữ bản cũ với Hóa đơn còn hạn trả: quay lại thẻ này thì hiện ngay danh sách lần trước trong lúc tải
  const { boNho } = usePosDuLieuChung();
  const khoaNho = `phieuDaTra|${pham}`;
  const [ketQua, setKetQua] = useState({ pham: null, khoa: null, loi: null, data: null });
  const dangTai = ketQua.khoa !== khoa;
  const banNho = dangTai ? boNho.lay(khoaNho) : undefined;
  // Trong lúc tải chỉ giữ danh sách của đúng cửa hàng / kỳ / chữ lọc này (bấm Tải lại): số tổng là số thu ngân đối
  // soát, không để số của cửa hàng hay kỳ khác hiện tạm
  const data = banNho !== undefined ? banNho : (ketQua.pham === pham ? ketQua.data : null);
  const loi = dangTai ? null : ketQua.loi;

  useEffect(() => {
    if (!khoId) return undefined;
    const controller = new AbortController();
    traHangService.lichSu(khoId, { tuNgay, denNgay, q: q || undefined }, { signal: controller.signal })
      .then((d) => {
        setKetQua({ pham, khoa, loi: null, data: d });
        boNho.ghi(khoaNho, d);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setKetQua({ pham, khoa, loi: getApiErrorMessage(err, t("Không tải được danh sách phiếu trả.")), data: null });
      });
    return () => controller.abort();
  }, [khoId, tuNgay, denNgay, q, pham, khoa, khoaNho, boNho]);

  const ds = data?.phieu ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-bo-border px-4 pt-1.5">{dauThe}</div>
      {/* Một hàng lọc: kỳ, chữ lọc, tải lại */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3">
        <NutKy bayGio={bayGio} loc={loc} onDoiLoc={onDoiLoc} />
        <OLoc giaTri={q} onDoi={(chu) => onDoiLoc({ q: chu })} />
        <NutTaiLai dangTai={dangTai} onBam={() => setLanTai((n) => n + 1)} />
      </div>

      {dangTai && !data ? (
        <div className="flex min-h-40 flex-1 items-center justify-center"><LoadingState label={t("Đang tải danh sách phiếu trả")} /></div>
      ) : loi ? (
        <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-bo-muted">
          <p>{loi}</p>
          <button className="text-sm font-medium text-bo-primary hover:underline" onClick={() => setLanTai((n) => n + 1)} type="button">{t("Thử lại")}</button>
        </div>
      ) : !ds.length ? (
        <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
          <p className="text-sm font-medium">
            {q ? t("Không có phiếu trả nào khớp “{{q}}”", { q })
              : moc === 'hom-nay' ? t("Hôm nay cửa hàng chưa nhận trả phiếu nào")
                : t("Cửa hàng chưa nhận trả phiếu nào từ {{tu}} đến {{den}}", { tu: ngayVn(tuNgay), den: ngayVn(denNgay) })}
          </p>
          <p className="max-w-sm text-[13px] text-bo-muted">{t("Chọn kỳ khác, hoặc gõ mã phiếu RET ở ô phía trên.")}</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-3">
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-bo-border text-[13px]">
              <thead className="sticky top-0 z-[1] bg-bo-surface-subtle text-xs text-bo-muted">
                <tr>
                  <th className={`${th} text-left`} scope="col">{t("Mã phiếu")}</th>
                  <th className={`${th} text-left`} scope="col">{t("Lúc trả")}</th>
                  <th className={`${th} hidden text-left xl:table-cell`} scope="col">{t("Hóa đơn gốc")}</th>
                  <th className={`${th} text-left`} scope="col">{t("Khách hàng")}</th>
                  <th className={`${th} text-right`} scope="col">{t("SL")}</th>
                  <th className={`${th} text-right`} scope="col">{t("Tiền hoàn")}</th>
                  <th className={`${th} hidden text-left xl:table-cell`} scope="col">{t("Người lập")}</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((p) => {
                  const dangChon = p.id === chonId;
                  const soLuong = Number(p.tongSoLuong) || 0;
                  const soLoi = Number(p.soLuongLoi) || 0;
                  return (
                    <tr className={`group cursor-pointer ${dangChon ? 'bg-blue-50/70' : 'hover:bg-bo-surface-subtle'}`} key={p.id} onClick={() => onChon(p.id)}>
                      <td className={`${td} whitespace-nowrap ${dangChon ? 'shadow-[inset_3px_0_0_var(--color-bo-primary)]' : ''}`}>
                        {/* Nút thật trong ô đầu: dùng được bằng bàn phím (Tab + Enter), cả dòng vẫn bấm được bằng chuột */}
                        <button
                          aria-pressed={dangChon}
                          className="font-semibold tabular-nums text-bo-primary-strong outline-none group-hover:underline focus-visible:underline"
                          onClick={(e) => { e.stopPropagation(); onChon(p.id); }}
                          title={t("Xem phiếu {{ma}}", { ma: p.soPhieu })}
                          type="button"
                        >
                          {p.soPhieu}
                        </button>
                        {p.traCheo ? <span className="mt-0.5 block text-[11px] font-medium text-bo-tt-dang-chu">{t("Trả chéo")}</span> : null}
                        {!p.traCheo && p.quaHan ? <span className="mt-0.5 block text-[11px] font-medium text-bo-warning">{t("Quá hạn · đã duyệt")}</span> : null}
                      </td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{nhanLuc(p.ngayTao, bayGio)}</td>
                      {/* Màn hẹp (dưới 1280px) bỏ cột Hóa đơn gốc và Người lập: có trong khung phiếu khi bấm dòng */}
                      <td className={`${td} hidden whitespace-nowrap tabular-nums text-slate-600 xl:table-cell`}>{p.soDonHang ?? '—'}</td>
                      <td className={`${td} max-w-[12rem] truncate`}>
                        {p.khachHang ? tDuLieu(p.khachHang) : <span className="text-bo-muted">{t("Khách lẻ")}</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                        {soLuong}
                        {soLoi ? <span className="text-bo-muted"> {t("({{n}} lỗi)", { n: soLoi })}</span> : null}
                      </td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                        <span className="block font-medium">{formatMoney(p.tongTienHoan)}</span>
                        <span className="block text-[11px] text-bo-muted">{p.phuongThucHoan === HOAN_TIEN_MAT ? t("Tiền mặt") : t("Chuyển khoản")}</span>
                      </td>
                      <td className={`${td} hidden max-w-[10rem] truncate text-slate-600 xl:table-cell`}>{p.nguoiLap ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data?.conNua ? (
              <p className="mt-2.5 px-0.5 text-xs text-bo-muted">{t("Đang hiện {{n}} phiếu mới nhất. Lọc theo khách hoặc thu hẹp khoảng ngày để thấy phiếu cũ hơn.", { n: ds.length })}</p>
            ) : null}
          </div>
          {/* Dòng tổng tính trên cả khoảng thời gian sau lọc (kể cả khi danh sách bị cắt) để đối soát tiền chi ra */}
          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-t border-bo-border bg-bo-surface-subtle px-4 py-2.5 text-[13px] text-bo-muted">
            <span>
              {/* Tên cửa hàng ở dòng tổng: số này chỉ là tiền hoàn chi ra tại cửa hàng đang chọn */}
              {tenKho ? <><span className="font-medium text-bo-foreground">{tDuLieu(tenKho)}</span> · </> : null}
              {t("{{n}} phiếu · {{sp}} sản phẩm", { n: data.soPhieu, sp: Number(data.tongSoLuong) || 0 })}
            </span>
            <span>{t("Tiền mặt")} <b className="font-semibold tabular-nums text-bo-foreground">{formatMoney(data.tienMat)}</b></span>
            <span>{t("Chuyển khoản")} <b className="font-semibold tabular-nums text-bo-foreground">{formatMoney(data.chuyenKhoan)}</b></span>
            <span className="sm:ml-auto">{t("Tổng hoàn")} <b className="text-[15px] font-bold tabular-nums text-bo-heading">{formatMoney(data.tongHoan)}</b></span>
          </div>
        </>
      )}
    </div>
  );
}
