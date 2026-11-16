import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, CheckCircle2, Download, FileSpreadsheet, Loader2, Settings, TriangleAlert } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import CotThuocTinh, { BangThuocTinh, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import {
  AN_DIEN_THOAI,
  BANG,
  CHI_DIEN_THOAI,
  DONG,
  DONG_TIEU_DE,
  KHUNG_CUON,
  O,
  O_CUOI,
  O_DAU,
  O_TIEU_DE,
} from "@/components/chung-tu/kieuBang";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  coThue,
  coTien,
  congTongHop,
  duongDanChungTu,
  hienNgay,
  homQuaIso,
  kyChungTu,
  ngayIso,
  tenLoai,
  viecKeToan,
} from "@/components/ke-toan/tinhKeToan";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency } from "@/utils/formatters";
import { t, tDuLieu } from "@/i18n";

const tien = (v) => (v == null ? "—" : formatCurrency(v));
const GACH = <span className="text-bo-muted">—</span>;
const GHI_CHU_TOI_DA = 500;

/** Tiêu đề một mục trong thân khối chứng từ (cùng kiểu "Hàng chuyển" của Chi tiết phiếu chuyển kho). */
function TieuDeMuc({ id, children, phu }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
      <h2 id={id} className="text-base font-semibold leading-6 text-bo-foreground">{children}</h2>
      {phu ? <span className="text-[13px] leading-5 text-bo-muted">{phu}</span> : null}
    </div>
  );
}

/** Mã chứng từ: liên kết tới màn chi tiết khi loại đó có màn, không thì chữ thường. */
function MaChungTu({ loai, idNguon, so }) {
  const den = duongDanChungTu(loai, idNguon);
  if (!so) return <span className="text-bo-muted">{tenLoai(loai)}</span>;
  return den ? (
    <Link to={den} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{so}</Link>
  ) : (
    <span className="whitespace-nowrap font-medium text-bo-foreground">{so}</span>
  );
}

/** Ghi chú việc kế toán: thu còn 2 dòng, chỉ hiện "Xem đủ" khi chữ thật sự bị cắt (đo theo bề rộng ô). */
function GhiChu({ noiDung }) {
  const [mo, setMo] = useState(false);
  const [dai, setDai] = useState(false);
  const ref = useRef(null);
  const chu = tDuLieu(noiDung);
  useLayoutEffect(() => {
    const p = ref.current;
    if (!p || mo) return undefined;
    const do0 = () => setDai(p.scrollHeight > p.clientHeight + 1);
    do0();
    if (typeof ResizeObserver === "undefined") return undefined;
    const theoDoi = new ResizeObserver(do0);
    theoDoi.observe(p);
    return () => theoDoi.disconnect();
  }, [chu, mo]);
  return (
    <>
      <p ref={ref} className={cn("text-[13px] leading-5 text-slate-600", !mo && "line-clamp-2")}>{chu}</p>
      {dai ? (
        <button type="button" onClick={() => setMo((m) => !m)} aria-expanded={mo}
          className="mt-0.5 rounded text-xs font-medium text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30">
          {mo ? t("Thu gọn") : t("Xem đủ")}
        </button>
      ) : null}
    </>
  );
}

/** Ô ngày ở đầu khối: xuất chứng từ đến hết ngày nào; đang kiểm tra lại thì quay vòng. */
function ONgay({ giaTri, onDoi, dangKiem }) {
  return (
    <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 max-sm:w-full">
      <Calendar className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      <span className="shrink-0 text-xs text-bo-muted">{t("Đến hết ngày")}</span>
      <Input type="date" aria-label={t("Xuất đến hết ngày")} value={giaTri} max={ngayIso(new Date())}
        onChange={(e) => onDoi(e.target.value)}
        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-bo-foreground shadow-none focus-visible:ring-0" />
      {dangKiem ? <Loader2 className="size-4 shrink-0 animate-spin text-bo-muted" aria-label={t("Đang kiểm tra")} /> : null}
    </label>
  );
}

/**
 * Tạo lô xuất kế toán (PA E, khung chứng từ hai cột như Chi tiết phiếu chuyển kho): tự kiểm tra khi mở và khi đổi ngày
 * (chỉ đọc). Thân: chứng từ để lại lô sau, chứng từ theo loại, việc kế toán làm thêm trên AMIS; cột phải: thông tin lô,
 * đối chiếu doanh thu, các tệp nhập AMIS theo thứ tự. Tạo xong chuyển sang chi tiết lô và tải tệp. Chỉ quản trị viên.
 */
export default function TaoLoKeToan() {
  const navigate = useNavigate();
  const id = useId();
  const [denNgay, setDenNgay] = useState(() => homQuaIso());
  const [xemTruoc, setXemTruoc] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dangKiem, setDangKiem] = useState(true);
  const [loTruoc, setLoTruoc] = useState(undefined);
  const [moChan, setMoChan] = useState(false);
  const [moXacNhan, setMoXacNhan] = useState(false);
  const [ghiChu, setGhiChu] = useState("");
  const [loiTao, setLoiTao] = useState(null);
  const [dangTao, setDangTao] = useState(false);
  // Chỉ nhận kết quả của lần kiểm tra mới nhất: đổi ngày khi đang kiểm thì kết quả cũ về muộn bị bỏ
  const lanKiemRef = useRef(0);

  const kiemTra = useCallback(async (ngay) => {
    const lan = ++lanKiemRef.current;
    setDangKiem(true);
    setLoi(null);
    try {
      const kq = await keToanService.xemTruoc(ngay);
      if (lan !== lanKiemRef.current) return;
      setXemTruoc(kq);
    } catch (e) {
      if (lan !== lanKiemRef.current) return;
      setXemTruoc(null);
      setLoi(e);
    } finally {
      if (lan === lanKiemRef.current) setDangKiem(false);
    }
  }, []);

  // Đổi ngày: đợi người dùng chọn xong (gõ tay từng chữ số) rồi mới kiểm tra
  useEffect(() => {
    if (!denNgay) return undefined;
    const hen = setTimeout(() => kiemTra(denNgay), 350);
    return () => clearTimeout(hen);
  }, [denNgay, kiemTra]);

  useEffect(() => {
    const ctrl = new AbortController();
    keToanService
      .danhSachLo({ signal: ctrl.signal })
      .then((ds) => setLoTruoc(ds.find((l) => l.trangThai !== "da_huy") ?? null))
      .catch(() => !ctrl.signal.aborted && setLoTruoc(null));
    return () => ctrl.abort();
  }, []);

  const taoLo = async () => {
    if (dangTao || !xemTruoc) return;
    setDangTao(true);
    setLoiTao(null);
    try {
      // Tạo lô theo đúng ngày đã kiểm tra; dấu vết để máy chủ từ chối nếu dữ liệu đổi sau lần kiểm tra
      const lo = await keToanService.taoLo({ denNgay: xemTruoc.denNgay, ghiChu: ghiChu.trim() || null, dauVet: xemTruoc.dauVet });
      toast.success(t("Đã tạo lô {{soLo}} ({{count}} chứng từ). Đang tải tệp.", { soLo: lo.soLo, count: Number(lo.soChungTu) || 0 }));
      navigate(`/reports/accounting-export/${lo.id}`, { replace: true });
      keToanService.taiTep(lo).catch((e) => toast.error(getApiErrorMessage(e, t("Không tải được tệp của lô"))));
    } catch (e) {
      // Dữ liệu đổi sau lần kiểm tra (hoặc chứng từ vừa vào lô khác): đóng hộp, kiểm tra lại để thấy đúng nội dung lô
      if (e?.response?.status === 409) {
        toast.error(getApiErrorMessage(e, t("Không tạo được lô")));
        setMoXacNhan(false);
        kiemTra(denNgay);
      } else {
        setLoiTao(getApiErrorMessage(e, t("Không tạo được lô")));
      }
    } finally {
      setDangTao(false);
    }
  };

  const tong = xemTruoc ? congTongHop(xemTruoc.tongHop) : null;
  const ban = xemTruoc?.tongHop?.find((d) => d.loai === "ban_hang");
  const chan = xemTruoc?.loiChan ?? [];
  const viec = viecKeToan(xemTruoc);
  const tep = xemTruoc?.tepNhap ?? [];
  const dc = xemTruoc?.doiChieu;
  const khop = dc && Number(dc.chenhLech) === 0;
  const coNoiDung = Boolean(xemTruoc?.coTheTaoLo) && !loi;
  const taoDuoc = coNoiDung && !dangKiem;

  const lyDoKhoa = dangKiem ? t("Đang kiểm tra chứng từ")
    : loi ? t("Chưa kiểm tra được dữ liệu")
      : xemTruoc && !xemTruoc.coTheTaoLo ? t("Chưa tạo được lô") : undefined;

  const dau = (
    <DauChungTu
      ma={t("Tạo lô xuất")}
      onQuayLai={() => navigate("/reports/accounting-export")}
      nhanQuayLai={t("Về Xuất dữ liệu kế toán")}
      dongPhu={[
        loTruoc === undefined ? null : loTruoc ? t("Nối tiếp {{soLo}}", { soLo: loTruoc.soLo }) : t("Lô đầu tiên"),
        xemTruoc ? t("Kỳ {{ky}}", { ky: kyChungTu(xemTruoc.tuNgay, xemTruoc.denNgay) }) : null,
      ]}
      oPhai={<ONgay giaTri={denNgay} onDoi={setDenNgay} dangKiem={dangKiem && Boolean(xemTruoc)} />}
      nutChinh={{
        nhan: t("Tạo lô và tải tệp"),
        icon: Download,
        khoa: !taoDuoc,
        lyDo: lyDoKhoa,
        onClick: () => { setLoiTao(null); setMoXacNhan(true); },
      }}
    />
  );

  let chinh;
  if (dangKiem && !xemTruoc) {
    chinh = <LoadingState className="min-h-64" label={t("Đang kiểm tra chứng từ")} />;
  } else if (loi) {
    chinh = (
      <div className="p-4 sm:p-6">
        <ErrorState title={t("Lỗi kiểm tra")} description={getApiErrorMessage(loi, t("Không kiểm tra được dữ liệu kế toán"))} error={loi} onRetry={() => kiemTra(denNgay)} />
      </div>
    );
  } else if (xemTruoc && !xemTruoc.coTheTaoLo) {
    chinh = (
      <EmptyState icon={FileSpreadsheet} title={t("Chưa tạo được lô")} description={xemTruoc.lyDoKhongTheTao}
        action={
          <Button asChild variant="outline" className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
            <Link to="/settings/accounting"><Settings className="size-4" aria-hidden="true" />{t("Thiết lập xuất kế toán")}</Link>
          </Button>
        } />
    );
  } else if (xemTruoc) {
    chinh = (
      <div className={cn("flex min-w-0 flex-col", dangKiem && "opacity-60")}>
        {moChan && chan.length ? (
          <section aria-labelledby={`${id}-chan`} className="border-b border-bo-border">
            <TieuDeMuc id={`${id}-chan`} phu={t("Sửa rồi đổi ngày để kiểm tra lại")}>{t("Để lại lô sau")}</TieuDeMuc>
            <div className={KHUNG_CUON}>
              <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
                <thead>
                  <tr className={DONG_TIEU_DE}>
                    <th scope="col" className={cn(O_TIEU_DE, O_DAU, "@2xl/khoi:w-48")}>{t("Chứng từ")}</th>
                    <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-36")}>{t("Loại")}</th>
                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, AN_DIEN_THOAI)}>{t("Lý do")}</th>
                  </tr>
                </thead>
                <tbody>
                  {chan.map((v, i) => (
                    <tr key={`${v.loai}-${v.idNguon ?? i}-${i}`} className={DONG}>
                      <td className={cn(O, O_DAU, "align-top")}>
                        <MaChungTu loai={v.loai} idNguon={v.idNguon} so={v.soChungTu} />
                        <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>{tenLoai(v.loai)}</span>
                        <p className={cn("mt-1 text-[13px] leading-5 text-slate-600", CHI_DIEN_THOAI)}>{tDuLieu(v.noiDung)}</p>
                      </td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap align-top")}>{tenLoai(v.loai)}</td>
                      <td className={cn(O, O_CUOI, AN_DIEN_THOAI, "align-top text-[13px] leading-5 text-slate-600")}>{tDuLieu(v.noiDung)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section aria-labelledby={`${id}-loai`}>
          <TieuDeMuc id={`${id}-loai`} phu={t("Đúng thứ tự kế toán nhập vào AMIS")}>{t("Chứng từ theo loại")}</TieuDeMuc>
          <div className={KHUNG_CUON}>
            <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
              <thead>
                <tr className={DONG_TIEU_DE}>
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>{t("Loại")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, "w-20 text-right @2xl/khoi:w-24")}>{t("Chứng từ")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-36 text-right")}>{t("Trước thuế")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-44 text-right")}>{t("Thuế GTGT")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-32 text-right @2xl/khoi:w-40")}>{t("Tổng")}</th>
                </tr>
              </thead>
              <tbody>
                {xemTruoc.tongHop.map((d) => {
                  const choHoaDon = Number(d.thueChoHoaDon) > 0
                    ? t("+{{tien}} chờ hóa đơn", { tien: tien(d.thueChoHoaDon) }) : null;
                  return (
                    <tr key={d.loai} className={DONG}>
                      <td className={cn(O, O_DAU, "font-medium text-bo-foreground")}>{tenLoai(d.loai)}</td>
                      <td className={cn(O, "text-right")}>{d.soChungTu}</td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap text-right")}>{coTien(d.loai) ? tien(d.truocThue) : GACH}</td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap text-right")}>
                        {coThue(d.loai) ? tien(d.thue) : GACH}
                        {choHoaDon ? <span className="block text-xs text-bo-muted">{choHoaDon}</span> : null}
                      </td>
                      <td className={cn(O, O_CUOI, "text-right")}>
                        {coTien(d.loai)
                          ? <span className="whitespace-nowrap font-medium">{tien(d.tongCong)}</span>
                          : <span className="text-[13px] text-bo-muted">{t("AMIS tự tính giá")}</span>}
                        {choHoaDon ? <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>{choHoaDon}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="tabular-nums">
                  <td className={cn(O, O_DAU, "font-semibold text-bo-foreground")}>{t("Cộng")}</td>
                  <td className={cn(O, "text-right font-semibold")}>{tong.soChungTu}</td>
                  <td className={cn(O, O_CUOI)} colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {viec.length ? (
          <section aria-labelledby={`${id}-viec`} className="border-t border-bo-border">
            <TieuDeMuc id={`${id}-viec`} phu={t("Không chặn tạo lô, đã ghi trong tệp hướng dẫn")}>{t("Kế toán làm thêm trên AMIS")}</TieuDeMuc>
            <div className={KHUNG_CUON}>
              <table className={cn(BANG, "@2xl/khoi:min-w-[620px]")}>
                <thead>
                  <tr className={DONG_TIEU_DE}>
                    <th scope="col" className={cn(O_TIEU_DE, O_DAU, "@2xl/khoi:w-48")}>{t("Chứng từ")}</th>
                    <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-40")}>{t("Việc")}</th>
                    <th scope="col" className={cn(O_TIEU_DE, O_CUOI, AN_DIEN_THOAI)}>{t("Ghi chú")}</th>
                  </tr>
                </thead>
                <tbody>
                  {viec.map((v) => (
                    <tr key={v.khoa} className={DONG}>
                      <td className={cn(O, O_DAU, "align-top")}>
                        <MaChungTu loai={v.loai} idNguon={v.idNguon} so={v.soChungTu} />
                        {v.loTruoc ? <span className="block text-xs text-bo-muted">{t("Đã giao ở lô trước")}</span> : null}
                        <div className={cn("mt-1 grid gap-1", CHI_DIEN_THOAI)}>
                          <span><StatusBadge label={v.viec} /></span>
                          <div><GhiChu noiDung={v.noiDung} /></div>
                        </div>
                      </td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap align-top")}><StatusBadge label={v.viec} /></td>
                      <td className={cn(O, O_CUOI, AN_DIEN_THOAI, "align-top")}><GhiChu noiDung={v.noiDung} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  const cotPhai = coNoiDung ? (
    <CotThuocTinh nhan={t("Thông tin lô sẽ tạo")} className={cn(dangKiem && "opacity-60")}>
      <NhomThuocTinh nhan={t("Lô sẽ tạo")}>
        <BangThuocTinh
          muc={[
            {
              nhan: t("Nối tiếp lô"),
              giaTri: loTruoc === undefined ? "…" : loTruoc ? (
                <>
                  <Link to={`/reports/accounting-export/${loTruoc.id}`} className="font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{loTruoc.soLo}</Link>
                  <span className="block text-xs text-bo-muted">{t("đến hết {{ngay}}", { ngay: hienNgay(loTruoc.denNgay) })}</span>
                </>
              ) : (
                <>
                  {t("Lô đầu tiên")}
                  {xemTruoc.coTonDauKy ? <span className="block text-xs text-bo-muted">{t("gồm tồn đầu kỳ tại {{ngay}}", { ngay: hienNgay(xemTruoc.ngayMoc) })}</span> : null}
                </>
              ),
            },
            { nhan: t("Kỳ chứng từ"), giaTri: kyChungTu(xemTruoc.tuNgay, xemTruoc.denNgay) },
            {
              nhan: t("Chứng từ"),
              giaTri: (
                <span className="tabular-nums">
                  {tong.soChungTu}
                  {chan.length ? <span className="text-bo-muted"> · {t("để lại {{count}}", { count: chan.length })}</span> : null}
                </span>
              ),
            },
            { nhan: t("Tiền khách trả"), giaTri: <span className="tabular-nums">{tien(ban?.tongCong ?? 0)}</span> },
          ]}
        />
      </NhomThuocTinh>

      {dc ? (
        <NhomThuocTinh nhan={t("Đối chiếu doanh thu")}>
          <p className={cn("mb-2.5 flex items-center gap-2 text-[13px] font-medium", khop ? "text-bo-success" : "text-amber-700")}>
            {khop ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <TriangleAlert className="size-4" aria-hidden="true" />}
            {khop ? t("Khớp Báo cáo doanh thu") : t("Lệch Báo cáo doanh thu")}
          </p>
          <BangThuocTinh
            rongNhan={180}
            muc={[
              [t("Báo cáo doanh thu ({{ngayMoc}} – {{denNgay}})", { ngayMoc: hienNgay(xemTruoc.ngayMoc), denNgay: hienNgay(xemTruoc.denNgay) }), dc.doanhThuBaoCao],
              [t("Đã giao kế toán ở các lô trước"), dc.doanhThuLoTruoc],
              [t("Trong lô này"), dc.doanhThuTrongLo],
              [t("Để lại lô sau"), dc.doanhThuBiChan],
            ].map(([nhan, v]) => ({ nhan, giaTri: <span className="block text-right tabular-nums">{tien(v)}</span> })).concat({
              nhan: <span className="font-medium text-bo-foreground">{t("Chênh lệch")}</span>,
              ma: "chenh",
              giaTri: <span className={cn("block text-right font-semibold tabular-nums", khop ? "text-bo-success" : "text-amber-700")}>{tien(dc.chenhLech)}</span>,
            })}
          />
          {!khop ? (
            <p className="mt-2 text-xs leading-5 text-bo-muted">
              {t("Chênh lệch khác 0 khi có đơn hoàn trả hoặc phiếu trả tại quầy mà kế toán lập tay (đơn hoàn trả trước 14/11/2026, phiếu trả trước khi có chức năng tự dựng).")}
            </p>
          ) : null}
        </NhomThuocTinh>
      ) : null}

      {tep.length ? (
        <NhomThuocTinh nhan={t("Tệp nhập AMIS · {{count}} tệp theo thứ tự", { count: tep.length })}>
          <ol className="m-0 grid list-none gap-2 p-0">
            {tep.map((f, i) => (
              <li key={f.ten} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-slate-200/80 text-[11px] font-semibold text-slate-600">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-5 text-bo-foreground" title={f.ten}>{f.ten}</span>
                  {f.noiNhap ? <span className="block text-xs leading-4 text-bo-muted">{tDuLieu(f.noiNhap)}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </NhomThuocTinh>
      ) : null}
    </CotThuocTinh>
  ) : null;

  const thongBao = coNoiDung && (chan.length || (dc && !khop)) ? (
    <>
      {chan.length ? (
        <DongThongBao tone="bad"
          actions={<NutChu onClick={() => setMoChan((m) => !m)} aria-expanded={moChan}>{moChan ? t("Ẩn") : t("Xem {{count}} chứng từ", { count: chan.length })}</NutChu>}>
          <strong className="font-semibold">{t("{{count}} chứng từ có lỗi", { count: chan.length })}</strong>{" "}
          {t("sẽ để lại lô sau.")}
        </DongThongBao>
      ) : null}
      {dc && !khop ? (
        <DongThongBao tone="warn">
          <span className="font-medium">{t("Lệch Báo cáo doanh thu")}</span>{" "}
          <span className="text-bo-muted">· {t("chênh lệch {{tien}}", { tien: tien(dc.chenhLech) })}</span>
        </DongThongBao>
      ) : null}
    </>
  ) : null;

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu dau={dau} thongBao={thongBao} chinh={chinh} cotPhai={cotPhai} />

      <HopXacNhanChungTu
        mo={moXacNhan && Boolean(xemTruoc)}
        onDoiMo={(m) => { if (!m && !dangTao) { setMoXacNhan(false); setLoiTao(null); } }}
        tieuDe={t("Tạo lô xuất")}
        moTa={xemTruoc ? t("Lô gồm {{count}} chứng từ đến hết {{denNgay}}. Tạo xong, các chứng từ này bị khóa và không vào lô khác; tệp nén được lưu để tải lại.",
          { count: tong?.soChungTu ?? 0, denNgay: hienNgay(xemTruoc.denNgay) }) : null}
        nhanXacNhan={t("Tạo lô và tải tệp")}
        iconXacNhan={Download}
        rong
        dangChay={dangTao}
        loi={loiTao}
        onXacNhan={taoLo}
      >
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-ghi-chu`} className={NHAN_O}>
            {t("Ghi chú")} <span className="font-normal text-bo-muted">{t("(không bắt buộc)")}</span>
          </label>
          <textarea id={`${id}-ghi-chu`} rows={2} maxLength={GHI_CHU_TOI_DA} value={ghiChu}
            onChange={(e) => { setGhiChu(e.target.value.slice(0, GHI_CHU_TOI_DA)); setLoiTao(null); }}
            className={O_NHAP_NHIEU_DONG} />
          <p className={GOI_Y_O}><span /><span>{ghiChu.length}/{GHI_CHU_TOI_DA}</span></p>
        </div>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
