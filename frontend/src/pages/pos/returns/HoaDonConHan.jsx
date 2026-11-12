import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { traHangService } from '@/services/traHangService';
import { getApiErrorMessage } from '@/utils/apiError';
import LoadingState from '@/components/shared/LoadingState';
import { formatMoney } from '../pos-format';
import { usePosDuLieuChung } from '../pos-du-lieu-chung';
import { t, tDuLieu } from "@/i18n";

const HAN_TRA_MS = 3 * 24 * 60 * 60 * 1000;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;
const MOT_GIO_MS = 60 * 60 * 1000;

const gioPhut = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** "Hôm nay 12:58" / "Hôm qua 17:05" / "10/11 09:12": thu ngân đọc nhanh hơn ngày giờ đầy đủ. */
function luc(iso, bayGio) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const homNay = new Date(bayGio);
  homNay.setHours(0, 0, 0, 0);
  const ngay = new Date(d);
  ngay.setHours(0, 0, 0, 0);
  const lech = Math.round((homNay - ngay) / MOT_NGAY_MS);
  if (lech === 0) return t("Hôm nay {{gio}}", { gio: gioPhut(d) });
  if (lech === 1) return t("Hôm qua {{gio}}", { gio: gioPhut(d) });
  // Ghép tay dd/MM: toLocaleDateString vi-VN không có năm ra "09-11" ở một số trình duyệt
  const hai = (n) => String(n).padStart(2, '0');
  return `${hai(d.getDate())}/${hai(d.getMonth() + 1)} ${gioPhut(d)}`;
}

/** Hạn trả còn lại tính từ lúc thanh toán (máy chủ vẫn là chốt chặn thật khi mở đơn). */
function hanTra(r, bayGio) {
  if (!r.conTraDuoc) return { chu: '—', tone: 'mute' };
  const conLai = new Date(r.thanhToanLuc).getTime() + HAN_TRA_MS - bayGio;
  if (r.quaHan || !(conLai > 0)) return { chu: t("Quá hạn"), tone: 'late' };
  if (conLai >= MOT_NGAY_MS) return { chu: t("Còn {{count}} ngày", { count: Math.floor(conLai / MOT_NGAY_MS) }), tone: 'normal' };
  return { chu: t("Còn {{count}} giờ", { count: Math.max(1, Math.ceil(conLai / MOT_GIO_MS)) }), tone: 'late' };
}

const TRANG_THAI_TRA = {
  tra_mot_phan: ['Trả một phần', 'bg-bo-primary-soft text-bo-primary-strong'], // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  da_tra_het: ['Đã trả hết', 'bg-slate-100 text-bo-muted'], // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
};
const CHUA_TRA = ['Chưa trả', 'bg-slate-100 text-slate-600']; // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện

const nutLoc = 'h-7 rounded-md px-2.5 text-[13px] transition focus-visible:outline-2 focus-visible:outline-bo-primary';

/**
 * Màn trả hàng chưa chọn hóa đơn: bảng hóa đơn bán tại quầy còn hạn trả (03 ngày), mới nhất trước — bấm một dòng để
 * mở như khi tìm theo mã. Mặc định chỉ cửa hàng đang nhận trả; "Mọi cửa hàng" cho khách trả chéo. Lựa chọn phạm vi
 * do trang giữ ({@code tatCa}) để mở rồi đóng một hóa đơn không đặt lại về "Cửa hàng này".
 */
export default function HoaDonConHan({ khoId, onChon, bayGio, tatCa, onDoiTatCa }) {
  const [lanTai, setLanTai] = useState(0);
  // Kết quả gắn với khóa của lần tải: khóa hiện tại khác khóa kết quả = đang tải (giữ danh sách cũ trong lúc chờ)
  const khoa = `${khoId}|${tatCa}|${lanTai}`;
  // Bộ nhớ tạm của khung POS: quay lại màn này (từ màn bán, hoặc đóng một hóa đơn) thì hiện ngay danh sách lần trước
  // trong lúc tải bản mới
  const { boNho } = usePosDuLieuChung();
  const khoaNho = `hoaDonConHan|${khoId}|${tatCa}`;
  const [ketQua, setKetQua] = useState({ khoa: null, loi: null, ds: [] });
  // Đang tải mà bộ nhớ có bản cũ của đúng cửa hàng / phạm vi này (kể cả danh sách rỗng): hiện bản đó, không vòng chờ.
  // Không có thì giữ danh sách đang hiện trong lúc chờ như trước.
  const banNho = ketQua.khoa !== khoa ? boNho.lay(khoaNho) : undefined;
  const coBanNho = banNho !== undefined;
  const trang = {
    dangTai: ketQua.khoa !== khoa,
    loi: ketQua.khoa === khoa ? ketQua.loi : null,
    ds: coBanNho ? banNho : ketQua.ds,
  };

  useEffect(() => {
    if (!khoId) return undefined;
    const controller = new AbortController();
    traHangService.ganDay(khoId, tatCa, { signal: controller.signal })
      .then((ds) => {
        setKetQua({ khoa, loi: null, ds });
        boNho.ghi(khoaNho, ds);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setKetQua({ khoa, loi: getApiErrorMessage(err, t("Không tải được danh sách hóa đơn.")), ds: [] });
      });
    return () => controller.abort();
  }, [khoId, tatCa, khoa, khoaNho, boNho]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pb-2.5 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-bo-heading">{t("Hóa đơn còn hạn trả")}</h2>
          <p className="text-xs text-bo-muted">{t("Bán tại quầy trong 03 ngày gần nhất · bấm một dòng để mở")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div aria-label={t("Phạm vi hóa đơn")} className="flex gap-0.5 rounded-lg border border-bo-border p-0.5" role="radiogroup">
            {[[false, t("Cửa hàng này")], [true, t("Mọi cửa hàng")]].map(([gt, nhan]) => (
              <button
                aria-checked={tatCa === gt}
                className={`${nutLoc} ${tatCa === gt ? 'bg-bo-primary-soft font-medium text-bo-primary-strong' : 'text-bo-muted hover:text-bo-foreground'}`}
                key={nhan}
                onClick={() => onDoiTatCa(gt)}
                role="radio"
                type="button"
              >
                {nhan}
              </button>
            ))}
          </div>
          <button
            aria-label={t("Tải lại danh sách")}
            className="grid size-8 place-items-center rounded-lg border border-bo-border text-bo-muted transition hover:bg-bo-surface-subtle hover:text-bo-foreground disabled:opacity-50"
            disabled={trang.dangTai}
            onClick={() => setLanTai((n) => n + 1)}
            title={t("Tải lại danh sách")}
            type="button"
          >
            <RefreshCw aria-hidden="true" className={trang.dangTai ? 'animate-spin motion-reduce:animate-none' : ''} size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {trang.dangTai && !trang.ds.length && !coBanNho ? (
          <div className="flex h-full min-h-40 items-center justify-center"><LoadingState label={t("Đang tải danh sách hóa đơn")} /></div>
        ) : trang.loi ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-bo-muted">
            <p>{trang.loi}</p>
            <button className="text-sm font-medium text-bo-primary hover:underline" onClick={() => setLanTai((n) => n + 1)} type="button">{t("Thử lại")}</button>
          </div>
        ) : !trang.ds.length ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">{tatCa ? t("Chưa có hóa đơn nào trong 03 ngày qua") : t("Cửa hàng này chưa có hóa đơn nào trong 03 ngày qua")}</p>
            <p className="max-w-sm text-[13px] text-bo-muted">{t("Hóa đơn cũ hơn: tìm theo mã hoặc số điện thoại ở ô phía trên.")}</p>
          </div>
        ) : (
          <>
            <table className="w-full border-separate border-spacing-0 overflow-hidden rounded-lg border border-bo-border text-[13px]">
              <thead className="sticky top-0 z-[1] bg-bo-surface-subtle text-xs text-bo-muted">
                <tr>
                  <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Mã hóa đơn")}</th>
                  <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Thanh toán lúc")}</th>
                  <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Khách hàng")}</th>
                  {tatCa ? <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Bán tại")}</th> : null}
                  <th className="border-b border-bo-border px-3 py-2.5 text-right font-semibold" scope="col">{t("Tổng tiền")}</th>
                  <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Đã trả")}</th>
                  <th className="border-b border-bo-border px-3 py-2.5 text-left font-semibold" scope="col">{t("Hạn trả")}</th>
                </tr>
              </thead>
              <tbody>
                {trang.ds.map((r) => {
                  const [nhanTra, mauTra] = TRANG_THAI_TRA[r.trangThaiTraHang] ?? CHUA_TRA;
                  const han = hanTra(r, bayGio);
                  const khach = r.khachHang ? `${tDuLieu(r.khachHang)}${r.soDienThoai ? ` · ${r.soDienThoai}` : ''}` : '—';
                  return (
                    <tr className={r.conTraDuoc ? 'group cursor-pointer hover:bg-bo-surface-subtle' : 'text-bo-muted'} key={r.donBanHangId} onClick={r.conTraDuoc ? () => onChon(r.donBanHangId) : undefined}>
                      <td className="border-b border-bo-border/70 px-3 py-2.5">
                        {/* Nút thật trong ô đầu: dùng được bằng bàn phím (Tab + Enter), cả dòng vẫn bấm được bằng chuột */}
                        <button
                          className="font-semibold tabular-nums text-bo-primary-strong outline-none group-hover:underline focus-visible:underline disabled:text-bo-muted disabled:no-underline"
                          disabled={!r.conTraDuoc}
                          onClick={(e) => { e.stopPropagation(); onChon(r.donBanHangId); }}
                          title={r.conTraDuoc ? t("Mở hóa đơn {{ma}}", { ma: r.soDonHang }) : t("Hóa đơn đã trả hết")}
                          type="button"
                        >
                          {r.soDonHang}
                        </button>
                      </td>
                      <td className="whitespace-nowrap border-b border-bo-border/70 px-3 py-2.5 tabular-nums">{luc(r.thanhToanLuc, bayGio)}</td>
                      <td className="max-w-[16rem] truncate border-b border-bo-border/70 px-3 py-2.5">{khach}</td>
                      {tatCa ? <td className="whitespace-nowrap border-b border-bo-border/70 px-3 py-2.5">{tDuLieu(r.khoBan)}</td> : null}
                      <td className="whitespace-nowrap border-b border-bo-border/70 px-3 py-2.5 text-right font-medium tabular-nums">{formatMoney(r.tongCong)}</td>
                      <td className="border-b border-bo-border/70 px-3 py-2.5">
                        <span className={`inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-xs font-medium ${mauTra}`}>{t(nhanTra)}</span>
                      </td>
                      <td className={`whitespace-nowrap border-b border-bo-border/70 px-3 py-2.5 ${han.tone === 'late' ? 'font-medium text-bo-warning' : han.tone === 'mute' ? 'text-bo-muted' : 'text-slate-600'}`}>{han.chu}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2.5 px-0.5 text-xs text-bo-muted">{t("Hóa đơn cũ hơn 03 ngày: tìm theo mã hoặc số điện thoại, cần quản lý duyệt.")}</p>
          </>
        )}
      </div>
    </div>
  );
}
