import { useState } from "react";
import { HandCoins, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MoneyInput from "@/components/shared/MoneyInput";
import { thanhToanService } from "@/services/thanhToanService";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/formatters";
import { toast } from "@/lib/thongBaoNhanh";
import { PHUONG_THUC_TAI_QUAY } from "./tinhDonBan";
import { CHUA_RO, KHUNG_HOP, loiCua, maLoi, oNhap, taoKhoa } from "./hopChung";

const oTien = "mt-1.5 h-9 px-3";
/** Ngày yyyy-mm-dd theo giờ máy (ô chọn ngày; không lệch ngày như toISOString lúc gần nửa đêm). */
const ngayMay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Chuyển khoản ghi lùi tối đa (máy chủ chặn cùng mốc): quản trị viên nhập bù sao kê cũ, nhân viên chỉ tuần gần nhất. */
const LUI_TOI_DA_QTV = 366;
const LUI_TOI_DA_NV = 7;
/** Mất kết nối / máy chủ lỗi: không biết phiếu đã ghi chưa. */
const loiChuaRo = (error) => !error?.response || Number(error.response.status) >= 500;

/**
 * Ghi nhận khách trả tiền cho đơn bán thường: tiền mặt (ghi hôm nay) hoặc chuyển khoản (bắt buộc mã giao dịch, chọn
 * được ngày đã qua). Máy chủ hỏi lại trước khi ghi khi số vượt phần còn phải thu (THU_THUA, đơn thành Cần hoàn tiền)
 * hoặc mã giao dịch đã ghi cho đơn khác (MA_GD_DA_DUNG). Lỗi chưa rõ kết quả: khóa các ô (gửi lại đúng nội dung cũ cùng
 * khóa chống trùng), đóng hộp thì tải lại đơn.
 */
function HopThuTien({ donId, conLai, laQtv, chuaTheoDoi, onClose, onXong }) {
  const homNay = ngayMay();
  const luiToiDa = laQtv ? LUI_TOI_DA_QTV : LUI_TOI_DA_NV;
  const toiThieu = (() => { const d = new Date(); d.setDate(d.getDate() - luiToiDa); return ngayMay(d); })();
  const [khoa] = useState(taoKhoa);
  const [phuongThuc, setPhuongThuc] = useState("CHUYEN_KHOAN");
  // Đơn cũ chưa theo dõi: có thể đã thu ngoài hệ thống, không điền sẵn cả số phải thu
  const [soTien, setSoTien] = useState(conLai > 0 && !chuaTheoDoi ? conLai : "");
  const [ngayThu, setNgayThu] = useState(homNay);
  const [maGd, setMaGd] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");
  const [hoi, setHoi] = useState(null); // { code, cau }: máy chủ cần xác nhận trước khi ghi
  const [daXacNhan, setDaXacNhan] = useState({});
  const [chuaRo, setChuaRo] = useState(false); // lần gửi trước không rõ kết quả: giữ nguyên nội dung để gửi lại
  const [khoaHong, setKhoaHong] = useState(false); // khóa chống trùng đã ghi phiếu khác nội dung: chỉ còn đóng hộp
  const tienMat = phuongThuc === "TIEN_MAT";
  const so = soTien === "" ? 0 : Number(soTien);
  const thieuMa = !tienMat && !maGd.trim();
  const loiNgay = tienMat ? ""
    : !ngayThu ? "Chọn ngày khách chuyển."
      : ngayThu > homNay ? "Chọn ngày không sau hôm nay."
        : ngayThu < toiThieu ? `Chỉ ghi lùi tối đa ${luiToiDa} ngày${laQtv ? "" : " — khoản chuyển cũ hơn nhờ quản trị viên ghi"}.` : "";
  const chuaDu = dang || khoaHong || so <= 0 || thieuMa || Boolean(loiNgay);
  const vi = dang || khoaHong ? "" : so <= 0 ? "Nhập số tiền." : thieuMa ? "Nhập mã giao dịch trên sao kê." : "";
  const dong = () => onClose(chuaRo || khoaHong);
  const gui = async (xacNhanThem = {}) => {
    if (chuaDu) return;
    const xacNhan = { ...daXacNhan, ...xacNhanThem };
    setDang(true);
    setLoi("");
    try {
      await thanhToanService.thuTien(donId, {
        phuongThuc, soTien: so, ngayThu: tienMat ? undefined : ngayThu,
        maThamChieu: tienMat ? undefined : maGd.trim(), ghiChu: ghiChu.trim() || undefined,
        choThuThua: Boolean(xacNhan.THU_THUA), choMaDaDung: Boolean(xacNhan.MA_GD_DA_DUNG), khoaChongTrung: khoa,
      });
      onXong(`Đã ghi nhận thu ${formatCurrency(so)}.`);
    } catch (error) {
      const code = maLoi(error);
      setDaXacNhan(xacNhan);
      if (code === "THU_THUA") {
        // Số dư theo máy chủ (có thể vừa có người ghi phiếu khác): phần còn phải thu suy ra từ đó cho hai số khớp nhau
        const du = Number(error.response.data.data.du);
        const con = Number.isFinite(du) ? Math.max(so - du, 0) : Math.max(conLai, 0);
        setHoi({
          code,
          cau: `Đơn còn phải thu ${formatCurrency(con)}; ghi ${formatCurrency(so)} thì thu dư ${formatCurrency(Number.isFinite(du) ? du : so - con)} và đơn thành Cần hoàn tiền. Khách thật sự trả dư thì bấm Vẫn ghi, sau đó ${laQtv ? "trả lại khách và ghi nhận hoàn tiền" : "nhờ quản trị viên trả lại khách và ghi hoàn tiền"}.`,
        });
      } else if (code === "MA_GD_DA_DUNG") {
        setHoi({ code, cau: loiCua(error, "Mã giao dịch đã ghi cho đơn khác.") });
      } else if (code === "KHOA_DA_DUNG") {
        setKhoaHong(true);
        setLoi(`${loiCua(error, "Lần gửi trước đã ghi phiếu với nội dung khác.")} Đóng hộp để xem danh sách phiếu của đơn.`);
      } else if (loiChuaRo(error)) {
        setChuaRo(true);
        setLoi(CHUA_RO);
      } else {
        setLoi(loiCua(error, "Không ghi nhận được. Thử lại."));
      }
      setDang(false);
    }
  };
  // Đổi số / cách trả / mã sau khi đã được hỏi: hỏi lại theo dữ liệu mới (ghi chú không đổi ý nghĩa nên giữ xác nhận)
  const datLai = () => { setHoi(null); setDaXacNhan({}); setLoi(""); };
  const doi = (fn) => (e) => { fn(e.target.value); datLai(); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !dang) dong(); }}>
      <DialogContent className={KHUNG_HOP}>
        <DialogHeader>
          <DialogTitle>Ghi nhận thanh toán</DialogTitle>
          <DialogDescription>
            {chuaTheoDoi
              ? <>Đơn tạo trước khi có ghi nhận thanh toán (tổng đơn <strong>{formatCurrency(conLai)}</strong>). Ghi đúng các khoản khách đã trả để bắt đầu theo dõi. </>
              : conLai > 0 ? <>Đơn còn phải thu <strong>{formatCurrency(conLai)}</strong>. </> : "Đơn không còn phải thu. "}
            Chỉ ghi khi tiền đã tới: tiền mặt đã cầm, chuyển khoản đã thấy trên sao kê.
          </DialogDescription>
        </DialogHeader>
        {/* Sau lỗi chưa rõ kết quả: khóa nội dung, chỉ gửi lại đúng như lần trước. Đang gửi cũng khóa: sửa giữa chừng thì
            câu hỏi lại của máy chủ (theo nội dung cũ) không bị áp sang nội dung mới */}
        <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0 text-sm" disabled={dang || chuaRo || khoaHong}>
          <fieldset className="flex gap-4">
            <legend className="sr-only">Cách trả</legend>
            {[["CHUYEN_KHOAN", "Chuyển khoản"], ["TIEN_MAT", "Tiền mặt"]].map(([ma, ten]) => (
              <label className="flex items-center gap-2" key={ma}>
                <input checked={phuongThuc === ma} className="size-4 accent-bo-primary" name="cach-thu" onChange={() => { setPhuongThuc(ma); datLai(); }} type="radio" />{ten}
              </label>
            ))}
          </fieldset>
          <label className="block font-medium text-bo-foreground" htmlFor="so-tien-thu">
            Số tiền
            <MoneyInput className={oTien} id="so-tien-thu" onChange={(v) => { setSoTien(v); datLai(); }} value={soTien} />
          </label>
          {so > conLai && so > 0 ? <p className="text-xs text-amber-700">Nhiều hơn số còn phải thu {formatCurrency(Math.max(conLai, 0))}: sẽ hỏi lại trước khi ghi.</p> : null}
          {tienMat ? (
            <p className="text-xs text-bo-muted">Tiền mặt ghi ngày hôm nay, người thu là bạn.</p>
          ) : (
            <>
              <label className="block font-medium text-bo-foreground" htmlFor="ngay-thu">
                Ngày khách chuyển
                <input aria-describedby={loiNgay ? "ngay-thu-loi" : undefined} aria-invalid={Boolean(loiNgay)} className={oNhap} id="ngay-thu" max={homNay} min={toiThieu} onChange={doi(setNgayThu)} required type="date" value={ngayThu} />
              </label>
              {loiNgay ? <p className="text-xs text-red-600" id="ngay-thu-loi">{loiNgay}</p> : null}
              <label className="block font-medium text-bo-foreground" htmlFor="ma-gd-thu">
                Mã giao dịch trên sao kê <span aria-hidden="true" className="text-red-600">*</span>
                <input aria-describedby="ma-gd-thu-goi-y" className={oNhap} id="ma-gd-thu" maxLength={100} onChange={doi(setMaGd)} required value={maGd} />
              </label>
              <p className="-mt-2 text-xs text-bo-muted" id="ma-gd-thu-goi-y">Tiền thu hộ (COD) đơn vị vận chuyển chuyển về: ghi mã bảng kê.</p>
            </>
          )}
          <label className="block font-medium text-bo-foreground" htmlFor="ghi-chu-thu">
            Ghi chú <span className="font-normal text-bo-muted">(không bắt buộc)</span>
            <input className={oNhap} id="ghi-chu-thu" maxLength={500} onChange={(e) => setGhiChu(e.target.value)} placeholder="VD: khách đặt cọc" value={ghiChu} />
          </label>
        </fieldset>
        {hoi ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">{hoi.cau}</div>
        ) : null}
        {loi ? <p className="text-xs text-red-600" role="alert">{loi}</p> : null}
        {vi ? <p className="text-xs text-bo-muted" id="ly-do-khoa-thu">{vi}</p> : null}
        <DialogFooter>
          <Button className="border-bo-border bg-bo-surface" disabled={dang} onClick={dong} variant="outline">Quay lại</Button>
          {hoi ? (
            <Button aria-describedby={vi ? "ly-do-khoa-thu" : undefined} className="bg-amber-600 text-white hover:bg-amber-700" disabled={chuaDu} onClick={() => gui({ [hoi.code]: true })}>
              {dang ? "Đang ghi…" : hoi.code === "THU_THUA" ? "Vẫn ghi (khách trả dư)" : "Vẫn ghi (bảng kê nhiều đơn)"}
            </Button>
          ) : (
            <Button aria-describedby={vi ? "ly-do-khoa-thu" : undefined} className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={chuaDu} onClick={() => gui()}>
              {dang ? "Đang ghi…" : chuaRo ? "Ghi nhận lại" : "Ghi nhận"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ghi trả lại khách phần thu thừa (chỉ quản trị viên): chuyển khoản kèm mã giao dịch, hoặc tiền mặt. */
function HopHoanTien({ donId, thuThua, onClose, onXong }) {
  const [khoa] = useState(taoKhoa);
  const [phuongThuc, setPhuongThuc] = useState("CHUYEN_KHOAN");
  const [soTien, setSoTien] = useState(thuThua);
  const [maGd, setMaGd] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");
  const [chuaRo, setChuaRo] = useState(false);
  const [khoaHong, setKhoaHong] = useState(false);
  const tienMat = phuongThuc === "TIEN_MAT";
  const so = soTien === "" ? 0 : Number(soTien);
  const thieuMa = !tienMat && !maGd.trim();
  const chuaDu = dang || khoaHong || so <= 0 || so > thuThua || thieuMa;
  const vi = dang || khoaHong || so > thuThua ? "" : so <= 0 ? "Nhập số tiền." : thieuMa ? "Nhập mã giao dịch trên sao kê." : "";
  const dong = () => onClose(chuaRo || khoaHong);
  const gui = async () => {
    if (chuaDu) return;
    setDang(true);
    setLoi("");
    try {
      await thanhToanService.hoanTien(donId, {
        phuongThuc, soTien: so, maThamChieu: tienMat ? undefined : maGd.trim(), ghiChu: ghiChu.trim() || undefined,
        khoaChongTrung: khoa,
      });
      onXong(`Đã ghi nhận hoàn ${formatCurrency(so)} cho khách.`);
    } catch (error) {
      if (maLoi(error) === "KHOA_DA_DUNG") {
        setKhoaHong(true);
        setLoi(`${loiCua(error, "Lần gửi trước đã ghi phiếu với nội dung khác.")} Đóng hộp để xem danh sách phiếu của đơn.`);
      } else if (loiChuaRo(error)) {
        setChuaRo(true);
        setLoi(CHUA_RO);
      } else {
        setLoi(loiCua(error, "Không ghi nhận được hoàn tiền. Thử lại."));
      }
      setDang(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !dang) dong(); }}>
      <DialogContent className={KHUNG_HOP}>
        <DialogHeader>
          <DialogTitle>Ghi nhận hoàn tiền cho khách</DialogTitle>
          <DialogDescription>Đơn đã thu dư {formatCurrency(thuThua)}. Trả lại khách trước, rồi ghi nhận ở đây.</DialogDescription>
        </DialogHeader>
        <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0 text-sm" disabled={dang || chuaRo || khoaHong}>
          <fieldset className="flex gap-4">
            <legend className="sr-only">Cách hoàn</legend>
            {[["CHUYEN_KHOAN", "Chuyển khoản"], ["TIEN_MAT", "Tiền mặt"]].map(([ma, ten]) => (
              <label className="flex items-center gap-2" key={ma}>
                <input checked={phuongThuc === ma} className="size-4 accent-bo-primary" name="cach-hoan" onChange={() => { setPhuongThuc(ma); setLoi(""); }} type="radio" />{ten}
              </label>
            ))}
          </fieldset>
          <label className="block font-medium text-bo-foreground" htmlFor="so-tien-hoan">
            Số tiền hoàn
            <MoneyInput className={oTien} id="so-tien-hoan" onChange={setSoTien} value={soTien} />
          </label>
          {so > thuThua ? <p className="text-xs text-red-600">Chỉ hoàn tối đa {formatCurrency(thuThua)}.</p> : null}
          {tienMat ? null : (
            <label className="block font-medium text-bo-foreground" htmlFor="ma-gd-hoan">
              Mã giao dịch hoàn trên sao kê <span aria-hidden="true" className="text-red-600">*</span>
              <input className={oNhap} id="ma-gd-hoan" maxLength={100} onChange={(e) => setMaGd(e.target.value)} required value={maGd} />
            </label>
          )}
          <label className="block font-medium text-bo-foreground" htmlFor="ghi-chu-hoan">
            Ghi chú <span className="font-normal text-bo-muted">(không bắt buộc)</span>
            <input className={oNhap} id="ghi-chu-hoan" maxLength={500} onChange={(e) => setGhiChu(e.target.value)} value={ghiChu} />
          </label>
        </fieldset>
        {loi ? <p className="text-xs text-red-600" role="alert">{loi}</p> : null}
        {vi ? <p className="text-xs text-bo-muted" id="ly-do-khoa-hoan">{vi}</p> : null}
        <DialogFooter>
          <Button className="border-bo-border bg-bo-surface" disabled={dang} onClick={dong} variant="outline">Quay lại</Button>
          <Button aria-describedby={vi ? "ly-do-khoa-hoan" : undefined} className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={chuaDu} onClick={gui}>
            {dang ? "Đang ghi…" : chuaRo ? "Ghi nhận lại" : "Ghi nhận hoàn tiền"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HopHuyPhieu({ phieu, onClose, onXong }) {
  const [lyDo, setLyDo] = useState("");
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState("");
  const [xungDot, setXungDot] = useState(false);
  const gui = async () => {
    if (dang || !lyDo.trim()) return;
    setDang(true);
    setLoi("");
    try {
      await thanhToanService.huyPhieu(phieu.id, lyDo.trim());
      onXong(`Đã hủy phiếu ${phieu.maPhieu}.`);
    } catch (error) {
      setLoi(loiCua(error, "Không hủy được phiếu. Thử lại."));
      // Đã có người hủy: đóng hộp thì tải lại đơn để thấy đúng trạng thái phiếu
      if (error?.response?.status === 409) setXungDot(true);
      setDang(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !dang) onClose(xungDot); }}>
      <DialogContent className={KHUNG_HOP}>
        <DialogHeader>
          <DialogTitle>Hủy phiếu {phieu.maPhieu}?</DialogTitle>
          <DialogDescription>
            {PHUONG_THUC_TAI_QUAY[phieu.phuongThuc] || phieu.phuongThuc} {formatCurrency(phieu.soTien)}. Phiếu không bị xóa: vẫn hiện, gạch đi, kèm lý do và người hủy.
            Trạng thái thanh toán của đơn tính lại sau khi hủy.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm font-medium text-bo-foreground" htmlFor="ly-do-huy-phieu">
          Lý do hủy <span className="text-red-600">*</span>
          <input autoFocus className={oNhap} id="ly-do-huy-phieu" maxLength={500} onChange={(e) => setLyDo(e.target.value)} placeholder="VD: ghi nhầm số tiền" value={lyDo} />
        </label>
        {loi ? <p className="text-xs text-red-600" role="alert">{loi}</p> : null}
        <DialogFooter>
          <Button className="border-bo-border bg-bo-surface" disabled={dang} onClick={() => onClose(xungDot)} variant="outline">Quay lại</Button>
          <Button className="bg-red-600 text-white hover:bg-red-700" disabled={dang || !lyDo.trim()} onClick={gui}>{dang ? "Đang hủy…" : "Hủy phiếu"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Phải thu / đã thu / còn lại của đơn bán thường. */
function SoThanhToan({ thanhToan }) {
  const o = [
    ["Phải thu", thanhToan.phaiThu],
    ["Đã thu", thanhToan.daThu],
    ["Còn lại", thanhToan.conLai],
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      {o.map(([nhan, so]) => (
        <div className="min-w-0 rounded-md border border-bo-border bg-bo-surface-subtle px-2 py-1.5" key={nhan}>
          <dt className="text-bo-muted">{nhan}</dt>
          <dd className="truncate font-semibold tabular-nums text-bo-foreground" title={formatCurrency(so)}>{formatCurrency(so)}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Các phiếu thu / hoàn của đơn bán thường (dưới dòng "Thanh toán" cạnh tổng tiền): phải thu / đã thu / còn lại, cách
 * trả, số tiền, nút Ghi nhận thanh toán (coTheThu: quản trị viên, nhân viên bán hàng; đơn chưa hủy / hoàn trả). Đơn thu
 * dư (khách chuyển dư, đơn đã thu rồi bị hủy / hoàn trả): nút Ghi nhận hoàn tiền (coTheHoan: chỉ quản trị viên). Phiếu
 * ghi nhầm: quản trị viên hủy có lý do. Đơn cũ chưa theo dõi (trạng thái trống): chưa hiện số, chỉ nút ghi nhận.
 */
export default function KhoiPhieuThu({ donId, thanhToan, laQtv, coTheHoan, coTheThu, onDaDoi }) {
  const [hop, setHop] = useState(null); // { loai: "thu" | "hoan" } | { loai: "huy", phieu }
  const phieu = thanhToan?.phieu ?? [];
  const thuThua = Number(thanhToan?.thuThua) || 0;
  const donThuong = Boolean(thanhToan?.donThuong);
  const chuaTheoDoi = donThuong && !thanhToan?.trangThai;
  // Đã thu đủ thì ẩn nút (khách trả thêm hiếm gặp; máy chủ vẫn hỏi lại khi thu dư)
  const choThu = donThuong && coTheThu && Boolean(thanhToan?.choGhiThu) && Number(thanhToan?.conLai) > 0;
  if (!donThuong) return null;
  const xong = (cau) => {
    toast.success(cau);
    setHop(null);
    onDaDoi?.();
  };
  // Đóng hộp sau lỗi chưa rõ / xung đột: tải lại đơn (phiếu có thể đã được ghi / đổi)
  const dongHop = (taiLai) => {
    setHop(null);
    if (taiLai) onDaDoi?.();
  };
  return (
    <div className="mt-2 space-y-2">
      {chuaTheoDoi ? null : <SoThanhToan thanhToan={thanhToan} />}
      {choThu ? (
        <Button className="h-8 w-full gap-1.5 bg-bo-primary text-xs text-white hover:bg-bo-primary-hover" onClick={() => setHop({ loai: "thu" })}>
          <HandCoins className="size-3.5" />Ghi nhận thanh toán
        </Button>
      ) : null}
      {phieu.length ? (
        <ul className="m-0 list-none space-y-1 p-0 text-xs">
          {phieu.map((p) => {
            const huy = p.trangThai === "DA_HUY";
            const huyDuoc = laQtv && !huy;
            return (
              <li className={`flex flex-wrap items-baseline gap-x-2 ${huy ? "text-bo-muted" : "text-bo-foreground"}`} key={p.id} title={huy ? `Đã hủy: ${p.lyDoHuy || ""}${p.tenNguoiHuy ? ` · ${p.tenNguoiHuy}` : ""}` : formatDateTime(p.thoiDiemThu)}>
                <span className="font-mono text-bo-muted">{p.maPhieu}</span>
                <span>{p.loai === "HOAN" ? "Hoàn · " : ""}{PHUONG_THUC_TAI_QUAY[p.phuongThuc] || p.phuongThuc}</span>
                {/* Ngày thu, người thu và mã giao dịch để đối chiếu sao kê */}
                <span className="break-all text-bo-muted">
                  {formatDate(p.thoiDiemThu)}{p.tenNguoiThu ? ` · ${p.tenNguoiThu}` : ""}{p.maThamChieu ? ` · ${p.maThamChieu}` : ""}
                </span>
                {/* Chuyển khoản chưa được quản trị viên đối chiếu sao kê */}
                {!huy && p.phuongThuc === "CHUYEN_KHOAN" && !p.doiChieuLuc ? <span className="text-amber-700">chưa đối chiếu</span> : null}
                <span className={`ml-auto font-semibold tabular-nums ${huy ? "line-through" : ""}`}>{p.loai === "HOAN" ? "−" : ""}{formatCurrency(p.soTien)}</span>
                {huy ? (
                  <span className="basis-full">Đã hủy{p.lyDoHuy ? `: ${p.lyDoHuy}` : ""}{p.tenNguoiHuy ? ` · ${p.tenNguoiHuy}` : ""}</span>
                ) : null}
                {huyDuoc ? (
                  <button aria-label={`Hủy phiếu ${p.maPhieu}`} className="text-bo-primary hover:underline" onClick={() => setHop({ loai: "huy", phieu: p })} type="button">Hủy</button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {thuThua > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Đã thu dư <strong>{formatCurrency(thuThua)}</strong>: {coTheHoan ? "trả lại khách rồi ghi nhận." : "nhờ quản trị viên trả lại khách và ghi hoàn tiền."}
          {coTheHoan ? (
            <Button className="mt-2 h-8 w-full gap-1.5 bg-bo-surface text-xs text-bo-foreground hover:bg-bo-surface-subtle" onClick={() => setHop({ loai: "hoan" })} variant="outline">
              <Undo2 className="size-3.5" />Ghi nhận hoàn tiền
            </Button>
          ) : null}
        </div>
      ) : null}
      {hop?.loai === "thu" ? <HopThuTien chuaTheoDoi={chuaTheoDoi} conLai={Number(thanhToan?.conLai) || 0} donId={donId} laQtv={laQtv} onClose={dongHop} onXong={xong} /> : null}
      {hop?.loai === "hoan" ? <HopHoanTien donId={donId} onClose={dongHop} onXong={xong} thuThua={thuThua} /> : null}
      {hop?.loai === "huy" ? <HopHuyPhieu onClose={dongHop} onXong={xong} phieu={hop.phieu} /> : null}
    </div>
  );
}
