import { useEffect } from 'react';
import { Check, Loader2, Printer, Receipt, X } from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import { formatDateTime } from '@/utils/formatters';
import PosModal from '../components/PosModal';
import { formatMoney } from '../pos-format';
import { nhanLuc } from './nhan-thoi-gian';
import { usePhieuTra } from './usePhieuTra';
import { HOAN_TIEN_MAT, LY_DO_LOI, LY_DO_TRA, MA_KHAC, NHOM_LOI, QC_DAT, nhanTheoMa } from './tra-hang';
import { t, tDuLieu } from "@/i18n";

function TrangThai({ tone, children }) {
  const mau = { ok: 'text-bo-success', late: 'text-bo-warning', info: 'text-bo-tt-dang-chu' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${mau}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const bienThe = (d) => [d.mauSac, d.kichCo].filter(Boolean).map(tDuLieu).join(' / ');

/**
 * Nội dung một phiếu trả đã ghi (chỉ xem): đầu phiếu, từng món Đạt / Lỗi, số tổng. Dùng ở khung Phiếu trả (thẻ Phiếu
 * đã trả) và trong hộp xem nhanh khi đang mở hóa đơn gốc.
 */
export function NoiDungPhieu({ phieu: p, bayGio, onMoHoaDon }) {
  const thongTin = [
    [t("Lúc trả"), <span className="tabular-nums" title={formatDateTime(p.ngayTao)}>{nhanLuc(p.ngayTao, bayGio)}</span>],
    [t("Hóa đơn gốc"), (
      <>
        {onMoHoaDon ? (
          <button className="font-medium tabular-nums text-bo-primary-strong hover:underline" onClick={() => onMoHoaDon(p.donBanHangId)} title={t("Mở hóa đơn {{ma}}", { ma: p.soDonHang })} type="button">
            {p.soDonHang}
          </button>
        ) : <span className="font-medium tabular-nums">{p.soDonHang}</span>}
        <span className="text-bo-muted"> · {nhanLuc(p.thanhToanLuc, bayGio)}</span>
      </>
    )],
    [t("Khách hàng"), p.khachHang ? <>{tDuLieu(p.khachHang)}{p.soDienThoai ? <span className="text-bo-muted"> {p.soDienThoai}</span> : null}</> : t("Khách lẻ")],
    [t("Người lập"), p.nguoiLap ?? '—'],
    p.quaHan ? [t("Duyệt quá hạn"), [p.nguoiDuyet, p.lyDoDuyet].filter(Boolean).join(' · ') || '—'] : null,
    [t("Hoàn bằng"), p.phuongThucHoan === HOAN_TIEN_MAT ? t("Tiền mặt") : (
      <>{t("Chuyển khoản")}<span className="text-bo-muted"> · {[p.nganHang, p.soTaiKhoan, p.maGiaoDich].filter(Boolean).join(' · ')}</span></>
    )],
    [t("Phiếu nhập"), p.soPhieuNhap ? <span className="tabular-nums">{p.soPhieuNhap}</span> : <span className="text-bo-muted">{t("Không nhập kho (toàn hàng lỗi)")}</span>],
    p.ghiChu ? [t("Ghi chú"), p.ghiChu] : null,
  ].filter(Boolean);

  return (
    <>
      <div className="space-y-1.5 border-b border-bo-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-semibold tabular-nums text-bo-heading">{p.soPhieu}</h3>
          <TrangThai tone="ok">{t("Đã hoàn tất")}</TrangThai>
          {p.traCheo ? <TrangThai tone="info">{t("Trả chéo từ {{kho}}", { kho: tDuLieu(p.khoBan) })}</TrangThai> : null}
          {p.quaHan ? <TrangThai tone="late">{t("Quá hạn · đã duyệt")}</TrangThai> : null}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
          {thongTin.map(([k, v]) => (
            <div className="contents" key={k}>
              <dt className="text-bo-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ul aria-label={t("Sản phẩm trả")} className="divide-y divide-bo-border">
        {(p.dong ?? []).map((d, i) => (
          // Phiếu đã ghi không đổi thứ tự dòng; một mã có thể có hai dòng (Đạt và Lỗi) nên ghép thêm vị trí
          <li className="space-y-1.5 px-4 py-3" key={`${d.maSku}-${i}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{tDuLieu(d.tenSanPham)}</p>
                <p className="truncate text-xs text-bo-muted">{[bienThe(d), d.maSku].filter(Boolean).join(' · ')}</p>
              </div>
              <p className="shrink-0 text-right text-[13px] tabular-nums">
                <span className="text-bo-muted">{Number(d.soLuong)} ×</span> {formatMoney(d.donGiaHoan)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {d.tinhTrang === QC_DAT ? (
                <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-bo-success-soft px-2 font-medium text-bo-success">
                  <Check aria-hidden="true" size={12} />
                  {d.ke ? t("Đạt · lên kệ {{ke}}", { ke: d.ke }) : t("Đạt")}
                </span>
              ) : (
                <span className="inline-flex h-[22px] items-center rounded-full bg-red-50 px-2 font-medium text-red-700">
                  {d.nhomLoi === MA_KHAC && d.ghiChu
                    ? t("Lỗi · {{nhom}}", { nhom: d.ghiChu })
                    : d.nhomLoi ? t("Lỗi · {{nhom}}", { nhom: t(nhanTheoMa(NHOM_LOI, d.nhomLoi)) }) : t("Hàng lỗi để riêng")}
                </span>
              )}
              {/* Hàng Lỗi: lý do luôn là lỗi sản xuất (máy chủ tự ghi), chip Lỗi đã nói đủ nên không lặp lại. */}
              {d.tinhTrang === QC_DAT && d.lyDo === MA_KHAC && d.ghiChu ? (
                <span className="min-w-0 break-words text-bo-muted">{t("Khác: {{ghiChu}}", { ghiChu: d.ghiChu })}</span>
              ) : d.lyDo && !(d.tinhTrang !== QC_DAT && d.lyDo === LY_DO_LOI) ? (
                <span className="text-bo-muted">{t(nhanTheoMa(LY_DO_TRA, d.lyDo))}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-bo-border px-4 py-3 text-[13px]">
        <div className="flex justify-between text-bo-muted"><span>{t("Nhập lại kho")}</span><span className="font-medium tabular-nums text-bo-foreground">{Number(p.soLuongDat) || 0}</span></div>
        <div className="flex justify-between text-bo-muted"><span>{t("Hàng lỗi để riêng")}</span><span className="font-medium tabular-nums text-bo-foreground">{Number(p.soLuongLoi) || 0}</span></div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-semibold">{t("Đã hoàn cho khách")}</span>
          <span className="text-xl font-bold tabular-nums text-bo-heading">{formatMoney(p.tongTienHoan)}</span>
        </div>
      </div>
    </>
  );
}

const nutPhu = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground transition hover:bg-bo-surface-subtle';
const nutChinh = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-bo-primary px-3 text-sm font-semibold text-white transition hover:bg-bo-primary-hover';

/** Hai nút cuối phiếu: mở hóa đơn gốc (bỏ khi không có) và in lại biên bản 02 liên. */
export function NutPhieu({ phieu, onMoHoaDon, onIn, dangIn = false }) {
  return (
    <div className={`grid gap-2 ${onMoHoaDon ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {onMoHoaDon ? (
        <button className={nutPhu} onClick={() => onMoHoaDon(phieu.donBanHangId)} type="button">
          <Receipt aria-hidden="true" size={16} />
          {t("Mở hóa đơn gốc")}
        </button>
      ) : null}
      <button aria-busy={dangIn || undefined} className={`${nutChinh} disabled:cursor-not-allowed disabled:opacity-60`} disabled={dangIn} onClick={() => onIn(phieu.id)} type="button">
        {dangIn ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Printer aria-hidden="true" size={16} />}
        {dangIn ? t("Đang chuẩn bị bản in…") : t("In lại biên bản")}
      </button>
    </div>
  );
}

/**
 * Hộp xem nhanh một phiếu đã trả trước đó của hóa đơn đang mở (dòng "Đã trả trước đó" ở đầu hóa đơn). Dùng hộp thay
 * vì khung phải để không mất các món thu ngân đang chọn trả.
 */
export function HopPhieuDaTra({ id, bayGio, onDong, onIn, dangIn }) {
  const { phieu, loi, dangTai, thuLai } = usePhieuTra(id);
  // Esc đóng hộp (PosModal chưa tự bắt phím)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDong();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDong]);
  return (
    <PosModal
      footer={phieu ? <NutPhieu dangIn={dangIn} onIn={onIn} phieu={phieu} /> : null}
      onClose={onDong}
      title={t("Phiếu đã trả")}
    >
      {dangTai ? (
        <div className="flex min-h-40 items-center justify-center"><LoadingState label={t("Đang tải phiếu trả")} /></div>
      ) : loi || !phieu ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-bo-muted">
          <p>{loi ?? t("Không tải được phiếu trả.")}</p>
          <button className="text-sm font-medium text-bo-primary hover:underline" onClick={thuLai} type="button">{t("Thử lại")}</button>
        </div>
      ) : (
        <div className="-mx-5 -my-4">
          <NoiDungPhieu bayGio={bayGio} phieu={phieu} />
        </div>
      )}
    </PosModal>
  );
}

/**
 * Khung Phiếu trả (bên phải) khi xem lại một phiếu ở thẻ Phiếu đã trả. Chỉ xem và in lại: phiếu đã ghi sổ, không sửa
 * hay hủy ở quầy.
 */
export default function KhungPhieuDaTra({ id, banDau, bayGio, onDong, onMoHoaDon, onIn, dangIn }) {
  const { phieu, loi, dangTai, thuLai } = usePhieuTra(id, banDau);
  const soLuong = Number(phieu?.tongSoLuong) || 0;
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bo-border px-4 py-3">
        <p className="text-sm font-semibold">
          {t("Phiếu trả")}
          {soLuong ? <span className="font-normal text-bo-muted"> · {t("{{count}} sản phẩm", { count: soLuong })}</span> : null}
        </p>
        <button aria-label={t("Đóng phiếu")} className="grid size-7 place-items-center rounded-md text-bo-muted transition hover:bg-slate-100 hover:text-bo-foreground" onClick={onDong} title={t("Đóng phiếu")} type="button">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      {dangTai ? (
        <div className="flex flex-1 items-center justify-center p-6"><LoadingState label={t("Đang tải phiếu trả")} /></div>
      ) : loi || !phieu ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-bo-muted">
          <p>{loi ?? t("Không tải được phiếu trả.")}</p>
          <button className="text-sm font-medium text-bo-primary hover:underline" onClick={thuLai} type="button">{t("Thử lại")}</button>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <NoiDungPhieu bayGio={bayGio} onMoHoaDon={onMoHoaDon} phieu={phieu} />
          </div>
          <div className="shrink-0 space-y-2 border-t border-bo-border px-4 pb-4 pt-3">
            <NutPhieu dangIn={dangIn} onIn={onIn} onMoHoaDon={onMoHoaDon} phieu={phieu} />
            <p className="text-center text-[11px] text-bo-muted">{t("Phiếu đã ghi sổ, chỉ xem và in lại, không sửa hay hủy ở đây.")}</p>
          </div>
        </>
      )}
    </>
  );
}
