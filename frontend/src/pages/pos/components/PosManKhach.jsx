import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowDown, ArrowUp, Banknote, Clock, QrCode, RefreshCcw, SquareCheckBig, Store, UserRound } from 'lucide-react';
import PayosLogo from '@/components/shared/PayosLogo';
import { formatCount, formatMoney } from '../pos-format';
import { matDoDanhSach, trangThaiManKhach } from '../pos-man-khach';
import { hetHanTheoMay } from '../pos-payment';

/*
 * Cỡ chữ, khoảng cách viết bằng rem: trang màn hình phụ đặt cỡ chữ gốc theo cỡ cửa sổ (ManHinhKhachPage) nên cả màn
 * phóng to / thu nhỏ đúng tỉ lệ bản thiết kế 1366×768 (ngang) và 800×1280 (dọc).
 */

const LOGO = '/branding/f-centric-logo-light.svg';

/** Câu cho trình đọc màn hình theo trạng thái (không đọc từng giây của đồng hồ đếm ngược). */
const THONG_BAO = {
  trong: 'Chưa có hàng trong hóa đơn',
  gio: 'Hóa đơn của quý khách',
  qr: 'Mã QR chuyển khoản đã sẵn sàng',
  choMa: 'Đang chuẩn bị mã QR',
  hetGio: 'Mã đã hết hạn',
  maDong: 'Mã QR không còn dùng được',
  kiemTra: 'Đang xác nhận khoản chuyển',
  daNhan: 'Đã nhận đủ tiền, cảm ơn quý khách',
};

/** Ô thay chỗ mã QR khi không vẽ mã: tiêu đề, lời dặn, kiểu biểu tượng (khách không thấy lỗi kỹ thuật). */
const KHONG_MA = {
  hetGio: { tieuDe: 'Mã đã hết hạn', loi: 'Nếu quý khách vừa chuyển khoản, vui lòng chờ trong giây lát.', kieu: 'canhBao' },
  kiemTra: { tieuDe: 'Đang xác nhận khoản chuyển', loi: 'Quý khách vui lòng chờ trong giây lát.', kieu: 'cho' },
  EXPIRED: { tieuDe: 'Mã đã hết hạn', loi: 'Vui lòng không quét mã cũ. Nếu cần chuyển khoản, quý khách báo thu ngân tạo mã mới.', kieu: 'canhBao' },
  CANCELLED: { tieuDe: 'Mã đã được hủy', loi: 'Vui lòng không chuyển khoản theo mã này. Nếu cần mã mới, quý khách vui lòng báo thu ngân.', kieu: 'thuong' },
  FAILED: { tieuDe: 'Chưa tạo được mã', loi: 'Quý khách vui lòng báo thu ngân để tạo lại mã.', kieu: 'thuong' },
  REFUNDED: { tieuDe: 'Đã hoàn tiền chuyển khoản', loi: 'Tiền chuyển khoản đã được hoàn lại cho quý khách.', kieu: 'thuong' },
};

/** Khung bên phải: nền xám nhạt, viền trái (màn ngang) hoặc viền trên (màn dọc, khung nằm dưới danh sách). */
const KHUNG = 'flex min-h-0 flex-col border-bo-border bg-bo-canvas landscape:border-l portrait:border-t';

/** Số tiền nổi bật: số dài nhỏ bớt để không tràn khung (từ chục triệu một bậc, từ tỉ hai bậc). */
const coSoTien = (chu, lon, vua, nho) => (chu.length >= 15 ? nho : chu.length >= 12 ? vua : lon);

const dongHo = (ms) => {
  const giay = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(giay / 60)).padStart(2, '0')}:${String(giay % 60).padStart(2, '0')}`;
};

/**
 * Đồng hồ máy quầy, nhảy mỗi giây cho đồng hồ đếm ngược; thêm một nhịp đúng lúc `moc` (giờ hết hạn mã QR) để thôi vẽ
 * mã ngay tại 00:00, không trễ tới nhịp giây kế tiếp.
 */
function useBayGio(moc) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    // Mã mới tới: lấy lại giờ ngay (nhịp cũ trễ tới một giây — mã vừa quá hạn không được vẽ, mã 10 phút không hiện 10:01)
    const ngay = window.setTimeout(() => setNow(Date.now()), 0);
    const conLai = moc == null ? 0 : moc - Date.now();
    const id = conLai > 0 ? window.setTimeout(() => setNow(Date.now()), conLai + 1) : null;
    return () => {
      window.clearTimeout(ngay);
      if (id != null) window.clearTimeout(id);
    };
  }, [moc]);
  return now;
}

/**
 * Mép vùng danh sách còn món khuất (khách không tự cuộn được màn hình): dải mờ dần che dòng bị cắt dở + nhãn
 * "Còn N mặt hàng phía trên / dưới".
 */
function NhanConNua({ so, phia }) {
  if (!so) return null;
  const tren = phia === 'tren';
  const Icon = tren ? ArrowUp : ArrowDown;
  return (
    <div className={`pointer-events-none absolute inset-x-0 z-10 flex h-16 justify-center ${tren ? 'top-0 items-start bg-linear-to-b' : 'bottom-0 items-end bg-linear-to-t'} from-bo-surface from-35% to-transparent`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-bo-foreground px-3.5 py-1 text-[0.875rem] font-semibold text-white ${tren ? 'mt-1.5' : 'mb-1.5'}`}>
        <Icon aria-hidden="true" className="size-4" strokeWidth={2.2} />Còn {so} mặt hàng phía {tren ? 'trên' : 'dưới'}
      </span>
    </div>
  );
}

/**
 * Danh sách hàng — gương của giỏ thu ngân: cùng thứ tự dòng, cùng số, có số thứ tự để khách chỉ được "dòng 3 sai".
 * Ít món: mỗi món hai tầng (tên; màu · cỡ · đơn giá). Nhiều món: mỗi món một dòng. Nơi gọi đặt key theo số hóa đơn:
 * đổi hóa đơn thì vẽ lại từ đầu (cuộn về món cuối, không tô món nào).
 * `coTongCuoi`: khung bên phải đang là mã QR / kết quả nên tổng tiền hàng nằm ở chân danh sách; lúc đó cũng thôi tô
 * món vừa thêm (khách đang trả tiền, không còn quét hàng).
 */
function DanhSachHang({ noiDung, coTongCuoi }) {
  const { dong, soLuong, tongTienHang } = noiDung;
  const gon = matDoDanhSach(dong.length) === 'gon';
  const cuonRef = useRef(null);

  // Món vừa thêm / tăng số lượng (thu ngân quét tiếp): so với lần vẽ trước ngay lúc vẽ. Mỗi lần đổi là một đối tượng
  // mới nên quét cùng một món hai lần liền vẫn cuộn lại tới món đó. Giảm số lượng không phải "vừa thêm".
  const [dongTruoc, setDongTruoc] = useState(dong);
  const [moiNhat, setMoiNhat] = useState(null); // { id }
  if (dongTruoc !== dong) {
    setDongTruoc(dong);
    const cu = new Map(dongTruoc.map((d) => [d.id, d.soLuong]));
    const them = dong.filter((d) => !cu.has(d.id) || d.soLuong > cu.get(d.id));
    if (them.length) setMoiNhat({ id: them[them.length - 1].id });
    // Chỉ bớt / xóa món: thôi tô món cũ (nhãn "Vừa thêm" không còn đúng với thao tác vừa rồi)
    else if (dong.length !== dongTruoc.length || dong.some((d) => cu.get(d.id) !== d.soLuong)) setMoiNhat(null);
  }
  // Sang bước trả tiền: thôi tô món cũ (thu ngân hủy mã quay về giỏ không thấy lại nhãn "Vừa thêm" của lần quét trước)
  if (coTongCuoi && moiNhat) setMoiNhat(null);

  // Số mặt hàng đang khuất phía trên / dưới vùng nhìn thấy
  const [an, setAn] = useState({ tren: 0, duoi: 0 });
  const demAn = useCallback(() => {
    const vung = cuonRef.current;
    if (!vung) return;
    // Dòng nằm dưới dải mờ ở mép (cao 4rem, nhãn ở 3rem đầu) cũng tính là khuất: khách không đọc được dòng đó
    const mo = 3 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const tren = vung.scrollTop;
    const duoi = tren + vung.clientHeight;
    const cuoiCung = vung.scrollHeight - vung.clientHeight;
    let soTren = 0;
    let soDuoi = 0;
    vung.querySelectorAll('[data-dong]').forEach((li) => {
      const giua = li.offsetTop + li.offsetHeight / 2;
      if (giua < tren + (tren > 0 ? mo : 0)) soTren += 1;
      else if (giua > duoi - (tren < cuoiCung - 1 ? mo : 0)) soDuoi += 1;
    });
    setAn((cu) => (cu.tren === soTren && cu.duoi === soDuoi ? cu : { tren: soTren, duoi: soDuoi }));
  }, []);

  // Mở màn khi giỏ đã dài: bắt đầu ở các món mới nhất (cuối danh sách)
  useLayoutEffect(() => {
    if (cuonRef.current) cuonRef.current.scrollTop = cuonRef.current.scrollHeight;
  }, []);
  // Vùng nhìn thấy đổi cỡ / danh sách dài ra: đếm lại món khuất
  useEffect(() => {
    const vung = cuonRef.current;
    if (!vung || typeof ResizeObserver !== 'function') return undefined;
    const quanSat = new ResizeObserver(demAn);
    quanSat.observe(vung);
    if (vung.firstElementChild) quanSat.observe(vung.firstElementChild);
    return () => quanSat.disconnect();
  }, [demAn]);
  useEffect(() => {
    // Đưa món vào giữa vùng nhìn: không nằm dưới dải mờ ở mép (món cuối thì tự sát đáy vì không cuộn quá được)
    if (moiNhat) cuonRef.current?.querySelector(`[data-dong="${CSS.escape(moiNhat.id)}"]`)?.scrollIntoView({ block: 'center' });
  }, [moiNhat]);

  return (
    <section aria-label="Danh sách hàng" className="flex min-h-0 flex-col px-9 pb-6 pt-7 portrait:px-7 portrait:pb-4">
      <div className="flex shrink-0 items-baseline justify-between gap-4 px-3.5 pb-3.5">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.01em]">Hóa đơn của quý khách</h1>
        {/* "mặt hàng" (số dòng) tách với số sản phẩm như giỏ hàng của thu ngân */}
        <span className="shrink-0 text-[1.0625rem] text-bo-muted">{dong.length} mặt hàng · {formatCount(soLuong)} sản phẩm</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <NhanConNua phia="tren" so={an.tren} />
        {/* Không hiện thanh cuộn trên màn khách (vẫn cuộn được bằng chuột / chạm) */}
        <div className="relative h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onScroll={demAn} ref={cuonRef}>
          {/* Một lưới chung cho cả danh sách (mỗi dòng là lưới con): cột số lượng, thành tiền giãn theo số dài nhất mà
              mọi dòng vẫn thẳng cột */}
          <ol className={`grid gap-x-3 ${gon ? 'grid-cols-[2.125rem_minmax(0,1fr)_minmax(3.5rem,auto)_minmax(8rem,auto)]' : 'grid-cols-[2.125rem_minmax(0,1fr)_minmax(3.5rem,auto)_minmax(8.75rem,auto)] gap-y-1'}`}>
            {dong.map((d, i) => {
              const moi = !coTongCuoi && moiNhat?.id === d.id;
              return gon ? (
                <li
                  className={`col-span-full grid h-[3.125rem] grid-cols-subgrid items-center rounded-xl px-3.5 tabular-nums transition-colors duration-700 motion-reduce:transition-none ${moi ? 'bg-bo-primary-soft' : i % 2 ? '' : 'bg-bo-surface-subtle'}`}
                  data-dong={d.id}
                  key={d.id}
                >
                  <span className="text-[0.9375rem] text-slate-500">{i + 1}</span>
                  <span className="min-w-0 truncate text-[1.125rem]">
                    <span className="font-semibold">{d.ten}</span>
                    {d.bienThe ? <span className="text-bo-muted"> · {d.bienThe}</span> : null}
                  </span>
                  <span className="text-right text-[1.125rem] font-semibold">×{formatCount(d.soLuong)}</span>
                  <span className="whitespace-nowrap text-right text-[1.125rem] font-semibold">{formatMoney(d.thanhTien)}</span>
                </li>
              ) : (
                <li
                  className={`col-span-full grid grid-cols-subgrid items-center rounded-[0.875rem] px-4 py-3.5 tabular-nums transition-colors duration-700 motion-reduce:transition-none ${moi ? 'bg-bo-primary-soft' : 'shadow-[inset_0_-1px_0_#edf1f5]'}`}
                  data-dong={d.id}
                  key={d.id}
                >
                  <span className="text-base text-slate-500">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="truncate text-[1.25rem] font-semibold">{d.ten}</span>
                      {moi ? <span className="shrink-0 rounded-full bg-bo-primary px-2.5 py-0.5 text-[0.8125rem] font-semibold text-white">Vừa thêm</span> : null}
                    </div>
                    <p className="mt-1 truncate text-base text-bo-muted">{[d.bienThe, formatMoney(d.donGia)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="text-right text-[1.1875rem] font-semibold">×{formatCount(d.soLuong)}</span>
                  <span className="whitespace-nowrap text-right text-[1.3125rem] font-semibold">{formatMoney(d.thanhTien)}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <NhanConNua phia="duoi" so={an.duoi} />
      </div>
      {/* Giỏ trống mà còn mã (nháp cũ): không ghi "Tổng tiền hàng 0 ₫" cạnh số phải trả theo mã */}
      {coTongCuoi && dong.length ? (
        <div className="flex shrink-0 items-baseline justify-between border-t border-bo-border px-3.5 pt-4 text-[1.1875rem] text-slate-600 portrait:hidden">
          <span>Tổng tiền hàng</span>
          <span className="whitespace-nowrap font-semibold tabular-nums text-bo-foreground">{formatMoney(tongTienHang)}</span>
        </div>
      ) : null}
    </section>
  );
}

/** Một dòng nhãn — số tiền (chữ thường). */
function DongTien({ nhan, so, className = 'text-[1.1875rem]', soClassName = 'font-semibold' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 text-slate-600 ${className}`}>
      <span>{nhan}</span>
      <span className={`whitespace-nowrap tabular-nums text-bo-foreground ${soClassName}`}>{so}</span>
    </div>
  );
}

/** Đang giỏ hàng: tổng tiền hàng, giảm giá (khi có), khách cần trả, lời nhắc kiểm tra hàng. */
function PhanGio({ noiDung }) {
  const { tongTienHang, giamGia, tong } = noiDung;
  const chuTong = formatMoney(tong);
  return (
    <aside aria-label="Thanh toán" className={`${KHUNG} gap-[1.375rem] px-10 pb-8 pt-9 portrait:gap-4 portrait:pb-9 portrait:pt-7`}>
      <DongTien nhan="Tổng tiền hàng" so={formatMoney(tongTienHang)} />
      {giamGia > 0 ? <DongTien nhan="Giảm giá" so={`−${formatMoney(giamGia)}`} /> : null}
      <div className="h-px shrink-0 bg-[#dde3ea]" />
      <div className="flex flex-col gap-1.5 portrait:flex-row portrait:items-baseline portrait:justify-between portrait:gap-4">
        <span className="text-[1.25rem] text-slate-600">Khách cần trả</span>
        <span className={`whitespace-nowrap font-bold leading-[1.05] tracking-[-0.02em] tabular-nums ${coSoTien(chuTong, 'text-[4rem]', 'text-[3.25rem]', 'text-[2.75rem]')}`}>{chuTong}</span>
      </div>
      <div className="mt-auto flex items-start gap-3.5 rounded-[0.875rem] border border-bo-border bg-bo-surface px-5 py-[1.125rem] portrait:mt-1">
        <SquareCheckBig aria-hidden="true" className="mt-px size-[1.625rem] shrink-0 text-bo-primary" strokeWidth={1.8} />
        <p className="text-[1.125rem] leading-[1.45] text-slate-600">Quý khách vui lòng kiểm tra tên hàng, số lượng và giá trước khi thanh toán.</p>
      </div>
    </aside>
  );
}

/** Thu tiền mặt (khách đưa nhiều hơn tổng): khách cần trả, khách đưa, tiền thừa nổi bật. */
function PhanTienMat({ noiDung }) {
  const { tong, tienMat } = noiDung;
  const chuThua = formatMoney(tienMat.tienThua);
  return (
    <aside aria-label="Thanh toán" className={`${KHUNG} gap-5 px-10 pb-8 pt-9 portrait:pt-7`}>
      <span className="inline-flex items-center gap-2 self-start rounded-full border border-bo-border bg-bo-surface px-3.5 py-1.5 text-base font-semibold text-slate-600">
        <Banknote aria-hidden="true" className="size-5" strokeWidth={1.8} />Thanh toán tiền mặt
      </span>
      <DongTien className="text-[1.25rem]" nhan="Khách cần trả" so={formatMoney(tong)} soClassName="text-[1.875rem] font-bold" />
      <DongTien className="text-[1.25rem]" nhan="Khách đưa" so={formatMoney(tienMat.khachDua)} soClassName="text-[1.875rem] font-bold" />
      <div className="h-px shrink-0 bg-[#dde3ea]" />
      <div className="flex flex-col gap-2 rounded-[1.125rem] border border-bo-border bg-bo-surface px-6 py-[1.375rem] shadow-[0_1px_2px_rgba(24,37,55,0.06)]">
        <span className="text-[1.25rem] text-slate-600">Tiền thừa trả quý khách</span>
        {/* Căn phải, thẳng cột với các số phía trên: tiền thừa ít không để trống lệch một bên */}
        <span className={`self-end whitespace-nowrap font-bold leading-[1.05] tracking-[-0.02em] tabular-nums ${coSoTien(chuThua, 'text-[3.75rem]', 'text-[3rem]', 'text-[2.5rem]')}`}>{chuThua}</span>
      </div>
      <p className="mt-auto text-[1.0625rem] leading-[1.45] text-bo-muted">Quý khách vui lòng nhận lại tiền thừa và kiểm tra trước khi rời quầy.</p>
    </aside>
  );
}

/** Trả kết hợp: khách cần trả và phần tiền mặt đã nhận, phía trên mã QR phần còn lại. */
function TomTatKetHop({ tong, tienMatTruoc }) {
  return (
    <div className="flex shrink-0 flex-col gap-1.5 self-stretch rounded-[0.875rem] border border-bo-border bg-bo-surface px-4 py-3">
      <DongTien className="text-[1.0625rem]" nhan="Khách cần trả" so={formatMoney(tong)} />
      <DongTien className="text-[1.0625rem]" nhan="Đã nhận tiền mặt" so={`−${formatMoney(tienMatTruoc)}`} />
    </div>
  );
}

/**
 * Đồng hồ đếm ngược của mã: 30 giây cuối chỉ đổi màu cảnh báo, chữ giữ nguyên độ dài — đổi chữ làm tiêu đề bên cạnh
 * xuống dòng, mã QR bị đẩy xuống ngay lúc khách đang quét.
 */
function DemNguoc({ conLaiMs, sapHet }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-base font-semibold tabular-nums ${sapHet ? 'border-amber-300 bg-bo-warning-soft text-amber-800' : 'border-bo-border bg-bo-surface text-slate-600'}`}>
      <Clock aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
      Còn {dongHo(conLaiMs)}
    </span>
  );
}

/**
 * Ô mã QR. Hoạt ảnh làm mờ hẳn đúng giờ hết hạn `het` (index.css) chạy cả khi trang bị treo. Độ trễ tính MỘT lần lúc
 * vẽ mã, từ giờ hết hạn tuyệt đối và giờ hiện tại (nơi gọi đặt key theo mã + giờ hết hạn): đổi animation-delay khi hoạt
 * ảnh đang chạy không khởi động lại mà tính từ lúc bắt đầu cũ — cập nhật mỗi giây theo đồng hồ đếm ngược sẽ làm mã mờ
 * đi khi mới được nửa thời gian; lấy theo nhịp đồng hồ trước đó thì trễ tới gần một giây.
 */
function OMaQr({ maQr, het, co }) {
  const [treMs] = useState(() => (het == null ? null : Math.max(0, het - Date.now())));
  return (
    <div className={co} style={treMs != null ? { animation: `pos-an-ma-qr 1ms linear ${treMs}ms forwards` } : undefined}>
      <QRCodeSVG level="M" marginSize={1} size={320} style={{ display: 'block', height: '100%', width: '100%' }} value={maQr} />
    </div>
  );
}

/** Mã QR đang chờ (hoặc đang tạo): mã trong thẻ trắng, số tiền chuyển khoản, chủ tài khoản. */
function PhanMaQr({ noiDung, trangThai }) {
  const { qr } = noiDung;
  const ketHop = qr.tienMatTruoc > 0 && !qr.traLaiTienMat;
  // Giỏ trống mà còn mã (nháp cũ): khách cần trả lấy theo mã
  const tong = noiDung.dong.length ? noiDung.tong : qr.soTien + qr.tienMatTruoc;
  const coMa = ketHop ? 'size-[14.75rem] portrait:size-[23.75rem]' : 'size-[17rem] portrait:size-[23.75rem]';
  const het = hetHanTheoMay(qr);
  const chuSoTien = formatMoney(qr.soTien);
  return (
    <aside aria-label="Thanh toán chuyển khoản" className={`${KHUNG} items-center gap-3.5 px-10 pb-6 pt-[1.625rem] portrait:gap-4 portrait:px-12 portrait:pb-9 portrait:pt-[1.875rem]`}>
      {ketHop ? <TomTatKetHop tienMatTruoc={qr.tienMatTruoc} tong={tong} /> : null}
      <div className="flex shrink-0 items-center justify-between gap-3 self-stretch">
        <h2 className="min-w-0 truncate text-[1.5rem] font-semibold">{ketHop ? 'Còn lại — quét mã' : 'Quét mã để chuyển khoản'}</h2>
        {trangThai.loai === 'qr' && trangThai.conLaiMs != null ? <DemNguoc conLaiMs={trangThai.conLaiMs} sapHet={trangThai.sapHet} /> : null}
      </div>
      {/* Nền trắng cố định cho mã (kể cả khi giao diện tối): camera điện thoại đọc chắc hơn */}
      <div className="flex shrink-0 flex-col items-center gap-3 rounded-[1.25rem] border border-bo-border bg-white px-[1.125rem] pb-3.5 pt-[1.125rem] shadow-[0_1px_2px_rgba(24,37,55,0.06)]">
        {trangThai.loai === 'qr' ? (
          <OMaQr co={coMa} het={het} key={`${qr.maQr}|${het}`} maQr={qr.maQr} />
        ) : (
          <div className={`${coMa} flex flex-col items-center justify-center gap-3 text-bo-muted`}>
            <RefreshCcw aria-hidden="true" className="size-9 motion-safe:animate-spin" strokeWidth={1.8} />
            <span className="text-[1.125rem]">Đang chuẩn bị mã…</span>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <span className="text-[0.9375rem] text-bo-muted">Thanh toán qua</span>
          <PayosLogo className="h-[1.375rem] w-auto" height={40} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-[1.125rem] text-slate-600">Số tiền chuyển khoản</span>
        <span className={`whitespace-nowrap font-bold leading-[1.1] tracking-[-0.02em] tabular-nums ${ketHop ? coSoTien(chuSoTien, 'text-[2.625rem]', 'text-[2.25rem]', 'text-[1.875rem]') : coSoTien(chuSoTien, 'text-[2.875rem]', 'text-[2.5rem]', 'text-[2.125rem]')}`}>{chuSoTien}</span>
      </div>
      {qr.tenTaiKhoan ? (
        <p className="shrink-0 text-center text-[1.0625rem] text-slate-600">Chủ tài khoản: <strong className="font-semibold text-bo-foreground">{qr.tenTaiKhoan}</strong></p>
      ) : null}
      {qr.traLaiTienMat ? (
        <TraLaiTienMat tien={qr.tienMatTruoc} />
      ) : !ketHop ? (
        <p className="mt-auto text-center text-[0.9375rem] leading-[1.45] text-bo-muted">Mở ứng dụng ngân hàng, quét mã và xác nhận. Số tiền và nội dung đã có sẵn trong mã.</p>
      ) : null}
    </aside>
  );
}

/** Mã không thành mà khách đã đưa trước tiền mặt: báo sẽ được trả lại (không hiện "đã nhận / còn lại" mâu thuẫn). */
function TraLaiTienMat({ tien }) {
  return (
    <p className="shrink-0 self-stretch rounded-[0.875rem] border border-amber-300 bg-bo-warning-soft px-4 py-3 text-[1.125rem] text-amber-900">
      Thu ngân sẽ trả lại quý khách <strong className="font-bold tabular-nums">{formatMoney(tien)}</strong> tiền mặt.
    </p>
  );
}

/** Mã vừa hết giờ / đã đóng / đang xác nhận tiền: ô viền đứt thay chỗ mã, không vẽ mã. */
function PhanKhongMa({ noiDung, trangThai }) {
  const { qr } = noiDung;
  const ketHop = qr.tienMatTruoc > 0 && !qr.traLaiTienMat;
  const tong = noiDung.dong.length ? noiDung.tong : qr.soTien + qr.tienMatTruoc;
  const o = KHONG_MA[trangThai.loai] || KHONG_MA[trangThai.trangThai] || KHONG_MA.CANCELLED;
  // Đang xác nhận tiền / mã vừa hết giờ: khách có thể đã chuyển — ghi số chuyển khoản, không ghi "Khách cần trả" như
  // còn nợ tiền
  const dangCho = trangThai.loai === 'kiemTra' || trangThai.loai === 'hetGio';
  const nhan = dangCho ? 'Số tiền chuyển khoản' : ketHop ? 'Phần chuyển khoản' : 'Khách cần trả';
  const chuSoTien = formatMoney(dangCho || ketHop ? qr.soTien : tong);
  return (
    <aside aria-label="Thanh toán chuyển khoản" className={`${KHUNG} items-center gap-4 px-10 pb-6 pt-[1.625rem] portrait:pb-9`}>
      {ketHop ? <TomTatKetHop tienMatTruoc={qr.tienMatTruoc} tong={tong} /> : null}
      <h2 className="shrink-0 self-stretch text-[1.5rem] font-semibold">Chuyển khoản</h2>
      <div className="flex w-[19.25rem] max-w-full shrink-0 flex-col items-center justify-center gap-3.5 rounded-[1.25rem] border-2 border-dashed border-[#cfd7e1] bg-bo-surface px-7 py-8 text-center">
        <span className={`grid size-16 place-items-center rounded-full ${o.kieu === 'canhBao' ? 'bg-bo-warning-soft text-amber-700' : o.kieu === 'cho' ? 'bg-bo-primary-soft text-bo-primary' : 'bg-bo-canvas text-bo-muted'}`}>
          {o.kieu === 'cho' ? (
            <RefreshCcw aria-hidden="true" className="size-8 motion-safe:animate-spin" strokeWidth={1.8} />
          ) : o.kieu === 'canhBao' ? (
            <Clock aria-hidden="true" className="size-[2.125rem]" strokeWidth={1.8} />
          ) : (
            <QrCode aria-hidden="true" className="size-8" strokeWidth={1.8} />
          )}
        </span>
        <p className="text-[1.5rem] font-semibold">{o.tieuDe}</p>
        <p className="text-[1.0625rem] leading-normal text-slate-600">{o.loi}</p>
      </div>
      {qr.traLaiTienMat ? (
        <TraLaiTienMat tien={qr.tienMatTruoc} />
      ) : (
        <div className="flex shrink-0 flex-col items-center">
          <span className="text-[1.125rem] text-slate-600">{nhan}</span>
          <span className={`whitespace-nowrap font-bold leading-[1.1] tracking-[-0.02em] tabular-nums ${coSoTien(chuSoTien, 'text-[2.875rem]', 'text-[2.5rem]', 'text-[2.125rem]')}`}>{chuSoTien}</span>
        </div>
      )}
    </aside>
  );
}

/**
 * Dấu tích "Đã nhận đủ" (index.css, chạy một lần): vòng chờ quay rồi khép kín, dấu tích vẽ bên trong, vòng giữ thêm
 * khoảng một giây rồi tan — lúc đứng yên chỉ còn dấu tích, không viền.
 */
function DauTich() {
  return (
    <svg aria-hidden="true" className="size-[6.5rem] shrink-0 text-bo-primary" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={5} viewBox="0 0 64 64">
      <circle className="mk-tich-vong" cx="32" cy="32" r="26" strokeWidth={3.5} />
      <path className="mk-tich-net" d="M17 33 L28 44 L47 22" />
    </svg>
  );
}

/** Đã nhận đủ: dấu tích, số tiền, hình thức thanh toán, lời cảm ơn — cùng khung với các bước trước. */
function PhanDaNhan({ noiDung }) {
  const { daNhan } = noiDung;
  const chuTong = formatMoney(daNhan.tong);
  return (
    <aside aria-label="Kết quả thanh toán" className={`${KHUNG} items-center justify-center gap-1.5 px-12 py-8 text-center`}>
      <DauTich />
      <h2 className="mt-1 text-[1.375rem] font-medium text-slate-600">Đã nhận đủ</h2>
      <p className={`whitespace-nowrap font-bold leading-[1.1] tracking-[-0.02em] tabular-nums ${coSoTien(chuTong, 'text-[3.5rem]', 'text-[3rem]', 'text-[2.5rem]')}`}>{chuTong}</p>
      <div className="mt-[1.125rem] flex flex-col gap-2.5 self-stretch rounded-2xl border border-bo-border bg-bo-surface px-5 py-4 text-left">
        {daNhan.hinhThuc === 'tienMat' ? (
          <>
            <DongTien className="text-[1.125rem]" nhan="Hình thức" so="Tiền mặt" />
            <DongTien className="text-[1.125rem]" nhan="Khách đưa" so={formatMoney(daNhan.khachDua)} />
            {daNhan.tienThua > 0 ? <DongTien className="text-[1.25rem]" nhan="Tiền thừa trả quý khách" so={formatMoney(daNhan.tienThua)} soClassName="text-[1.5rem] font-bold" /> : null}
          </>
        ) : daNhan.hinhThuc === 'ketHop' ? (
          <>
            <DongTien className="text-[1.125rem]" nhan="Tiền mặt" so={formatMoney(daNhan.tienMat)} />
            <DongTien className="text-[1.125rem]" nhan="Chuyển khoản (QR)" so={formatMoney(daNhan.chuyenKhoan)} />
          </>
        ) : (
          <>
            {daNhan.hinhThuc === 'chuyenKhoan' ? <DongTien className="text-[1.125rem]" nhan="Hình thức" so="Chuyển khoản (QR)" /> : null}
            <DongTien className="text-[1.125rem]" nhan="Đã nhận" so={chuTong} />
          </>
        )}
      </div>
      <p className="mt-7 text-[2rem] font-semibold leading-[1.2] tracking-[-0.01em]">Cảm ơn quý khách!</p>
      <p className="text-[1.125rem] text-bo-muted">Quý khách vui lòng nhận hóa đơn tại quầy.</p>
    </aside>
  );
}

/** Khung bên phải theo bước: giỏ hàng, thu tiền mặt, mã QR, mã không dùng được, đã nhận đủ. */
function KhungPhai({ noiDung, trangThai }) {
  switch (trangThai.loai) {
    case 'daNhan':
      return <PhanDaNhan noiDung={noiDung} />;
    case 'qr':
    case 'choMa':
      return <PhanMaQr noiDung={noiDung} trangThai={trangThai} />;
    case 'hetGio':
    case 'maDong':
    case 'kiemTra':
      return <PhanKhongMa noiDung={noiDung} trangThai={trangThai} />;
    default:
      return noiDung.tienMat ? <PhanTienMat noiDung={noiDung} /> : <PhanGio noiDung={noiDung} />;
  }
}

/** Chưa có hàng: lời chào; chân màn có tên cửa hàng và cách thanh toán khi đã nhận tín hiệu từ màn bán hàng. */
function ManChao({ noiDung, goiYKetNoi, thaoTac }) {
  return (
    <>
      {thaoTac ? <div className="absolute right-6 top-6">{thaoTac}</div> : null}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 p-12 text-center">
        <img alt="F Centric" className="h-[4.75rem] w-auto" draggable={false} src={LOGO} />
        <h1 className="mt-6 text-[3.5rem] font-semibold leading-[1.1] tracking-[-0.02em]">Xin chào quý khách</h1>
        <p className="max-w-[45rem] text-[1.375rem] leading-normal text-bo-muted">Hóa đơn của quý khách sẽ hiện ở đây khi thu ngân quét hàng.</p>
        {goiYKetNoi ? (
          <p className="mt-6 text-base text-bo-muted">Chưa nhận tín hiệu từ màn Bán hàng tại quầy — mở màn bán hàng trên chính máy này, cùng trình duyệt.</p>
        ) : null}
      </main>
      {noiDung ? (
        // Chân màn mảnh, cùng nền trắng: chỉ một dòng chữ nhỏ, không khung, không thẻ bọc
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-bo-border px-12 py-4 text-base text-bo-muted">
          {noiDung.cuaHang ? (
            <p className="inline-flex min-w-0 items-center gap-2">
              <Store aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={1.8} />
              <span className="truncate">{noiDung.cuaHang}</span>
            </p>
          ) : <span />}
          <p className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>Thanh toán bằng</span>
            <span className="inline-flex items-center gap-1.5 text-slate-600">
              <Banknote aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />Tiền mặt
            </span>
            {noiDung.coChuyenKhoan ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <QrCode aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />Chuyển khoản (QR) qua
                </span>
                <PayosLogo className="h-[1.25rem] w-auto" height={40} />
              </>
            ) : null}
          </p>
        </footer>
      ) : null}
    </>
  );
}

/**
 * Màn hình phụ quay về phía khách (cửa sổ riêng, nhận nội dung từ màn bán hàng cùng máy) — gương của giỏ thu ngân:
 * danh sách hàng bên trái, khung bên phải đổi theo bước thanh toán (màn dọc: khung xuống dưới danh sách).
 * `goiYKetNoi` (lúc nhân viên đang dựng máy): hiện dòng nhắc chưa nhận tín hiệu từ màn bán hàng.
 * `thaoTac`: nút cho nhân viên lúc dựng máy (Toàn màn hình), đặt ở góc trên không che nội dung.
 */
export default function PosManKhach({ noiDung, goiYKetNoi = false, thaoTac = null }) {
  const now = useBayGio(noiDung?.qr?.trangThai === 'PENDING' ? hetHanTheoMay(noiDung.qr) : null);
  const trangThai = trangThaiManKhach(noiDung, now);
  const { loai } = trangThai;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-bo-surface text-bo-foreground">
      {/* Một vùng thông báo dùng chung mọi bước: vùng vừa tạo thì trình đọc màn hình hay bỏ qua câu đầu tiên */}
      <p className="sr-only" role="status">{THONG_BAO[loai]}</p>
      {loai === 'trong'
        ? <ManChao goiYKetNoi={goiYKetNoi} noiDung={noiDung} thaoTac={thaoTac} />
        : <ManHoaDon noiDung={noiDung} thaoTac={thaoTac} trangThai={trangThai} />}
    </div>
  );
}

/** Đang có hóa đơn: logo + tên khách; danh sách hàng và khung bên phải theo bước thanh toán. */
function ManHoaDon({ noiDung, thaoTac, trangThai }) {
  // Khung phải rộng hơn khi có mã QR / kết quả: mã lớn dễ quét; tổng tiền hàng chuyển xuống chân danh sách
  const rong = trangThai.loai !== 'gio';
  return (
    <>
      <header className="flex h-[4.75rem] shrink-0 items-center justify-between gap-4 border-b border-bo-border px-10 portrait:px-9">
        <img alt="F Centric" className="h-[2.125rem] w-auto shrink-0" draggable={false} src={LOGO} />
        <div className="flex min-w-0 items-center gap-4">
          {thaoTac}
          {/* Chỉ tên khách đã chọn (không số điện thoại); khách lẻ thì không hiện */}
          {noiDung.khachHang ? (
            <p className="flex min-w-0 items-center gap-2.5 text-[1.125rem] text-bo-muted">
              <UserRound aria-hidden="true" className="size-[1.375rem] shrink-0" strokeWidth={1.8} />
              <span className="shrink-0">Khách hàng</span>
              <strong className="truncate font-semibold text-bo-foreground">{noiDung.khachHang}</strong>
            </p>
          ) : null}
        </div>
      </header>
      <main className={`grid min-h-0 flex-1 portrait:grid-rows-[minmax(0,1fr)_auto] ${rong ? 'landscape:grid-cols-[minmax(0,1fr)_35rem]' : 'landscape:grid-cols-[minmax(0,1fr)_29.375rem]'}`}>
        <DanhSachHang coTongCuoi={rong} key={noiDung.soHoaDon ?? ''} noiDung={noiDung} />
        <KhungPhai noiDung={noiDung} trangThai={trangThai} />
      </main>
    </>
  );
}
