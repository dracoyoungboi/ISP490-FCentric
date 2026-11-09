// src/pages/stock-take/StockTakeUnshelved.jsx
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, Map as MapIcon, MapPinCheck, PackageOpen, Search, Warehouse, X } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import NutPhanDoan from "@/components/chung-tu/NutPhanDoan";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import BangHangChuaCoKe from "@/components/kiem-ke/BangHangChuaCoKe";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import HopXepKe from "@/components/kiem-ke/HopXepKe";
import {
  coTheXep,
  gomTheoLo,
  locHangChuaCoKe,
  soXepDuoc,
  tomTatKetQua,
  tongChuaCoKe,
  xepNgayDuoc,
} from "@/components/kiem-ke/hangChuaCoKe";
import { taiLaiSoHangChuaCoKe } from "@/components/kiem-ke/soHangChuaCoKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useQuayLai from "@/hooks/useQuayLai";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { layHangChuaCoKe, laySoDo, xepKeNhieu } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { t } from "@/i18n";

const NUT_VIEN = "h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle";
const NUT_VIEN_NHO = "h-8 gap-1.5 border-bo-border bg-bo-surface text-[13px] text-bo-foreground hover:bg-bo-surface-subtle";
const RONG = new Set();
/** Số lô nêu tên trong thông báo sau khi xếp; còn lại ghi "và n lô khác". */
const SO_LO_NEU_TEN = 3;

/** Số nguyên dương từ tham số URL, không có / sai thì null. */
const soTuUrl = (params, ten) => {
  const n = Number(params.get(ten));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** "LO1 → A-01-02 · LO2 → B-01-01, B-01-02 · và 3 lô khác". */
function cauTheoLo(phan, maLo, maKe) {
  const lo = gomTheoLo(phan);
  const cau = lo.slice(0, SO_LO_NEU_TEN).map((l) => `${maLo(l.loHangId)} → ${l.ke.map(maKe).join(", ")}`);
  return cau.join(" · ") + (lo.length > SO_LO_NEU_TEN ? t(" · và {{soLo}} lô khác", { count: lo.length - SO_LO_NEU_TEN, soLo: soVN(lo.length - SO_LO_NEU_TEN) }) : "");
}

/**
 * Hàng chưa có kệ (/warehouse/unshelved?khoId=&tuDot=&phieuChuyen=&phieuNhap=): lô còn tồn ở kho mà sổ kệ chưa ghi đủ
 * (tồn lô ở kho − Σ kệ), thường là hàng vừa nhận chuyển kho hoặc khách trả. Gom theo chứng từ nhập; lô có kệ gợi ý đủ chỗ
 * xếp một chạm, chọn nhiều lô xếp một lượt, cần kệ khác / chia kệ thì mở hộp. Chỉ ghi sổ kệ, tồn kho không đổi.
 * `tuDot`: đợt kiểm kê vừa bị chặn vì hàng chưa có kệ (có nút quay lại). `phieuChuyen` / `phieuNhap`: chỉ hàng của một
 * chứng từ (liên kết "Xếp kệ" ở phiếu chuyển kho, phiếu nhập; có nút về chứng từ).
 */
export default function StockTakeUnshelved() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const dotVe = soTuUrl(params, "tuDot");
  const phieuChuyen = soTuUrl(params, "phieuChuyen");
  const phieuNhap = soTuUrl(params, "phieuNhap");
  const kho = useKhoKiemKe();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);

  const tai = useCallback(() => layHangChuaCoKe(kho.khoId), [kho.khoId]);
  const q = useTaiDuLieu(tai, `kk-chua-ke-${kho.khoId}`, { enabled: kho.khoId != null });
  // Đổi kho: danh sách kho cũ còn giữ trong lúc tải — coi như đang tải, không hiện lô của kho cũ
  const duLieu = q.dungKhoa ? q.data : undefined;
  // Danh sách rỗng: kho chưa khai báo kệ nào (máy chủ coi là kho không quản lý kệ, trả rỗng) hay đã xếp hết? Tra sơ đồ kệ
  const taiSoDo = useCallback(() => laySoDo(kho.khoId), [kho.khoId]);
  const soDo = useTaiDuLieu(taiSoDo, `kk-chua-ke-so-do-${kho.khoId}`, { enabled: kho.khoId != null && Array.isArray(duLieu) && duLieu.length === 0 });
  const khoChuaCoKe = soDo.dungKhoa && !soDo.loading && !soDo.error
    && !(soDo.data?.khuVuc ?? []).some((kv) => (kv.ke ?? []).length > 0);

  const [tim, setTim] = useState("");
  const [loc, setLoc] = useState("tat-ca");
  const [nhom, setNhom] = useState("phieu");
  // Lô đang chọn gắn với kho: một lô có hàng chưa có kệ ở nhiều kho, đổi kho thì lựa chọn cũ không còn hiệu lực
  const [chonTheoKho, setChonTheoKho] = useState({ khoId: null, ids: RONG });
  const chon = chonTheoKho.khoId === kho.khoId ? chonTheoKho.ids : RONG;
  const [dangXep, setDangXep] = useState(() => new Set());
  // Hộp xếp kệ: `phien` đổi mỗi lần mở (hộp dựng lại với lô mới), giữ nguyên khi đóng để Radix trả tiêu điểm
  const [hop, setHop] = useState({ phien: 0, mo: false, ds: [] });
  const [dangChayHop, setDangChayHop] = useState(false);
  const [loiHop, setLoiHop] = useState(null);
  const [lanTaiKe, setLanTaiKe] = useState(0);
  // Sau khi xếp, dòng (và nút vừa bấm) biến mất: đưa tiêu điểm về bảng để người dùng bàn phím không mất chỗ
  const bangRef = useRef(null);

  const theoChungTu = useMemo(() => locHangChuaCoKe(duLieu, { phieuChuyen, phieuNhap }), [duLieu, phieuChuyen, phieuNhap]);
  const ds = useMemo(() => locHangChuaCoKe(theoChungTu, { tim, loc }), [theoChungTu, tim, loc]);
  const tong = tongChuaCoKe(theoChungTu);
  const soXepNgay = theoChungTu.filter(xepNgayDuoc).length;
  // Thanh "Đã chọn" chỉ tính lô đang hiện và xếp được (lô bị tìm kiếm / bộ lọc ẩn đi không bị xếp ngoài ý muốn)
  const daChon = ds.filter((h) => chon.has(h.loHangId) && coTheXep(h));
  const daChonXepNgay = daChon.filter(xepNgayDuoc);
  const khoa = dangXep.size > 0 || dangChayHop;

  useTaiLaiKhiQuayLai(() => q.reload(), { bat: !q.loading && !hop.mo && !khoa, lanCuoi: q.capNhatLuc });

  const doiChon = (ids, bat) =>
    setChonTheoKho((cu) => {
      const moi = new Set(cu.khoId === kho.khoId ? cu.ids : RONG);
      ids.forEach((id) => (bat ? moi.add(id) : moi.delete(id)));
      return { khoId: kho.khoId, ids: moi };
    });
  const boChon = () => setChonTheoKho({ khoId: kho.khoId, ids: RONG });

  /** Đổi kho đang xem: bỏ lọc chứng từ (chứng từ thuộc kho cũ). */
  const doiKho = (id) =>
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.set("khoId", String(id));
        moi.delete("phieuChuyen");
        moi.delete("phieuNhap");
        return moi;
      },
      { replace: true },
    );
  const boLocChungTu = () =>
    setParams(
      (cu) => {
        const moi = new URLSearchParams(cu);
        moi.delete("phieuChuyen");
        moi.delete("phieuNhap");
        return moi;
      },
      { replace: true },
    );

  /** Gửi các phần xếp kệ (nhân viên kho đổi kho làm việc về kho đang xem trước, như mọi thao tác ghi theo kho). */
  const ghi = async (phan) => {
    if (!laQtv && getKhoLamViecId() !== kho.khoId) setKhoLamViecId(kho.khoId);
    return tomTatKetQua(await xepKeNhieu(kho.khoId, phan));
  };

  /**
   * Sau một lượt xếp: gỡ lô đã xếp hết phần xếp được khỏi bảng ngay, báo kết quả theo lô, tải lại bảng và số đếm trên
   * menu. `maKeTheoId` (Map id → mã kệ, từ hộp xếp kệ): tên kệ không nằm trong gợi ý của lô.
   */
  const sauKhiXep = (kq, dsLo, maKeTheoId) => {
    const maLo = (id) => dsLo.find((h) => h.loHangId === id)?.maLo ?? "";
    const maKe = (id) =>
      maKeTheoId?.get(id) ?? dsLo.flatMap((h) => [h.keGoiY, ...(h.keLienQuan ?? [])]).find((k) => k?.id === id)?.ma ?? t("kệ đã chọn");
    const daXepTheoLo = new Map();
    kq.daXep.forEach((p) => daXepTheoLo.set(p.loHangId, (daXepTheoLo.get(p.loHangId) ?? 0) + p.soLuong));
    const xepHet = new Set(dsLo.filter((h) => (daXepTheoLo.get(h.loHangId) ?? 0) >= h.chuaCoKe).map((h) => h.loHangId));
    if (xepHet.size) q.setData((cu) => (Array.isArray(cu) ? cu.filter((h) => !xepHet.has(h.loHangId)) : cu));
    if (daXepTheoLo.size) doiChon([...daXepTheoLo.keys()], false);
    if (kq.daXep.length) {
      toast.success(kq.soLoDaXep === 1 ? t("Đã xếp lô {{maLo}} lên kệ", { maLo: maLo(kq.daXep[0].loHangId) }) : t("Đã xếp {{soLo}} lô lên kệ", { count: kq.soLoDaXep, soLo: soVN(kq.soLoDaXep) }), {
        description: t("{{soSanPham}} sản phẩm · {{chiTiet}}", { count: Number(kq.soSanPham) || 0, soSanPham: soVN(kq.soSanPham), chiTiet: cauTheoLo(kq.daXep, maLo, maKe) }),
      });
    }
    if (kq.loi.length) {
      const loLoi = gomTheoLo(kq.loi);
      toast.error(loLoi.length === 1 ? t("Chưa xếp được lô {{maLo}}", { maLo: maLo(loLoi[0].loHangId) }) : t("{{soLo}} lô chưa xếp được", { count: loLoi.length, soLo: soVN(loLoi.length) }), {
        description: loLoi.slice(0, 2).map((l) => `${maLo(l.loHangId)}: ${l.loi.join(" ")}`).join(" · "),
      });
    }
    q.reload();
    taiLaiSoHangChuaCoKe();
    if (!document.activeElement || document.activeElement === document.body) bangRef.current?.focus();
  };

  /** Xếp một chạm vào kệ gợi ý (một lô, cả nhóm hoặc các lô đang chọn); lô không xếp ngay được thì bỏ qua. */
  const xepNgay = async (dsLo) => {
    const ngay = dsLo.filter(xepNgayDuoc);
    if (!ngay.length || khoa) return;
    setDangXep(new Set(ngay.map((h) => h.loHangId)));
    try {
      const kq = await ghi(ngay.map((h) => ({ loHangId: h.loHangId, viTriKhoId: h.keGoiY.id, soLuong: soXepDuoc(h) })));
      sauKhiXep(kq, ngay);
    } catch (error) {
      toast.error(t("Chưa xếp được lên kệ"), { description: getApiErrorMessage(error, t("Lỗi kết nối. Thử lại sau giây lát.")) });
      q.reload();
    } finally {
      setDangXep(new Set());
    }
  };

  const moHop = (dsLo) => {
    const xepDuoc = dsLo.filter(coTheXep);
    if (!xepDuoc.length) return;
    setLoiHop(null);
    setHop((cu) => ({ phien: cu.phien + 1, mo: true, ds: xepDuoc }));
  };
  const dongHop = () => setHop((cu) => ({ ...cu, mo: false }));
  // Lô trong hộp lấy theo dữ liệu mới nhất: sau lần xếp bị từ chối bảng tải lại, hộp thấy số chưa có kệ / chờ nhặt mới
  // (đang lọc theo chứng từ: phần của chứng từ đó)
  const loTrongHop = useMemo(
    () => hop.ds.map((h) => theoChungTu.find((x) => x.loHangId === h.loHangId) ?? h),
    [hop.ds, theoChungTu],
  );
  const xepTuHop = async (phan, maKeTheoId) => {
    setLoiHop(null);
    setDangChayHop(true);
    try {
      const kq = await ghi(phan);
      if (!kq.daXep.length) {
        // Không phần nào ghi được: giữ hộp để người dùng đổi kệ / số; tải lại bảng và sơ đồ kệ (sức chứa có thể đã đổi)
        setLoiHop(gomTheoLo(kq.loi).flatMap((l) => l.loi).join(" ") || t("Chưa xếp được lên kệ"));
        setLanTaiKe((n) => n + 1);
        q.reload();
        return;
      }
      dongHop();
      sauKhiXep(kq, hop.ds, maKeTheoId);
    } catch (error) {
      setLoiHop(getApiErrorMessage(error, t("Chưa xếp được lên kệ. Thử lại sau giây lát.")));
    } finally {
      setDangChayHop(false);
    }
  };

  // Lọc theo chứng từ: nguon của lô đã đổi sang phiếu nhập của chứng từ đang lọc (locHangChuaCoKe)
  const maChungTu = phieuChuyen
    ? theoChungTu.find((h) => h.nguon?.phieuChuyenId === phieuChuyen)?.nguon?.soPhieuChuyen
    : phieuNhap
      ? theoChungTu.find((h) => h.nguon?.phieuNhapId === phieuNhap)?.nguon?.soPhieuNhap
      : null;
  const locChungTu = phieuChuyen != null || phieuNhap != null;
  // Về chứng từ: lùi lịch sử nếu vừa từ chứng từ sang, mở thẳng bằng đường dẫn thì mở chứng từ
  const quayLaiChungTu = useQuayLai(phieuChuyen ? `/transfer-tickets/${phieuChuyen}` : `/goods-receipts/${phieuNhap}`);
  const veChungTu = locChungTu ? quayLaiChungTu : null;

  const khongCoKho = !kho.dangTai && !kho.loi && !kho.dsKho.length;
  const veDot = dotVe ? () => navigate(`/stock-take/${dotVe}`) : null;
  const dangTai = kho.dangTai || (q.loading && !q.dungKhoa);

  const thanBang = dangTai ? (
    <LoadingState rows={5} label={t("Đang tải hàng chưa có kệ")} />
  ) : q.error && !duLieu ? (
    <ErrorState description={t("Không tải được: {{error}}.", { error: getApiErrorMessage(q.error, t("lỗi kết nối")) })} onRetry={q.reload} />
  ) : !theoChungTu.length && khoChuaCoKe ? (
    <EmptyState
      icon={MapIcon}
      title={t("Kho chưa khai báo kệ nào")}
      description={t("Kho này chưa quản lý vị trí kệ nên không có hàng nào cần xếp. Muốn quản lý kệ, thêm kệ ở Vị trí kệ; tồn hiện có sẽ hiện ở đây để xếp.")}
      action={
        <Button variant="outline" onClick={() => navigate("/warehouse/locations")} className={NUT_VIEN}>
          <MapIcon className="size-4" />
          {t("Vị trí kệ")}
        </Button>
      }
    />
  ) : !theoChungTu.length ? (
    <EmptyState
      icon={CircleCheck}
      title={locChungTu ? t("Hàng của chứng từ này đã lên kệ hết") : t("Mọi hàng trong kho đã có kệ")}
      description={
        locChungTu
          ? t("Xem cả kho để xếp hàng của các chứng từ khác.")
          : veDot
            ? t("Sổ kệ khớp tồn lô. Quay lại đợt kiểm kê để bắt đầu.")
            : t("Người nhặt hàng thấy đủ chỗ lấy; kiểm kê toàn kho, theo danh mục bắt đầu được.")
      }
      action={
        locChungTu ? (
          <Button variant="outline" onClick={boLocChungTu} className={NUT_VIEN}>
            {t("Xem cả kho")}
          </Button>
        ) : veDot ? (
          <Button onClick={veDot} className="gap-2">
            <ArrowLeft className="size-4" />
            {t("Về đợt kiểm kê")}
          </Button>
        ) : undefined
      }
    />
  ) : !ds.length ? (
    <EmptyState
      icon={Search}
      title={tim.trim() ? t("Không có lô nào khớp “{{tuKhoa}}”", { tuKhoa: tim.trim() }) : t("Không có lô nào trong mục này")}
      description={tim.trim() ? t("Thử mã lô, SKU hoặc tên sản phẩm khác.") : t("Chọn Tất cả để xem mọi lô chưa có kệ.")}
      action={
        <Button
          variant="outline"
          onClick={() => {
            setTim("");
            setLoc("tat-ca");
          }}
          className={NUT_VIEN}
        >
          {t("Xóa bộ lọc")}
        </Button>
      }
    />
  ) : (
    <div ref={bangRef} tabIndex={-1} aria-label={t("Danh sách hàng chưa có kệ")} className="outline-none">
      <BangHangChuaCoKe
        ds={ds}
        nhom={nhom}
        chon={chon}
        onDoiChon={doiChon}
        dangXep={dangXep}
        khoa={khoa}
        onXepNgay={xepNgay}
        onMoHop={moHop}
      />
    </div>
  );

  const thanhChon = daChon.length ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-[13px] tabular-nums text-bo-foreground">
        <b className="font-semibold">{t("Đã chọn {{soLo}} lô", { count: daChon.length, soLo: soVN(daChon.length) })}</b>
        <span className="text-bo-muted"> · {t("{{soSp}} sản phẩm xếp được", { count: daChon.reduce((s, h) => s + soXepDuoc(h), 0), soSp: soVN(daChon.reduce((s, h) => s + soXepDuoc(h), 0)) })}</span>
      </span>
      <NutChu onClick={boChon}>{t("Bỏ chọn")}</NutChu>
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {daChonXepNgay.length && daChonXepNgay.length < daChon.length ? (
          <span className="text-xs text-bo-muted">{t("{{soLo}} lô cần chọn kệ sẽ để lại", { count: daChon.length - daChonXepNgay.length, soLo: soVN(daChon.length - daChonXepNgay.length) })}</span>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => moHop(daChon)} disabled={khoa} className={NUT_VIEN_NHO}>
          <PackageOpen className="size-3.5" />
          {t("Chọn một kệ cho {{soLo}} lô", { count: daChon.length, soLo: soVN(daChon.length) })}
        </Button>
        {daChonXepNgay.length ? (
          <Button size="sm" onClick={() => xepNgay(daChonXepNgay)} disabled={khoa} className="h-8 gap-1.5 text-[13px]">
            <MapPinCheck className="size-3.5" />
            {t("Xếp {{soLo}} lô theo gợi ý", { count: daChonXepNgay.length, soLo: soVN(daChonXepNgay.length) })}
          </Button>
        ) : null}
      </span>
    </div>
  ) : null;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title={t("Hàng chưa có kệ")}
        actions={
          <>
            {veChungTu ? (
              <Button variant="outline" onClick={veChungTu} className={NUT_VIEN}>
                <ArrowLeft className="size-4" />
                {phieuChuyen ? t("Về phiếu chuyển") : t("Về phiếu nhập")}
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => navigate("/warehouse/locations")} className={NUT_VIEN}>
              <MapIcon className="size-4" />
              {t("Vị trí kệ")}
            </Button>
          </>
        }
      />

      {kho.loi ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState
            title={t("Không tải được danh sách kho")}
            description={t("{{loi}}. Thử lại sau giây lát.", { loi: getApiErrorMessage(kho.loi, t("Lỗi kết nối")) })}
            onRetry={kho.taiLai}
          />
        </div>
      ) : khongCoKho ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <EmptyState
            icon={Warehouse}
            title={laQtv ? t("Chưa có kho giao dịch nào") : t("Bạn chưa được phân kho nào")}
            description={laQtv ? t("Tạo kho trước rồi quay lại để xếp hàng lên kệ.") : t("Nhờ quản trị viên phân kho để xem hàng chưa có kệ.")}
          />
        </div>
      ) : (
        <>
          {theoChungTu.length ? (
            veDot ? (
              <DongThongBao tone="warn" actions={<NutChu onClick={veDot}>{t("Về đợt kiểm kê")}</NutChu>}>
                {t("Đợt kiểm kê chưa bắt đầu được vì còn hàng chưa có kệ. Xếp hết các lô dưới đây rồi quay lại đợt.")}{" "}
                <span className="text-bo-muted">{t("Chỉ ghi sổ kệ, tồn kho không đổi.")}</span>
              </DongThongBao>
            ) : (
              <DongThongBao tone="info">
                {t("Hàng đã vào kho nhưng chưa ghi ở kệ nào: người nhặt hàng không thấy chỗ lấy, kiểm kê toàn kho chưa bắt đầu được.")}{" "}
                <span className="text-bo-muted">{t("Xếp kệ chỉ ghi sổ kệ, tồn kho không đổi.")}</span>
              </DongThongBao>
            )
          ) : null}

          <TableShell
            fill
            footer={thanhChon}
            toolbar={
              <div className="grid gap-3 border-b border-bo-border px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  {kho.dsKho.length ? (
                    <ChonKhoKiemKe dsKho={kho.dsKho} value={kho.khoId} onChange={doiKho} className="w-full sm:w-[240px]" />
                  ) : null}
                  <label className="relative flex min-w-[220px] max-w-sm flex-1 items-center">
                    <span className="sr-only">{t("Tìm lô")}</span>
                    <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
                    <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder={t("Tìm mã lô, SKU, tên sản phẩm")} className={cn(O_NHAP, "pl-8")} />
                  </label>
                  {locChungTu ? (
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-bo-primary-soft pl-3 pr-1 text-[13px] font-medium text-bo-primary-strong">
                      {phieuChuyen ? t("Phiếu chuyển") : t("Phiếu nhập")} <span className="font-mono">{maChungTu ?? `#${phieuChuyen ?? phieuNhap}`}</span>
                      <button
                        type="button"
                        onClick={boLocChungTu}
                        aria-label={t("Bỏ lọc chứng từ, xem cả kho")}
                        className="grid size-6 place-items-center rounded-full hover:bg-white/70"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ) : null}
                  <span className="flex items-center gap-2 lg:ml-auto">
                    <span className="text-xs text-bo-muted">{t("Xem")}</span>
                    <NutPhanDoan
                      nhan={t("Cách xem")}
                      value={nhom}
                      onChange={setNhom}
                      luaChon={[
                        { value: "phieu", label: t("Theo chứng từ") },
                        { value: "lo", label: t("Từng lô") },
                      ]}
                    />
                  </span>
                </div>
                {theoChungTu.length ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <NutPhanDoan
                      nhan={t("Lọc lô")}
                      value={loc}
                      onChange={setLoc}
                      luaChon={[
                        { value: "tat-ca", label: t("Tất cả"), count: tong.soLo },
                        { value: "ngay", label: t("Xếp ngay được"), count: soXepNgay },
                        { value: "chon", label: t("Cần chọn kệ"), count: tong.soLo - soXepNgay },
                      ]}
                    />
                    <span className="text-[13px] tabular-nums text-bo-muted">
                      {t("{{soLo}} lô ·", { count: tong.soLo, soLo: soVN(tong.soLo) })} <b className="font-semibold text-bo-foreground">{soVN(tong.soLuong)}</b> {t("sản phẩm chưa có kệ")}
                    </span>
                  </div>
                ) : null}
              </div>
            }
          >
            {thanBang}
          </TableShell>
        </>
      )}

      <HopXepKe
        key={hop.phien}
        mo={hop.mo}
        dsLo={loTrongHop}
        khoId={kho.khoId}
        dangChay={dangChayHop}
        loi={loiHop}
        lanTaiKe={lanTaiKe}
        onDoiMo={(m) => !m && !dangChayHop && dongHop()}
        onSua={() => setLoiHop(null)}
        onXep={xepTuHop}
      />
    </PageContainer>
  );
}
