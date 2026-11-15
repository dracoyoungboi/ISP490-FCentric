import { useCallback, useEffect, useId, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Ban, ChevronDown, Copy, Download, Loader2, LockOpen } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import CotThuocTinh, { BangThuocTinh, GiaTriSaoChep, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao from "@/components/chung-tu/DongThongBao";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import { KhungDangTai, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
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
import { RowActionButton } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { HopHuyLo, HopMoKhoa } from "@/components/ke-toan/HopKeToan";
import {
  NHAN_CHUNG_TU,
  NHAN_LO,
  demTheoLoai,
  dinhDangKichThuoc,
  duongDanChungTu,
  hienNgay,
  kyChungTu,
  loCoTheHuy,
  nhomTheoLoai,
  tenLoai,
} from "@/components/ke-toan/tinhKeToan";
import useSaoChep from "@/hooks/useSaoChep";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { t } from "@/i18n";

const tien = (v) => (Number(v) ? formatCurrency(v) : "—");

/** Tiêu đề một mục trong thân khối chứng từ (cùng kiểu trang Tạo lô xuất). */
function TieuDeMuc({ id, children, phu }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pb-3 pt-5 sm:px-6">
      <h2 id={id} className="text-base font-semibold leading-6 text-bo-foreground">{children}</h2>
      {phu ? <span className="text-[13px] leading-5 text-bo-muted">{phu}</span> : null}
    </div>
  );
}

/**
 * Chi tiết một lô xuất kế toán (khung chứng từ hai cột như Chi tiết phiếu chuyển kho): thân là chứng từ trong lô (mở khóa
 * từng chứng từ) và hướng dẫn nhập AMIS đúng bản trong tệp nén; cột phải là thông tin lô, tệp, việc hủy. Nút chính Tải tệp,
 * Sao chép hướng dẫn gửi kế toán; Hủy lô ở ⋯, chỉ lô còn hiệu lực mới nhất. Chỉ quản trị viên.
 */
export default function ChiTietLoKeToan() {
  const { id } = useParams();
  const idMuc = useId();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { saoChep } = useSaoChep();
  const loId = Number(id);

  const [dsLo, setDsLo] = useState(null);
  const [chungTu, setChungTu] = useState(null);
  const [loi, setLoi] = useState(null);
  const [lanTai, setLanTai] = useState(0);
  const [dangTaiTep, setDangTaiTep] = useState(false);
  const [moKhoa, setMoKhoa] = useState(null);
  const [huyLo, setHuyLo] = useState(false);
  // Hướng dẫn nhập AMIS: mở sẵn khi vừa tạo lô (người tạo gửi ngay cho kế toán)
  const [moHuongDan, setMoHuongDan] = useState(Boolean(state?.vuaTao));
  const [huongDan, setHuongDan] = useState(null);
  const [loiHuongDan, setLoiHuongDan] = useState(null);
  const [dangChep, setDangChep] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      keToanService.danhSachLo({ signal: ctrl.signal }),
      keToanService.chungTuCuaLo(loId, { signal: ctrl.signal }),
    ])
      .then(([ds, ct]) => {
        setDsLo(ds);
        setChungTu(ct);
        setLoi(null);
      })
      .catch((e) => !ctrl.signal.aborted && setLoi(e));
    return () => ctrl.abort();
  }, [loId, lanTai]);

  const layHuongDan = useCallback(async () => {
    if (huongDan != null) return huongDan;
    try {
      const noiDung = await keToanService.huongDanCuaLo(loId);
      setHuongDan(noiDung ?? "");
      setLoiHuongDan(null);
      return noiDung ?? "";
    } catch (e) {
      setLoiHuongDan(getApiErrorMessage(e, t("Không tải được hướng dẫn của lô")));
      return null;
    }
  }, [huongDan, loId]);

  useEffect(() => {
    if (moHuongDan && huongDan == null && !loiHuongDan) queueMicrotask(layHuongDan);
  }, [moHuongDan, huongDan, loiHuongDan, layHuongDan]);

  const taiLai = () => {
    setLoi(null);
    setDsLo(null);
    setChungTu(null);
    setLanTai((k) => k + 1);
  };
  const veDanhSach = () => navigate("/reports/accounting-export");

  const lo = dsLo?.find((l) => l.id === loId) ?? null;
  const coTheHuy = lo && dsLo ? loCoTheHuy(dsLo)?.id === lo.id : false;

  const taiTep = async () => {
    setDangTaiTep(true);
    try {
      await keToanService.taiTep(lo);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t("Không tải được tệp của lô")));
    } finally {
      setDangTaiTep(false);
    }
  };

  const chepHuongDan = async () => {
    setDangChep(true);
    try {
      const noiDung = await layHuongDan();
      if (noiDung != null) await saoChep(noiDung, { nhan: t("Sao chép hướng dẫn nhập AMIS") });
      else toast.error(t("Không tải được hướng dẫn của lô"));
    } finally {
      setDangChep(false);
    }
  };

  if (loi || (dsLo && chungTu && !lo)) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu loi={loi ?? null} tenChungTu={t("lô xuất kế toán")} onVeDanhSach={veDanhSach}
          nhanVeDanhSach={t("Về Xuất dữ liệu kế toán")} onThuLai={taiLai} />
      </PageContainer>
    );
  }
  if (!dsLo || !chungTu) {
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungDangTai nhan={t("Đang tải lô")} coTienTrinh={false} />
      </PageContainer>
    );
  }

  const daHuy = lo.trangThai === "da_huy";
  const dem = demTheoLoai(chungTu);

  const dau = (
    <DauChungTu
      ma={lo.soLo}
      trangThai={NHAN_LO[lo.trangThai] ?? lo.trangThai}
      dongPhu={[t("Kỳ {{ky}}", { ky: kyChungTu(lo.tuNgay, lo.denNgay) }), t("{{count}} chứng từ", { count: Number(lo.soChungTu) || 0 })]}
      onQuayLai={veDanhSach}
      nhanQuayLai={t("Về Xuất dữ liệu kế toán")}
      saoChepMa={{ giaTri: lo.soLo, nhan: t("Sao chép số lô") }}
      nutPhu={daHuy ? undefined : {
        nhan: t("Sao chép hướng dẫn"),
        icon: Copy,
        dangChay: dangChep,
        onClick: chepHuongDan,
      }}
      nutChinh={{
        nhan: t("Tải tệp"),
        icon: Download,
        // Lô đã hủy: tệp chỉ để đối chiếu, nút viền thay cho nút chính
        kieu: daHuy ? "vien" : "chinh",
        dangChay: dangTaiTep,
        onClick: taiTep,
      }}
      menu={coTheHuy ? [{
        nhan: t("Hủy lô"),
        icon: Ban,
        nguyHiem: true,
        moTa: t("Chỉ lô mới nhất hủy được, để các lô trên AMIS luôn nối tiếp nhau."),
        onSelect: () => setHuyLo(true),
      }] : undefined}
    />
  );

  const thongBao = daHuy ? (
    <DongThongBao tone="warn">
      {t("Lô đã hủy lúc {{luc}} bởi {{nguoi}}. Chứng từ của lô vào lô sau; tệp chỉ để đối chiếu.", { luc: formatDateTime(lo.huyLuc), nguoi: lo.nguoiHuy || "—" })}
    </DongThongBao>
  ) : null;

  const chinh = (
    <div className="flex min-w-0 flex-col">
      <section aria-labelledby={`${idMuc}-ct`}>
        <TieuDeMuc id={`${idMuc}-ct`} phu={daHuy ? null : t("Mở khóa để chứng từ vào lô sau")}>{t("Chứng từ trong lô")}</TieuDeMuc>
        {chungTu.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-bo-muted sm:px-6">{t("Lô không có chứng từ.")}</p>
        ) : (
          <div className={KHUNG_CUON}>
            <table className={cn(BANG, "@2xl/khoi:min-w-[680px]")}>
              <thead>
                <tr className={DONG_TIEU_DE}>
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>{t("Chứng từ")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-40")}>{t("Loại")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-32")}>{t("Ngày hạch toán")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, "w-28 text-right @2xl/khoi:w-32")}>{t("Tổng tiền")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-44")}>{t("Trạng thái")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-14")}><span className="sr-only">{t("Thao tác")}</span></th>
                </tr>
              </thead>
              <tbody>
                {nhomTheoLoai(chungTu).flatMap((n) => n.chungTu).map((ct) => {
                  const den = duongDanChungTu(ct.loai, ct.idNguon);
                  const trangThai = (
                    <>
                      <StatusBadge label={NHAN_CHUNG_TU[ct.trangThai] ?? ct.trangThai} />
                      {ct.trangThai === "da_mo_khoa" ? (
                        <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
                          {ct.moKhoaLuc ? formatDateTime(ct.moKhoaLuc) : ""}{ct.nguoiMoKhoa ? ` · ${ct.nguoiMoKhoa}` : ""}
                          {ct.lyDoMoKhoa ? <span className="block">{ct.lyDoMoKhoa}</span> : null}
                        </span>
                      ) : null}
                    </>
                  );
                  return (
                    <tr key={ct.id} className={DONG}>
                      <td className={cn(O, O_DAU, "align-top")}>
                        {den ? (
                          <Link to={den} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{ct.soChungTu}</Link>
                        ) : (
                          <span className="whitespace-nowrap font-medium text-bo-foreground">{ct.soChungTu}</span>
                        )}
                        <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>{tenLoai(ct.loai)} · {hienNgay(ct.ngayHachToan)}</span>
                        <div className={cn("mt-1", CHI_DIEN_THOAI)}>{trangThai}</div>
                      </td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap align-top")}>{tenLoai(ct.loai)}</td>
                      <td className={cn(O, AN_DIEN_THOAI, "whitespace-nowrap align-top")}>{hienNgay(ct.ngayHachToan)}</td>
                      <td className={cn(O, "whitespace-nowrap text-right align-top")}>{tien(ct.tongTien)}</td>
                      <td className={cn(O, AN_DIEN_THOAI, "align-top")}>{trangThai}</td>
                      <td className={cn(O, O_CUOI, "py-2 text-right align-top")}>
                        {ct.trangThai === "da_xuat" && !daHuy ? (
                          <RowActionButton icon={LockOpen} tone="danger" label={t("Mở khóa {{soChungTu}}", { soChungTu: ct.soChungTu })} onClick={() => setMoKhoa(ct)} />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border-t border-bo-border">
        <button type="button" onClick={() => setMoHuongDan((m) => !m)} aria-expanded={moHuongDan}
          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-bo-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bo-primary/30 sm:px-6">
          <span>
            <span className="block text-base font-semibold leading-6 text-bo-foreground">{t("Hướng dẫn nhập AMIS")}</span>
            <span className="block text-[13px] leading-5 text-bo-muted">{t("Đúng bản 00_HUONG_DAN.txt trong tệp nén của lô")}</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-bo-muted transition-transform", moHuongDan && "rotate-180")} aria-hidden="true" />
        </button>
        {moHuongDan ? (
          <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
            {loiHuongDan ? (
              <p className="flex flex-wrap items-center gap-3 text-sm text-bo-danger">
                {loiHuongDan}
                <Button variant="outline" size="sm" className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle" onClick={() => setLoiHuongDan(null)}>{t("Thử lại")}</Button>
              </p>
            ) : huongDan == null ? (
              <p className="flex items-center gap-2 text-sm text-bo-muted"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t("Đang tải hướng dẫn")}</p>
            ) : (
              /* i18n-giu-nguyen: nội dung tệp hướng dẫn gửi kế toán (tiếng Việt, theo menu AMIS) */
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words font-sans text-[13px] leading-6 text-bo-foreground">{huongDan}</pre>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );

  const cotPhai = (
    <CotThuocTinh nhan={t("Thông tin lô")}>
      <NhomThuocTinh nhan={t("Lô")}>
        <BangThuocTinh
          muc={[
            {
              nhan: t("Kỳ chứng từ"),
              giaTri: (
                <>
                  {kyChungTu(lo.tuNgay, lo.denNgay)}
                  {lo.coTonDauKy ? <span className="block text-xs text-bo-muted">{t("Có tồn đầu kỳ")}</span> : null}
                </>
              ),
            },
            {
              nhan: t("Chứng từ"),
              giaTri: (
                <>
                  <span className="tabular-nums">{lo.soChungTu}</span>
                  {dem.length ? (
                    <span className="block text-xs leading-5 text-bo-muted">
                      {dem.map((d) => (
                        <span key={d.ten} className="block">{d.ten} · {d.so}</span>
                      ))}
                    </span>
                  ) : null}
                </>
              ),
            },
            { nhan: t("Tiền khách trả"), giaTri: <span className="tabular-nums">{tien(lo.tongCong)}</span> },
            { nhan: t("Người tạo"), giaTri: lo.nguoiTao },
            { nhan: t("Tạo lúc"), giaTri: <span className="tabular-nums">{formatDateTime(lo.ngayTao)}</span> },
            { nhan: t("Ghi chú"), giaTri: lo.ghiChu, an: !lo.ghiChu },
          ]}
        />
      </NhomThuocTinh>
      <NhomThuocTinh nhan={t("Tệp")}>
        <BangThuocTinh
          muc={[
            { nhan: t("Tên tệp"), giaTri: <span className="break-all">{lo.tenTep}</span> },
            { nhan: t("Dung lượng"), giaTri: dinhDangKichThuoc(lo.kichThuoc) },
            {
              nhan: t("Mã kiểm tra"),
              giaTri: <GiaTriSaoChep giaTri={lo.maBam} className="font-mono text-xs"
                nhanSaoChep={t("Sao chép mã kiểm tra tệp của lô {{soLo}}", { soLo: lo.soLo })} />,
            },
          ]}
        />
      </NhomThuocTinh>
      {daHuy ? (
        <NhomThuocTinh nhan={t("Hủy lô")}>
          <BangThuocTinh
            muc={[
              { nhan: t("Người hủy"), giaTri: lo.nguoiHuy },
              { nhan: t("Hủy lúc"), giaTri: <span className="tabular-nums">{formatDateTime(lo.huyLuc)}</span> },
              { nhan: t("Lý do"), giaTri: lo.lyDoHuy },
            ]}
          />
        </NhomThuocTinh>
      ) : null}
    </CotThuocTinh>
  );

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu dau={dau} thongBao={thongBao} chinh={chinh} cotPhai={cotPhai} />

      {moKhoa ? (
        <HopMoKhoa
          chungTu={moKhoa}
          onDong={() => setMoKhoa(null)}
          onLoiXungDot={taiLai}
          onXong={(kq) => {
            setChungTu((cu) => cu.map((c) => (c.id === kq.id ? kq : c)));
            setMoKhoa(null);
          }}
        />
      ) : null}
      {huyLo ? (
        <HopHuyLo
          lo={lo}
          onDong={() => setHuyLo(false)}
          onLoiXungDot={taiLai}
          onXong={() => {
            setHuyLo(false);
            taiLai();
          }}
        />
      ) : null}
    </PageContainer>
  );
}
