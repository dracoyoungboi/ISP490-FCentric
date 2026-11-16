import { useEffect, useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, ChevronDown, ChevronsDownUp, ChevronsUpDown, Download, LockOpen } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import CotThuocTinh, { BangThuocTinh, GiaTriSaoChep, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import { coCongCu, docSo, macDinhThuGon, nhomDangMo, soVN } from "@/components/chung-tu/bangChungTu";
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
import { Button } from "@/components/ui/button";
import { RowActionButton } from "@/components/shared/RowActions";
import StatusBadge from "@/components/shared/StatusBadge";
import { HopHuyLo, HopMoKhoa } from "@/components/ke-toan/HopKeToan";
import {
  NHAN_CHUNG_TU,
  NHAN_LO,
  coTien,
  demTheoLoai,
  dinhDangKichThuoc,
  duongDanChungTu,
  hienNgay,
  kyChungTu,
  loCoTheHuy,
  nhomTheoLoai,
  tenLoai,
} from "@/components/ke-toan/tinhKeToan";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { NGUONG_THU_GON } from "@/config/bangChungTu";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { t } from "@/i18n";

const tien = (v) => (Number(v) ? formatCurrency(v) : "—");

/** Ô đầu của dòng chứng từ dưới dòng nhóm: chữ thẳng hàng với tên loại (lề khối + mũi tên 16px + khoảng 12px). */
const O_DAU_CON = "pl-11 sm:pl-[52px]";

/**
 * Dòng nhóm một loại chứng từ (cùng nền, mũi tên, cách bấm cả dòng như DongNhomSanPham của bảng hàng). `thuGonDuoc`
 * false (lô ít chứng từ, hoặc loại chỉ một chứng từ): dòng cố định, không mũi tên.
 */
function DongNhomLoai({ ten, soChungTu, soMoKhoa, tongTien, mo, thuGonDuoc, onDoi, idVung }) {
  const noiDung = (
    <span className="block min-w-0">
      <span className="block font-medium leading-5 text-bo-foreground">{ten}</span>
      <span className="mt-0.5 block text-xs leading-4 text-bo-muted">
        {t("{{count}} chứng từ", { count: soChungTu })}
        {soMoKhoa ? (
          <span className="font-medium text-bo-warning">
            {" · "}{t("{{count}} đã mở khóa", { count: soMoKhoa })}
          </span>
        ) : null}
      </span>
    </span>
  );
  const bamDong = (suKien) => {
    if (suKien.target.closest("button, a")) return;
    onDoi();
  };
  return (
    <tr
      onClick={thuGonDuoc ? bamDong : undefined}
      className={cn(
        "border-b border-slate-100 bg-bo-row-group tabular-nums",
        thuGonDuoc && "cursor-pointer hover:bg-bo-row-group-hover",
      )}
    >
      <td className="p-0">
        {thuGonDuoc ? (
          <button
            type="button"
            aria-expanded={mo}
            aria-controls={idVung}
            onClick={onDoi}
            className="flex w-full min-w-0 items-center gap-3 py-2.5 pl-4 pr-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary sm:pl-6"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-slate-400 transition-transform duration-150 motion-reduce:transition-none",
                !mo && "-rotate-90",
              )}
              aria-hidden="true"
            />
            {noiDung}
          </button>
        ) : (
          <div className={cn("py-2.5 pr-3", O_DAU_CON)}>{noiDung}</div>
        )}
      </td>
      <td className={AN_DIEN_THOAI} />
      <td className={cn(O, "whitespace-nowrap text-right font-semibold")}>{tongTien}</td>
      <td className={AN_DIEN_THOAI} />
      <td className={O_CUOI} />
    </tr>
  );
}

/** Tiêu đề một mục trong thân khối chứng từ (cùng kiểu trang Tạo lô xuất). */
function TieuDeMuc({ id, children, phu, nut }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pb-3 pt-5 sm:px-6">
      <h2 id={id} className="text-base font-semibold leading-6 text-bo-foreground">{children}</h2>
      {phu || nut ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {phu ? <span className="text-[13px] leading-5 text-bo-muted">{phu}</span> : null}
          {nut}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Chi tiết một lô xuất kế toán (khung chứng từ hai cột như Chi tiết phiếu chuyển kho): thân là chứng từ trong lô (mở khóa
 * từng chứng từ); cột phải là thông tin lô, tệp, việc hủy. Hướng dẫn nhập AMIS không hiện ở đây: đã có sẵn trong tệp nén
 * (00_HUONG_DAN.txt). Nút chính Tải tệp; Hủy lô ở ⋯, chỉ lô còn hiệu lực mới nhất. Chỉ quản trị viên.
 */
export default function ChiTietLoKeToan() {
  const { id } = useParams();
  const idMuc = useId();
  const navigate = useNavigate();
  const loId = Number(id);

  const [dsLo, setDsLo] = useState(null);
  const [chungTu, setChungTu] = useState(null);
  const [loi, setLoi] = useState(null);
  const [lanTai, setLanTai] = useState(0);
  const [dangTaiTep, setDangTaiTep] = useState(false);
  const [moKhoa, setMoKhoa] = useState(null);
  const [huyLo, setHuyLo] = useState(false);
  // Nhóm loại người dùng đã bấm mở / thu gọn: { [loai]: boolean }; chưa bấm thì theo mặc định (nhomDangMo)
  const [moNhom, setMoNhom] = useState({});

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

  // Gom theo loại như bảng hàng của các chứng từ khác: quá NGUONG_CONG_CU chứng từ thì nhóm gập được, quá NGUONG_THU_GON
  // thì thu gọn sẵn. Loại có chứng từ đã mở khóa luôn mở sẵn để không giấu việc cần chú ý; loại một chứng từ không gập.
  const congCu = coCongCu(chungTu.length);
  const thuGonMacDinh = macDinhThuGon(chungTu.length);
  const nhom = nhomTheoLoai(chungTu).map((n) => {
    const soMoKhoa = n.chungTu.filter((c) => c.trangThai === "da_mo_khoa").length;
    const thuGonDuoc = congCu && n.chungTu.length > 1;
    return {
      ...n,
      soMoKhoa,
      thuGonDuoc,
      tongTien: n.chungTu.reduce((s, c) => s + docSo(c.tongTien), 0),
      mo: nhomDangMo(n.loai, { moNhom, thuGonDuoc, thuGonMacDinh: thuGonMacDinh && !soMoKhoa }),
    };
  });
  const nhomGap = nhom.filter((n) => n.thuGonDuoc);
  const moHet = nhomGap.every((n) => n.mo);
  const doiNhom = (n) => setMoNhom((cu) => ({ ...cu, [n.loai]: !n.mo }));
  const doiMoTatCa = () => setMoNhom(Object.fromEntries(nhomGap.map((n) => [n.loai, !moHet])));
  const nutMoHet = nhomGap.length ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={doiMoTatCa}
      className="h-8 gap-1.5 border-bo-border bg-bo-surface px-2.5 text-[13px] font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
    >
      {moHet ? <ChevronsDownUp className="size-3.5" aria-hidden="true" /> : <ChevronsUpDown className="size-3.5" aria-hidden="true" />}
      {moHet ? t("Thu gọn tất cả") : t("Mở tất cả")}
    </Button>
  ) : null;

  const dau = (
    <DauChungTu
      ma={lo.soLo}
      trangThai={NHAN_LO[lo.trangThai] ?? lo.trangThai}
      dongPhu={[t("Kỳ {{ky}}", { ky: kyChungTu(lo.tuNgay, lo.denNgay) }), t("{{count}} chứng từ", { count: Number(lo.soChungTu) || 0 })]}
      onQuayLai={veDanhSach}
      nhanQuayLai={t("Về Xuất dữ liệu kế toán")}
      saoChepMa={{ giaTri: lo.soLo, nhan: t("Sao chép số lô") }}
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
        <TieuDeMuc id={`${idMuc}-ct`} phu={daHuy ? null : t("Mở khóa để chứng từ vào lô sau")} nut={nutMoHet}>
          {t("Chứng từ trong lô")}
        </TieuDeMuc>
        {thuGonMacDinh && !moHet ? (
          <p className="-mt-1 px-4 pb-3 text-[13px] leading-5 text-bo-muted sm:px-6">
            {t("Hơn {{nguong}} chứng từ nên đang thu gọn theo loại. Bấm một loại để xem từng chứng từ.", { nguong: soVN(NGUONG_THU_GON) })}
          </p>
        ) : null}
        {chungTu.length === 0 ? (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-bo-muted sm:px-6">{t("Lô không có chứng từ.")}</p>
        ) : (
          <div className={KHUNG_CUON}>
            <table className={cn(BANG, "@2xl/khoi:min-w-[600px]")}>
              <thead>
                <tr className={DONG_TIEU_DE}>
                  <th scope="col" className={cn(O_TIEU_DE, O_DAU)}>{t("Chứng từ")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-32")}>{t("Ngày hạch toán")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, "w-28 text-right @2xl/khoi:w-36")}>{t("Tổng tiền")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, AN_DIEN_THOAI, "w-44")}>{t("Trạng thái")}</th>
                  <th scope="col" className={cn(O_TIEU_DE, O_CUOI, "w-14")}><span className="sr-only">{t("Thao tác")}</span></th>
                </tr>
              </thead>
              {nhom.map((n, iNhom) => {
                const idVung = `${idMuc}-nhom-${iNhom}`;
                return (
                  <tbody key={n.loai} id={idVung}>
                    <DongNhomLoai
                      ten={n.ten}
                      soChungTu={n.chungTu.length}
                      soMoKhoa={n.soMoKhoa}
                      tongTien={coTien(n.loai) ? tien(n.tongTien) : "—"}
                      mo={n.mo}
                      thuGonDuoc={n.thuGonDuoc}
                      onDoi={() => doiNhom(n)}
                      idVung={idVung}
                    />
                    {n.mo ? n.chungTu.map((ct) => {
                  const den = duongDanChungTu(ct.loai, ct.idNguon);
                  // Loại chi tiết chỉ hiện khi khác tên nhóm (vd. "Trả hàng tại quầy" trong nhóm Hàng bán trả lại)
                  const loaiRieng = tenLoai(ct.loai) !== n.ten ? tenLoai(ct.loai) : null;
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
                      <td className={cn(O, O_DAU_CON, "align-top")}>
                        {den ? (
                          <Link to={den} className="whitespace-nowrap font-medium text-bo-primary hover:text-bo-primary-hover hover:underline">{ct.soChungTu}</Link>
                        ) : (
                          <span className="whitespace-nowrap font-medium text-bo-foreground">{ct.soChungTu}</span>
                        )}
                        {loaiRieng ? <span className={cn("block text-xs text-bo-muted", AN_DIEN_THOAI)}>{loaiRieng}</span> : null}
                        <span className={cn("block text-xs text-bo-muted", CHI_DIEN_THOAI)}>
                          {[loaiRieng, hienNgay(ct.ngayHachToan)].filter(Boolean).join(" · ")}
                        </span>
                        <div className={cn("mt-1", CHI_DIEN_THOAI)}>{trangThai}</div>
                      </td>
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
                    }) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
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
