import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, Minus, PackageOpen, Plus, Printer, ReceiptText, Search, ShieldCheck, Undo2, X } from 'lucide-react';
import { toast } from '@/lib/thongBaoNhanh';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatDateTime } from '@/utils/formatters';
import { getMineKhoList } from '@/services/khoService';
import { laKhoBanTaiQuay } from '@/utils/kho';
import { traHangService, newReturnRequestId } from '@/services/traHangService';
import LoadingState from '@/components/shared/LoadingState';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';
import PosTopBar from '../components/PosTopBar';
import PosWarehousePicker from '../components/PosWarehousePicker';
import PosModal from '../components/PosModal';
import PosModeTabs from '../components/PosModeTabs';
import PrintTemplateDocument from '@/components/print/PrintTemplateDocument';
import { getPaperSheetClasses, getPaperSheetWidthPx } from '@/components/print/paperStyles';
import { toPosReturnPrintModel } from '@/components/print/adapters/posReturnPrintAdapter';
import { printTemplateConfigService } from '@/services/printTemplateConfigService';
import { companyProfileService } from '@/services/companyProfileService';
import { formatMoney } from '../pos-format';
import DuyetQuaHanModal from './DuyetQuaHanModal';
import {
  HOAN_CHUYEN_KHOAN,
  HOAN_TIEN_MAT,
  LY_DO_TRA,
  NHOM_LOI,
  QC_DAT,
  QC_LOI,
  conTra,
  dungYeuCau,
  khoaNoiDung,
  khoiTaoDong,
  loiChuyenKhoan,
  loiTheoDong,
  tienHoanDong,
  tongKet,
} from './tra-hang';
import { t, tDuLieu } from "@/i18n";

const NGAN_HANG = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'VPBank',
  'Sacombank', 'TPBank', 'HDBank', 'VIB', 'SHB', 'OCB', 'MSB', 'SeABank', 'Eximbank', 'LPBank', 'Nam A Bank',
  'Bac A Bank'];

/* Nhãn cách thanh toán gốc, dịch lúc hiện bằng t() */
const PHUONG_THUC_GOC = {
  CASH: 'Tiền mặt', // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  PAYOS: 'Chuyển khoản QR', // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
  KET_HOP: 'Tiền mặt + chuyển khoản QR', // i18n-giu-nguyen: nhãn hằng số, dịch lúc hiện
};

const secondaryButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-bo-border bg-bo-surface px-3 text-sm font-medium text-bo-foreground transition hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-60';

function readStoredKho(warehouses) {
  let stored = null;
  try { stored = Number(localStorage.getItem('selected_kho_id')); } catch { /* bỏ qua */ }
  return warehouses.some((w) => w.id === stored) ? stored : warehouses[0]?.id ?? null;
}

/**
 * Màn Trả hàng tại quầy (/pos/returns) theo đặc tả BA "Trả hàng / Đổi hàng tại POS":
 * bước 1 tra cứu hóa đơn gốc → bước 2 kiểm hạn 03 ngày (quá hạn cần quản lý duyệt bằng mã PIN qua email) →
 * bước 3 chọn sản phẩm, số lượng, hiện trạng QC, kệ cất, lý do → bước 4 chọn cách hoàn tiền → bước 5 xác nhận, in
 * biên bản 02 liên. Bố cục tự thiết kế theo hệ thống (mockup BA chỉ tham khảo); nghiệp vụ và nhãn bám BA.
 */
export default function PosReturnsPage() {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [khoId, setKhoId] = useState(null);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [don, setDon] = useState(null);
  const [loadingDon, setLoadingDon] = useState(false);

  const [chon, setChon] = useState([]);
  const [phuongThuc, setPhuongThuc] = useState(HOAN_TIEN_MAT);
  const [ck, setCk] = useState({ nganHang: '', soTaiKhoan: '', tenChuTaiKhoan: '', maGiaoDich: '' });
  const [ghiChu, setGhiChu] = useState('');
  const [tuDuyet, setTuDuyet] = useState(null); // quản lý tự duyệt: { lyDo }
  const [modal, setModal] = useState(null); // 'duyet' | 'xacNhan' | 'chinhSach'
  const [daBamXacNhan, setDaBamXacNhan] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [ketQua, setKetQua] = useState(null);
  const requestRef = useRef({ id: null, khoa: null });
  // Lần gửi trước chưa rõ kết quả (mất mạng, 5xx): giữ requestId, không cho sửa nội dung cho tới khi tải lại đơn
  const [chuaRo, setChuaRo] = useState(false);
  const taiDonSeq = useRef(0);
  // Đồng hồ 15 giây: duyệt quá hạn chỉ dùng được 30 phút, hết thì hiện lại nút xin duyệt
  const [bayGio, setBayGio] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setBayGio(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);
  const searchRef = useRef(null);

  // Tiêu đề tab: khung POS đặt "Bán hàng tại quầy" một lần khi mở, màn này đổi rồi trả lại khi rời
  useEffect(() => {
    document.title = t("Trả hàng tại quầy · FCentric");
    return () => { document.title = t("Bán hàng tại quầy · FCentric"); };
  }, []);

  // Kho bán tại quầy được phân quyền (cùng nguồn với màn bán hàng)
  useEffect(() => {
    let huy = false;
    getMineKhoList()
      .then((ds) => {
        if (huy) return;
        const ban = (ds ?? []).filter(laKhoBanTaiQuay);
        setWarehouses(ban);
        setKhoId(readStoredKho(ban));
      })
      .catch((err) => { if (!huy) setLoadError(err); });
    return () => { huy = true; };
  }, []);

  const resetChon = useCallback((d) => {
    setChon(khoiTaoDong(d?.dong ?? []));
    setTuDuyet(null);
    setSubmitError(null);
    setDaBamXacNhan(false);
    setChuaRo(false);
    requestRef.current = { id: null, khoa: null };
  }, []);

  const moDon = useCallback(async (donBanHangId, kho = khoId) => {
    const seq = ++taiDonSeq.current;
    setLoadingDon(true);
    try {
      const d = await traHangService.donGoc(donBanHangId, kho);
      if (seq !== taiDonSeq.current) return true; // đã có lần tải mới hơn
      setDon(d);
      resetChon(d);
      setResults([]);
      // MSG-RET-02: đơn quá hạn mà chưa có duyệt hiệu lực
      if (d?.quaHan && !d?.duyet) setModal('duyet');
      return true;
    } catch (err) {
      if (seq === taiDonSeq.current) toast.error(getApiErrorMessage(err, t("Không tải được hóa đơn gốc.")));
      return false;
    } finally {
      if (seq === taiDonSeq.current) setLoadingDon(false);
    }
  }, [khoId, resetChon]);

  const timDon = async (event) => {
    event?.preventDefault();
    const q = query.trim();
    if (!q || !khoId || searching) return;
    setSearching(true);
    setKetQua(null);
    try {
      const ds = await traHangService.tim(khoId, q);
      if (ds.length === 1) {
        await moDon(ds[0].donBanHangId);
      } else {
        setDon(null);
        setResults(ds);
      }
    } catch (err) {
      // MSG-RET-01
      setDon(null);
      setResults([]);
      toast.error(getApiErrorMessage(err, t("Không tìm thấy thông tin đơn hàng hợp lệ. Vui lòng kiểm tra lại mã hóa đơn!")));
    } finally {
      setSearching(false);
    }
  };

  const doiKho = async (id) => {
    const cu = khoId;
    setKhoId(id);
    try { localStorage.setItem('selected_kho_id', String(id)); } catch { /* bỏ qua */ }
    // Kệ và quyền tính theo cửa hàng nhận: tải lại đơn đang mở cho kho mới (lựa chọn cũ gắn kệ kho cũ nên chọn lại)
    if (don && !(await moDon(don.donBanHangId, id))) {
      setKhoId(cu);
      try { localStorage.setItem('selected_kho_id', String(cu)); } catch { /* bỏ qua */ }
    }
  };

  const lamMoi = () => {
    setDon(null);
    setResults([]);
    setQuery('');
    setKetQua(null);
    setPhuongThuc(HOAN_TIEN_MAT);
    setCk({ nganHang: '', soTaiKhoan: '', tenChuTaiKhoan: '', maGiaoDich: '' });
    setGhiChu('');
    resetChon(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const dongGoc = useMemo(() => don?.dong ?? [], [don]);
  const tong = useMemo(() => tongKet(dongGoc, chon), [dongGoc, chon]);
  const loiDong = useMemo(() => loiTheoDong(dongGoc, chon, don?.khoCoKe), [dongGoc, chon, don]);
  const loiCk = phuongThuc === HOAN_CHUYEN_KHOAN ? loiChuyenKhoan(ck) : [];
  const duyetConHan = Boolean(don?.duyet) && new Date(don.duyet.hetHieuLucLuc).getTime() > bayGio;
  const duyetDu = !don?.quaHan || duyetConHan || Boolean(tuDuyet);
  const coTheXacNhan = Boolean(don) && tong.soSanPham > 0 && Object.keys(loiDong).length === 0
    && loiCk.length === 0 && duyetDu && !submitting;

  const capNhatDong = (chiTietId, patch) => {
    setChon((ds) => ds.map((c) => (c.chiTietId === chiTietId ? { ...c, ...patch } : c)));
    setSubmitError(null);
  };

  const chonTatCa = (gt) => {
    setChon((ds) => ds.map((c) => {
      const d = dongGoc.find((x) => x.chiTietId === c.chiTietId);
      return conTra(d) > 0 ? { ...c, chon: gt } : c;
    }));
  };

  const moXacNhan = () => {
    setDaBamXacNhan(true);
    if (!coTheXacNhan) {
      if (!duyetDu) setModal('duyet');
      return;
    }
    setModal('xacNhan');
  };

  const guiXacNhan = async () => {
    const payload = dungYeuCau({
      requestId: null,
      don,
      khoId,
      chon,
      phuongThuc,
      ck,
      yeuCauDuyetId: don?.duyet?.yeuCauId,
      lyDoDuyet: tuDuyet?.lyDo,
      ghiChu,
    });
    // Cùng nội dung → giữ requestId (gửi lại sau mất mạng không trả hai lần); đổi nội dung → mã mới
    const khoa = khoaNoiDung(payload);
    if (requestRef.current.khoa !== khoa) requestRef.current = { id: newReturnRequestId(), khoa };
    payload.requestId = requestRef.current.id;
    // Mở sẵn cửa sổ in ngay trong cú bấm (trình duyệt chặn cửa sổ mở sau khi chờ máy chủ)
    const cuaSoIn = window.open('', '_blank');
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { data, message } = await traHangService.xacNhan(payload);
      setKetQua({ ...data, phuongThucHoan: payload.phuongThucHoan });
      setModal(null);
      setChuaRo(false);
      requestRef.current = { id: null, khoa: null };
      // MSG-RET-04
      toast.success(message || t("Hoàn tất thủ tục trả hàng thành công. Mã phiếu: {{so}}. Hệ thống đang in biên lai", { so: data?.soPhieu }));
      inBienBan(data?.phieuTraHangId, cuaSoIn);
    } catch (err) {
      cuaSoIn?.close();
      const status = err?.response?.status;
      // Mất mạng, hết giờ chờ, lỗi máy chủ / cổng trung gian: chưa biết máy chủ đã ghi chưa -> giữ requestId
      const khongRo = !err?.response || status >= 500 || status === 408;
      setChuaRo(khongRo);
      setSubmitError(khongRo
        ? t("Chưa rõ kết quả do mất kết nối. Bấm Thử lại: hệ thống nhận ra lần gửi này, không trả hàng hai lần.")
        : getApiErrorMessage(err, t("Không hoàn tất được trả hàng.")));
      if (!khongRo) requestRef.current = { id: null, khoa: null };
      // 409: duyệt quá hạn có thể đã hết hiệu lực -> lấy lại trạng thái duyệt từ máy chủ
      if (status === 409) capNhatDuyet();
    } finally {
      setSubmitting(false);
    }
  };

  const capNhatDuyet = async () => {
    if (!don) return;
    try {
      const d = await traHangService.donGoc(don.donBanHangId, khoId);
      setDon((cu) => (cu && cu.donBanHangId === d.donBanHangId ? { ...cu, duyet: d.duyet, quaHan: d.quaHan } : cu));
    } catch { /* giữ nguyên, thu ngân thử lại */ }
  };

  // Đóng hộp xác nhận khi lần gửi chưa rõ kết quả: tải lại đơn từ máy chủ (thấy phiếu đã lập nếu lần trước đã ghi)
  const dongXacNhan = () => {
    if (submitting) return;
    setModal(null);
    if (chuaRo && don) {
      toast.info(t("Đã tải lại hóa đơn để kiểm tra lần gửi trước. Xem số Đã trả của từng món rồi làm lại nếu cần."));
      moDon(don.donBanHangId);
    }
  };

  const inBienBan = (id, cuaSo = null) => {
    if (!id) { cuaSo?.close(); return; }
    const url = `/pos/returns/${id}/print`;
    if (cuaSo && !cuaSo.closed) {
      cuaSo.opener = null;
      cuaSo.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  // Phím tắt như màn bán: F3 về ô tìm hóa đơn, F9 hoàn tiền
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'F9' && don && !modal && !ketQua && !submitting) {
        e.preventDefault();
        moXacNhan();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const renderTopBar = (picker = true) => (
    <PosTopBar helpLabel={t("Chính sách trả hàng")} onHelp={() => setModal('chinhSach')}>
      <PosModeTabs hienTai="tra" khoa={submitting} lyDoKhoa={t("Đang xử lý trả hàng nên chưa đổi được kho.")} tatPhimTat={Boolean(modal) || Boolean(don && !ketQua)} />
      {picker && warehouses?.length ? (
        <PosWarehousePicker
          blocked={Boolean(modal)}
          disabled={submitting || loadingDon || chuaRo}
          disabledReason={t("Đang xử lý trả hàng nên chưa đổi được kho.")}
          ghiChu={t("Hàng Đạt nhập vào kho của cửa hàng này, tiền hoàn chi tại đây. Đổi cửa hàng sẽ bỏ các lựa chọn đang làm.")}
          nhan={t("Cửa hàng nhận trả")}
          onBlockedOpen={() => toast.info(t("Đang xử lý trả hàng nên chưa đổi được kho."))}
          onChange={doiKho}
          value={khoId}
          warehouses={warehouses}
        />
      ) : null}
    </PosTopBar>
  );

  const trangThaiTrong = (content) => (
    <>
      {renderTopBar(false)}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4">{content}</div>
    </>
  );

  if (loadError) {
    return trangThaiTrong(
      <ErrorState description={t("Không tải được danh sách kho bán hàng.")} onRetry={() => window.location.reload()} title={t("Không mở được màn trả hàng")} />
    );
  }
  if (!warehouses) return trangThaiTrong(<LoadingState label={t("Đang tải dữ liệu trả hàng")} />);
  if (!warehouses.length) {
    return trangThaiTrong(
      <EmptyState description={t("Tài khoản của bạn chưa được giao cửa hàng nào. Liên hệ quản trị viên để được phân quyền.")} title={t("Chưa có cửa hàng")} />
    );
  }

  const daChon = dongGoc.filter((d) => chon.find((c) => c.chiTietId === d.chiTietId)?.chon && conTra(d) > 0);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-bo-canvas text-bo-foreground">
      {renderTopBar()}

      {ketQua ? (
        <HoanTat ketQua={ketQua} onIn={() => inBienBan(ketQua.phieuTraHangId)} onLamMoi={lamMoi} onVeBanHang={() => navigate('/pos')} />
      ) : (
        <main className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
          {/* ───────── Trái: hóa đơn gốc (như danh mục của màn bán) ───────── */}
          <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface lg:min-h-0">
            <form className="shrink-0 border-b border-bo-border p-3" onSubmit={timDon}>
              <label className="sr-only" htmlFor="tra-hang-tim">{t("Tìm hóa đơn gốc")}</label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bo-muted" size={16} />
                <input
                  autoComplete="off"
                  autoFocus
                  className="h-10 w-full rounded-lg border border-bo-border bg-bo-surface pl-9 pr-14 text-sm outline-none transition placeholder:text-bo-muted focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
                  disabled={submitting}
                  id="tra-hang-tim"
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Mã hóa đơn hoặc số điện thoại khách")}
                  ref={searchRef}
                  value={query}
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-bo-border bg-bo-surface-subtle px-1.5 py-0.5 text-[11px] font-medium text-bo-muted">
                  {searching ? '…' : 'F3'}
                </kbd>
              </div>
            </form>

            {loadingDon ? (
              <div className="flex flex-1 items-center justify-center p-6"><LoadingState label={t("Đang tải hóa đơn gốc")} /></div>
            ) : don ? (
              <>
                <DauDon don={don} />
                <ul className="min-h-0 flex-1 divide-y divide-bo-border overflow-y-auto">
                  {dongGoc.map((d) => (
                    <DongHoaDon
                      d={d}
                      dangChon={Boolean(chon.find((c) => c.chiTietId === d.chiTietId)?.chon)}
                      key={d.chiTietId}
                      onChon={(gt) => capNhatDong(d.chiTietId, { chon: gt })}
                    />
                  ))}
                </ul>
              </>
            ) : results.length > 1 ? (
              <KetQuaTim onChon={(id) => moDon(id)} results={results} />
            ) : (
              <ManTrong />
            )}
          </section>

          {/* ───────── Phải: phiếu trả (như Hóa đơn hiện tại) ───────── */}
          <aside aria-label={t("Phiếu trả")} className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface lg:min-h-0">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-bo-border px-4 py-3">
              <p className="text-sm font-semibold">
                {t("Phiếu trả")}
                {tong.tongSoLuong ? <span className="font-normal text-bo-muted"> · {t("{{n}} sản phẩm", { n: tong.tongSoLuong })}</span> : null}
              </p>
              {daChon.length ? (
                <button className="text-xs text-bo-muted transition hover:text-bo-danger" onClick={() => chonTatCa(false)} type="button">{t("Bỏ hết")}</button>
              ) : null}
            </div>

            {don?.quaHan && !duyetDu ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-bo-border bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                <AlertTriangle aria-hidden="true" className="shrink-0" size={15} />
                <span>{t("Đơn đã quá hạn 03 ngày. Cần quản lý cửa hàng duyệt.")}</span>
              </div>
            ) : null}
            {don?.quaHan && duyetDu ? (
              <div className="flex shrink-0 items-center gap-2 border-b border-bo-border bg-bo-success-soft px-4 py-2.5 text-xs text-green-900">
                <ShieldCheck aria-hidden="true" className="shrink-0" size={15} />
                <span>
                  {duyetConHan && !tuDuyet
                    ? t("Đã duyệt ngoại lệ bởi {{ten}} · tới {{han}}", { ten: don.duyet.nguoiDuyet, han: gioPhut(don.duyet.hetHieuLucLuc) })
                    : t("Bạn duyệt ngoại lệ với quyền quản lý cửa hàng.")}
                </span>
              </div>
            ) : null}

            {daChon.length ? (
              <ul className="min-h-0 flex-1 divide-y divide-bo-border overflow-y-auto">
                {daChon.map((d) => (
                  <MonTra
                    c={chon.find((x) => x.chiTietId === d.chiTietId)}
                    d={d}
                    daBamXacNhan={daBamXacNhan}
                    ke={don.ke}
                    khoCoKe={don.khoCoKe}
                    key={d.chiTietId}
                    loi={loiDong[d.chiTietId]}
                    onCapNhat={(patch) => capNhatDong(d.chiTietId, patch)}
                  />
                ))}
              </ul>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-bo-muted">
                <span className="grid size-12 place-items-center rounded-full bg-slate-100"><Undo2 aria-hidden="true" size={20} /></span>
                {don ? t("Bấm Trả ở món khách mang lại") : t("Tìm hóa đơn gốc để bắt đầu")}
              </div>
            )}

            {daChon.length ? (
              <div className="shrink-0 space-y-3 border-t border-bo-border px-4 pb-4 pt-3">
                <div className="space-y-1 text-[13px]">
                  <div className="flex justify-between text-bo-muted"><span>{t("Nhập lại kho")}</span><span className="font-medium tabular-nums text-bo-foreground">{tong.soDat}</span></div>
                  <div className="flex justify-between text-bo-muted"><span>{t("Hàng lỗi để riêng")}</span><span className="font-medium tabular-nums text-bo-foreground">{tong.soLoi}</span></div>
                </div>
                <div className="flex items-baseline justify-between border-t border-dashed border-bo-border pt-3">
                  <span className="text-sm font-medium">{t("Tổng hoàn khách")}</span>
                  <span className="text-xl font-bold tracking-tight tabular-nums text-bo-primary">{formatMoney(tong.tongTien)}</span>
                </div>
                <div aria-label={t("Phương thức hoàn tiền")} className="grid grid-cols-2 gap-2" role="radiogroup">
                  {[[HOAN_TIEN_MAT, t("Tiền mặt")], [HOAN_CHUYEN_KHOAN, t("Chuyển khoản")]].map(([gt, nhan]) => (
                    <button
                      aria-checked={phuongThuc === gt}
                      className={`h-10 rounded-lg border text-sm transition ${phuongThuc === gt ? 'border-bo-primary bg-bo-primary-soft font-semibold text-bo-primary-strong' : 'border-bo-border font-medium hover:bg-bo-surface-subtle'}`}
                      key={gt}
                      onClick={() => { setPhuongThuc(gt); setSubmitError(null); }}
                      role="radio"
                      type="button"
                    >
                      {nhan}
                    </button>
                  ))}
                </div>
                {phuongThuc === HOAN_CHUYEN_KHOAN ? (
                  <ThongTinChuyenKhoan ck={ck} hienLoi={daBamXacNhan} loi={loiCk} onChange={(patch) => { setCk((x) => ({ ...x, ...patch })); setSubmitError(null); }} />
                ) : null}
                {daBamXacNhan && duyetDu && (Object.keys(loiDong).length || loiCk.length) ? (
                  <p className="text-xs text-bo-danger" role="alert">{t("Chọn đủ kệ, nhóm lỗi và lý do ở ô viền đỏ.")}</p>
                ) : null}
                {submitError && modal !== 'xacNhan' ? (
                  <p className="rounded-md bg-bo-danger-soft px-3 py-2 text-xs text-bo-danger" role="alert">{submitError}</p>
                ) : null}
                {!duyetDu ? (
                  <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white transition hover:bg-orange-700" onClick={() => setModal('duyet')} type="button">
                    <ShieldCheck aria-hidden="true" size={17} />
                    {t("Xin quản lý duyệt")}
                  </button>
                ) : (
                  <button
                    aria-disabled={!coTheXacNhan}
                    className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition ${coTheXacNhan ? 'bg-bo-primary hover:bg-bo-primary-hover' : 'bg-slate-300'}`}
                    disabled={submitting}
                    onClick={moXacNhan}
                    type="button"
                  >
                    {t("Hoàn tiền")}
                    <span className="rounded bg-bo-surface/15 px-1.5 py-0.5 text-[10px] font-medium">F9</span>
                  </button>
                )}
              </div>
            ) : null}
          </aside>
        </main>
      )}

      {modal === 'duyet' && don ? (
        <DuyetQuaHanModal
          coQuyenDuyet={don.coQuyenDuyet}
          don={don}
          khoId={khoId}
          onClose={() => setModal(null)}
          onDaDuyet={(duyet) => { setDon((d) => ({ ...d, duyet })); setModal(null); }}
          onTuDuyet={(lyDo) => { setTuDuyet({ lyDo }); setModal(null); }}
        />
      ) : null}

      {modal === 'xacNhan' && don ? (
        <PosModal
          description={t("Lập phiếu trả, nhập hàng Đạt vào kho, in biên bản 02 liên.")}
          footer={(
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className={secondaryButton} disabled={submitting} onClick={dongXacNhan} type="button">{chuaRo ? t("Tải lại hóa đơn") : t("Quay lại")}</button>
              <button
                className="inline-flex min-h-9 items-center justify-center rounded-lg bg-bo-primary px-4 text-sm font-semibold text-white transition hover:bg-bo-primary-hover disabled:opacity-60"
                disabled={submitting}
                onClick={guiXacNhan}
                type="button"
              >
                {submitting ? t("Đang ghi…") : submitError ? t("Thử lại") : t("Hoàn tiền")}
              </button>
            </div>
          )}
          onClose={dongXacNhan}
          size="sm"
          title={t("Hoàn {{tien}} cho khách?", { tien: formatMoney(tong.tongTien) })}
        >
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">{t("Hóa đơn gốc")}</dt><dd className="font-medium tabular-nums">{don.soDonHang}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-bo-muted">{t("Sản phẩm")}</dt><dd className="font-medium tabular-nums">{t("{{dat}} Đạt · {{loi}} Lỗi", { dat: tong.soDat, loi: tong.soLoi })}</dd></div>
            <div className="flex justify-between gap-3">
              <dt className="text-bo-muted">{t("Hoàn bằng")}</dt>
              <dd className="text-right font-medium">{phuongThuc === HOAN_TIEN_MAT ? t("Tiền mặt") : t("Chuyển khoản · {{ma}}", { ma: ck.maGiaoDich })}</dd>
            </div>
            {don.traCheo ? (
              <div className="flex justify-between gap-3"><dt className="text-bo-muted">{t("Doanh thu giảm ở")}</dt><dd className="font-medium">{tDuLieu(don.khoBan)}</dd></div>
            ) : null}
          </dl>
          {submitError ? <p className="mt-3 rounded-md bg-bo-danger-soft px-3 py-2 text-sm text-bo-danger" role="alert">{submitError}</p> : null}
        </PosModal>
      ) : null}

      {modal === 'chinhSach' ? <ChinhSachModal onClose={() => setModal(null)} /> : null}
    </div>
  );
}

// ═════════════════════════ Thành phần con ═════════════════════════

const gioPhut = (v) => {
  const d = new Date(v);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function TrangThai({ tone, children }) {
  const mau = { ok: 'text-bo-success', late: 'text-bo-warning', mute: 'text-bo-muted', info: 'text-bo-tt-dang-chu' }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium ${mau}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function ManTrong() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-8 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-slate-100 text-bo-muted"><ReceiptText aria-hidden="true" size={20} /></span>
      <p className="text-sm font-medium">{t("Quét mã trên biên lai hoặc nhập số điện thoại khách")}</p>
      <p className="max-w-sm text-[13px] text-bo-muted">{t("Nhận trả hóa đơn bán tại quầy ở mọi cửa hàng, trong vòng 03 ngày kể từ lúc thanh toán.")}</p>
    </div>
  );
}

function KetQuaTim({ results, onChon }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 overflow-y-auto p-6 text-center">
      <p className="text-sm font-medium">{t("{{n}} hóa đơn của khách", { n: results.length })}</p>
      <p className="text-[13px] text-bo-muted">{t("Chọn hóa đơn khách muốn trả.")}</p>
      <ul className="mt-3 w-full max-w-lg divide-y divide-bo-border overflow-hidden rounded-lg border border-bo-border text-left">
        {results.map((r) => (
          <li key={r.donBanHangId}>
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-[13px] transition hover:bg-bo-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!r.conTraDuoc}
              onClick={() => onChon(r.donBanHangId)}
              type="button"
            >
              <span className="font-semibold tabular-nums">{r.soDonHang}</span>
              <span className="truncate text-bo-muted">{formatDateTime(r.thanhToanLuc)} · {tDuLieu(r.khoBan)}</span>
              <span className="ml-auto shrink-0">
                {!r.conTraDuoc ? <TrangThai tone="mute">{t("Đã trả hết")}</TrangThai>
                  : r.quaHan ? <TrangThai tone="late">{t("Quá hạn")}</TrangThai>
                    : <span className="font-semibold tabular-nums">{formatMoney(r.tongCong)}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Thông tin hóa đơn gốc (đặc tả BA V.1): hai dòng chữ, không ô. */
function DauDon({ don }) {
  const conNgay = Math.max(0, 3 - Number(don.soNgay));
  const thongTin = [
    formatDateTime(don.thanhToanLuc),
    t("Bán tại {{kho}}", { kho: tDuLieu(don.khoBan) }),
    don.thuNgan ? t("Thu ngân {{ten}}", { ten: don.thuNgan }) : null,
    don.khachHang ? `${tDuLieu(don.khachHang)}${don.soDienThoai ? ` ${don.soDienThoai}` : ''}` : null,
    `${don.phuongThucGoc ? t(PHUONG_THUC_GOC[don.phuongThucGoc] ?? don.phuongThucGoc) : ''} ${formatMoney(don.tongCong)}`.trim(),
  ].filter(Boolean);
  return (
    <div className="shrink-0 space-y-1 border-b border-bo-border px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tabular-nums text-bo-heading">{don.soDonHang}</h2>
        {don.quaHan
          ? <TrangThai tone="late">{t("Quá hạn 03 ngày")}</TrangThai>
          : <TrangThai tone="ok">{conNgay > 0 ? t("Trong hạn · còn {{n}} ngày", { n: conNgay }) : t("Trong hạn · hết hạn hôm nay")}</TrangThai>}
        {don.traCheo ? <TrangThai tone="info">{t("Trả chéo từ {{kho}}", { kho: tDuLieu(don.khoBan) })}</TrangThai> : null}
        {don.trangThaiTraHang === 'tra_mot_phan' ? <TrangThai tone="mute">{t("Đã trả một phần")}</TrangThai> : null}
      </div>
      <p className="text-[13px] text-bo-muted">{thongTin.join(' · ')}</p>
    </div>
  );
}

function AnhSanPham({ src, size = 'size-11' }) {
  return src ? (
    <img alt="" className={`${size} shrink-0 rounded-md border border-bo-border object-cover`} src={src} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-md border border-bo-border bg-bo-surface-subtle text-bo-muted`}><PackageOpen aria-hidden="true" size={16} /></span>
  );
}

const bienThe = (d) => [d.mauSac, d.kichCo].filter(Boolean).map((x) => tDuLieu(x)).join(' / ');

/** Một món trên hóa đơn gốc, cùng nhịp dòng danh mục của màn bán; nút Trả đưa món sang phiếu trả. */
function DongHoaDon({ d, dangChon, onChon }) {
  const het = conTra(d) === 0;
  const giamGia = Number(d.donGiaNiemYet) > Number(d.donGiaThucTra);
  return (
    <li className={`grid grid-cols-[44px_minmax(0,1fr)_84px] items-center gap-3 px-4 py-2.5 md:grid-cols-[44px_minmax(0,1fr)_128px_112px_84px] md:gap-4 ${dangChon ? 'bg-blue-50/50' : ''}`}>
      <AnhSanPham src={d.anh} />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{tDuLieu(d.tenSanPham)}</p>
        <p className="truncate text-xs text-bo-muted">{[bienThe(d), d.maSku].filter(Boolean).join(' · ')}</p>
        <p className="text-xs tabular-nums text-bo-muted md:hidden">
          {t("Mua {{mua}} · Đã trả {{tra}}", { mua: Number(d.soLuongMua), tra: Number(d.soLuongDaTra) })} · {formatMoney(d.donGiaThucTra)}
        </p>
      </div>
      <p className="hidden text-xs tabular-nums text-bo-muted md:block">
        {t("Mua")} <span className="font-medium text-bo-foreground">{Number(d.soLuongMua)}</span> · {t("Đã trả")} <span className="font-medium text-bo-foreground">{Number(d.soLuongDaTra)}</span>
      </p>
      <p className="hidden text-right tabular-nums md:block">
        <span className="block text-sm font-semibold text-bo-primary">{formatMoney(d.donGiaThucTra)}</span>
        {giamGia ? <span className="block text-[11px] text-bo-muted line-through">{formatMoney(d.donGiaNiemYet)}</span> : null}
      </p>
      <button
        aria-label={het ? t("Đã trả hết") : dangChon ? t("Bỏ {{sku}} khỏi phiếu trả", { sku: d.maSku }) : t("Trả {{sku}}", { sku: d.maSku })}
        aria-pressed={het ? undefined : dangChon}
        className={`h-8 rounded-md border text-[13px] font-medium transition disabled:cursor-default ${het
          ? 'border-bo-border bg-bo-surface-subtle text-bo-muted'
          : dangChon ? 'border-bo-primary bg-bo-primary text-white hover:bg-bo-primary-hover' : 'border-bo-border bg-bo-surface hover:border-bo-primary hover:text-bo-primary'}`}
        disabled={het}
        onClick={() => onChon(!dangChon)}
        type="button"
      >
        {het ? t("Đã trả") : dangChon ? t("Đã chọn") : t("Trả")}
      </button>
    </li>
  );
}

/** Một món trên phiếu trả: số lượng, hiện trạng QC, kệ cất / nhóm lỗi, lý do (đặc tả BA V.2). */
function MonTra({ d, c, ke, khoCoKe, loi, daBamXacNhan, onCapNhat }) {
  if (!c) return null;
  const toiDa = conTra(d);
  const sl = Number(c.soLuong) || 0;
  const laLoi = c.tinhTrang === QC_LOI;
  const hien = (k) => loi?.[k] && (k === 'soLuong' ? (loi.soLuong === 'vuot' || daBamXacNhan) : daBamXacNhan);
  const id = `mon-tra-${d.chiTietId}`;
  const chonO = (ma, gt, ds, ph, dich = true) => (
    <select
      aria-label={ph}
      className={`h-8 w-full min-w-0 rounded-md border bg-bo-surface px-2 text-xs outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 ${hien(ma) ? 'border-red-400' : 'border-bo-input-border'}`}
      id={`${id}-${ma}`}
      onChange={(e) => onCapNhat({ [ma === 'ke' ? 'viTriKhoId' : ma]: ma === 'ke' ? (e.target.value ? Number(e.target.value) : null) : e.target.value })}
      value={gt ?? ''}
    >
      <option value="">{ph}</option>
      {ds.map(([v, nhan]) => <option key={v} value={v}>{dich ? t(nhan) : nhan}</option>)}
    </select>
  );
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <AnhSanPham size="size-9" src={d.anh} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-medium leading-5">{tDuLieu(d.tenSanPham)}</p>
          <p className="truncate text-[11px] text-bo-muted">{bienThe(d) || d.maSku}</p>
        </div>
        <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums">{formatMoney(tienHoanDong(d, Math.min(sl, toiDa)))}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-[30px] items-center rounded-md border border-bo-border">
          <button aria-label={t("Giảm số lượng")} className="grid size-7 place-items-center text-bo-muted disabled:opacity-30" disabled={sl <= 1} onClick={() => onCapNhat({ soLuong: Math.max(1, sl - 1) })} type="button"><Minus aria-hidden="true" size={13} /></button>
          <input
            aria-invalid={Boolean(hien('soLuong'))}
            aria-label={t("Số lượng trả {{sku}}", { sku: d.maSku })}
            className="h-7 w-8 bg-transparent text-center text-[13px] font-semibold tabular-nums outline-none"
            inputMode="numeric"
            onChange={(e) => onCapNhat({ soLuong: e.target.value.replace(/\D/g, '') })}
            value={c.soLuong}
          />
          <button aria-label={t("Tăng số lượng")} className="grid size-7 place-items-center text-bo-muted disabled:opacity-30" disabled={sl >= toiDa} onClick={() => onCapNhat({ soLuong: Math.min(toiDa, sl + 1) })} type="button"><Plus aria-hidden="true" size={13} /></button>
        </span>
        <span aria-label={t("Hiện trạng (QC)")} className="inline-flex h-[30px] rounded-md border border-bo-border p-0.5" role="radiogroup">
          {[[QC_DAT, t("Đạt"), 'bg-bo-success-soft text-bo-success'], [QC_LOI, t("Lỗi"), 'bg-bo-danger-soft text-bo-danger']].map(([gt, nhan, mau]) => (
            <button
              aria-checked={c.tinhTrang === gt}
              className={`rounded px-2.5 text-xs transition ${c.tinhTrang === gt ? `${mau} font-semibold` : 'font-medium text-bo-muted hover:text-bo-foreground'}`}
              key={gt}
              onClick={() => onCapNhat({ tinhTrang: gt })}
              role="radio"
              type="button"
            >
              {nhan}
            </button>
          ))}
        </span>
        <button aria-label={t("Bỏ {{sku}} khỏi phiếu trả", { sku: d.maSku })} className="ml-auto grid size-7 place-items-center rounded text-bo-muted transition hover:bg-bo-danger-soft hover:text-bo-danger" onClick={() => onCapNhat({ chon: false })} type="button">
          <X aria-hidden="true" size={14} />
        </button>
      </div>
      {hien('soLuong') ? (
        <p className="text-xs text-bo-danger" role="alert">
          {loi.soLuong === 'vuot'
            ? t("Số lượng trả không thể vượt quá số lượng khách đã mua trừ đi lượng đã trả!")
            : t("Nhập số lượng từ 1 đến {{n}}.", { n: toiDa })}
        </p>
      ) : null}
      <div className={`grid gap-2 ${laLoi || khoCoKe ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {laLoi
          ? chonO('nhomLoi', c.nhomLoi, NHOM_LOI, t("Chọn nhóm lỗi"))
          : khoCoKe ? chonO('ke', c.viTriKhoId, ke.map((k) => [k.id, k.ma]), t("Chọn kệ cất"), false) : null}
        {chonO('lyDo', c.lyDo, LY_DO_TRA, t("Chọn lý do"))}
      </div>
    </li>
  );
}

function ThongTinChuyenKhoan({ ck, loi, hienLoi, onChange }) {
  const sai = (k) => hienLoi && loi.includes(k);
  const o = (k, nhan, props = {}) => (
    <label className="min-w-0 text-[11px] text-bo-muted">
      {nhan}
      <input
        className={`mt-0.5 h-8 w-full min-w-0 rounded-md border bg-bo-surface px-2 text-xs text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 ${sai(k) ? 'border-red-400' : 'border-bo-input-border'}`}
        onChange={(e) => onChange({ [k]: k === 'soTaiKhoan' ? e.target.value.replace(/\D/g, '') : e.target.value })}
        value={ck[k]}
        {...props}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {o('nganHang', t("Ngân hàng"), { list: 'ds-ngan-hang', maxLength: 100 })}
      <datalist id="ds-ngan-hang">{NGAN_HANG.map((n) => <option key={n} value={n} />)}</datalist>
      {o('soTaiKhoan', t("Số tài khoản"), { inputMode: 'numeric', maxLength: 20 })}
      {o('tenChuTaiKhoan', t("Chủ tài khoản"), { maxLength: 100 })}
      {o('maGiaoDich', t("Mã giao dịch"), { maxLength: 100 })}
    </div>
  );
}

/** Hoàn tất: biên lai bên trái, xem trước biên bản 02 liên bên phải. */
// i18n-giu-nguyen: nhãn liên in trên giấy (mẫu in giữ tiếng Việt)
const LIEN_XEM_TRUOC = "1 · Giao khách hàng giữ";

function HoanTat({ ketQua, onIn, onLamMoi, onVeBanHang }) {
  // Xem trước đúng bản sẽ in: mẫu đang dùng của Biên bản trả hàng + Thông tin cửa hàng (như trang in)
  const [xem, setXem] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      traHangService.phieu(ketQua.phieuTraHangId, { signal: ctrl.signal }),
      printTemplateConfigService.getActiveTemplate('pos_return'),
      companyProfileService.get(),
    ]).then(([phieu, config, company]) => {
      if (!ctrl.signal.aborted && phieu && config) setXem({ model: { ...toPosReturnPrintModel(phieu), copy: LIEN_XEM_TRUOC }, config, company });
    }).catch(() => {});
    return () => ctrl.abort();
  }, [ketQua.phieuTraHangId]);
  const giay = xem ? { size: xem.config.paperSize, orientation: xem.config.orientation, margin: xem.config.margin } : null;
  return (
    <main className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
      <section className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-bo-border bg-bo-surface p-8 text-center">
        <span className="mb-1 grid size-13 place-items-center rounded-full bg-bo-success-soft text-bo-success"><Check aria-hidden="true" size={26} strokeWidth={2.5} /></span>
        <h2 className="text-lg font-semibold text-bo-heading">{t("Đã hoàn tất trả hàng")}</h2>
        <p className="text-[13px] tabular-nums text-bo-muted">{[ketQua.soPhieu, ketQua.soPhieuNhap].filter(Boolean).join(' · ')}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{formatMoney(ketQua.tongTienHoan)}</p>
        <p className="text-[13px] text-bo-muted">{ketQua.phuongThucHoan === HOAN_CHUYEN_KHOAN ? t("Đã hoàn bằng chuyển khoản") : t("Chi tiền mặt cho khách")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className={secondaryButton} onClick={onIn} type="button"><Printer aria-hidden="true" size={16} />{t("In lại biên bản")}</button>
          <button className={secondaryButton} onClick={onLamMoi} type="button">{t("Trả đơn khác")}</button>
          <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-bo-primary px-4 text-sm font-semibold text-white hover:bg-bo-primary-hover" onClick={onVeBanHang} type="button">{t("Về bán hàng")}</button>
        </div>
      </section>
      <section aria-label={t("Biên bản trả hàng")} className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface lg:min-h-0">
        <div className="flex shrink-0 items-center justify-between border-b border-bo-border px-4 py-3">
          <p className="text-sm font-semibold">{t("Biên bản trả hàng")}</p>
          <span className="text-xs text-bo-muted">{giay ? t("{{kho}} · 02 liên", { kho: giay.size }) : null}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-bo-canvas p-4">
          {xem ? (
            <div
              className={`mx-auto bg-white shadow-sm ${getPaperSheetClasses(giay)}`}
              style={{ zoom: Math.min(1, 380 / getPaperSheetWidthPx(giay)) }}
            >
              <PrintTemplateDocument company={xem.company} config={xem.config} documentType="pos_return" model={xem.model} />
            </div>
          ) : <LoadingState label={t("Đang tải biên bản")} />}
        </div>
      </section>
    </main>
  );
}

function ChinhSachModal({ onClose }) {
  const muc = [
    t("Trong vòng 03 ngày kể từ lúc thanh toán (in trên hóa đơn gốc). Quá hạn cần quản lý cửa hàng duyệt."),
    t("Sản phẩm còn nguyên tem mác, chưa qua sử dụng, chưa giặt ủi, không ám mùi, không dính bẩn."),
    t("Bắt buộc tra được hóa đơn gốc đã thanh toán trên hệ thống."),
    t("Trả được ở mọi cửa hàng: hàng nhập vào kho cửa hàng nhận trả, doanh thu giảm ở cửa hàng đã bán."),
    t("Hoàn theo giá khách thực trả trên từng sản phẩm, bằng tiền mặt hoặc chuyển khoản."),
    t("Hàng Đạt cất lên kệ và mở bán lại ngay; hàng Lỗi để riêng, không cộng tồn."),
  ];
  return (
    <PosModal onClose={onClose} size="sm" title={t("Chính sách trả hàng")}
      footer={<div className="flex justify-end"><button className={secondaryButton} onClick={onClose} type="button">{t("Đã hiểu")}</button></div>}>
      <ul className="list-disc space-y-2 pl-5 text-sm text-bo-foreground">
        {muc.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </PosModal>
  );
}
