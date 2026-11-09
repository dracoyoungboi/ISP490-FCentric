import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CircleCheckBig, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import NutSaoChep from "@/components/shared/NutSaoChep";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { taiLaiSoChuyenKhoanCanXuLy, useSoChuyenKhoanCanXuLy } from "@/components/pos/payosCanXuLy";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { posService } from "@/services/posService";
import { getMineKhoList } from "@/services/khoService";
import { laKhoBanTaiQuay } from "@/utils/kho";
import { formatCurrency, formatDateTime } from "@/utils/formatters";
import { toast } from "@/lib/thongBaoNhanh";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { canTraLaiTienMat, tienMatTruocCua } from "@/pages/pos/pos-payment";
import { t } from "@/i18n";
import { cauGocCuaLoi } from "@/i18n/cauGoc";

/**
 * Đối soát chuyển khoản (quản trị viên). Tab "Cần xử lý": tiền khách ĐÃ chuyển qua mã QR tại quầy nhưng hệ thống
 * chưa tạo được đơn (PAID_ERROR). Mỗi khoản là một thẻ kể bằng lời chuyện gì đã xảy ra, gợi ý nên làm gì và đúng
 * hai lối ra: bán cho khách (tạo đơn) hoặc trả lại tiền (cửa hàng tự chuyển trả, hệ thống chỉ ghi lại).
 * Tab "Đã xử lý": lịch sử, lọc được cả mọi mã QR để đối chiếu với my.payos.vn.
 */

const TAB_CAN_XU_LY = "can-xu-ly";
const TAB_DA_XU_LY = "da-xu-ly";

// Bộ lọc tab Đã xử lý -> tham số API
const BO_LOC_DA_XU_LY = [
  { value: "quan-ly", label: t("Quản lý đã xử lý"), params: { daXuLy: true } },
  { value: "ban", label: t("Đã bán cho khách"), params: { daXuLy: true, trangThai: "PAID" } },
  { value: "tra-lai", label: t("Đã trả lại tiền"), params: { trangThai: "REFUNDED" } },
  { value: "moi-ma-qr", label: t("Mọi mã QR"), params: {} },
];

// Nhãn StatusBadge: giữ tiếng Việt (badge tự dịch lúc vẽ, tra màu theo tên Việt); chỗ khác bọc t(nhanTrangThai(gd))
const NHAN_TRANG_THAI = {
  PAID_ERROR: "Chờ xử lý", // i18n-giu-nguyen: nhãn StatusBadge
  PENDING: "Chờ thanh toán", // i18n-giu-nguyen: nhãn StatusBadge
  REFUNDED: "Đã trả lại tiền", // i18n-giu-nguyen: nhãn StatusBadge
  CANCELLED: "Đã hủy", // i18n-giu-nguyen: nhãn StatusBadge
  EXPIRED: "Hết hạn", // i18n-giu-nguyen: nhãn StatusBadge
  FAILED: "Lỗi", // i18n-giu-nguyen: nhãn StatusBadge
};
const nhanTrangThai = (gd) =>
  // i18n-giu-nguyen: nhãn StatusBadge
  gd.trangThai === "PAID" ? (gd.tenNguoiXuLy || gd.xuLyLuc ? "Đã bán cho khách" : "Đã thanh toán") : NHAN_TRANG_THAI[gd.trangThai] ?? gd.trangThai;

const LOAD_ERROR_MESSAGE = t("Không tải được danh sách chuyển khoản. Vui lòng thử lại.");
const headCell = "h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

const soTien = (v) => (v == null ? null : Number(v));
// Đã bán: số tiền của đơn (tổng hóa đơn), không phải số khách chuyển (có thể dư); còn lại: số khách đã chuyển
const soTienHienThi = (gd) => (gd.trangThai === "PAID" ? soTien(gd.soTien) : soTien(gd.soTienDaNhan ?? gd.soTien));
const tenKhach = (gd) => (gd.tenNguoiChuyen ? t("Khách {{ten}}", { ten: gd.tenNguoiChuyen }) : t("Khách"));
const gio = (iso) => (iso ? formatDateTime(iso) : "—");
// Trả kết hợp: tiền mặt khách đưa trước tại quầy (mã QR chỉ mang phần còn lại); 0 = không có
const tienMatTruoc = tienMatTruocCua;

/** Một câu về phần tiền mặt khách đưa trước: đã vào đơn, đang giữ ở quầy, cần trả lại hay đã trả lại (ai, lúc nào). */
function cauTienMat(gd) {
  const tm = tienMatTruoc(gd);
  if (!tm) return null;
  if (gd.tienMatTraLaiLuc) {
    return gd.tenNguoiTraLaiTienMat
      ? t("Tiền mặt khách đưa trước {{tm}} đã trả lại khách lúc {{gio}} ({{ten}} xác nhận).", { tm: formatCurrency(tm), gio: gio(gd.tienMatTraLaiLuc), ten: gd.tenNguoiTraLaiTienMat })
      : t("Tiền mặt khách đưa trước {{tm}} đã trả lại khách lúc {{gio}}.", { tm: formatCurrency(tm), gio: gio(gd.tienMatTraLaiLuc) });
  }
  if (gd.trangThai === "PAID") return t("Kèm {{tm}} tiền mặt khách đưa trước tại quầy (đã vào đơn bán).", { tm: formatCurrency(tm) });
  const quay = gd.tenThuNgan ? t("thu ngân {{ten}}", { ten: gd.tenThuNgan }) : t("quầy");
  if (canTraLaiTienMat(gd)) return t("Cần trả lại khách {{tm}} tiền mặt đưa trước — {{quay}} chưa xác nhận đã trả.", { tm: formatCurrency(tm), quay });
  return t("Khách đã đưa trước {{tm}} tiền mặt tại quầy — {{quay}} đang giữ.", { tm: formatCurrency(tm), quay });
}

/** "chờ 15 phút" / "chờ 2 giờ" / "chờ 3 ngày" tính từ lúc tiền về. */
function thoiGianCho(iso) {
  if (!iso) return null;
  const phut = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (phut < 60) return { text: t("chờ {{count}} phút", { count: phut }), lau: false };
  const gioCho = Math.floor(phut / 60);
  if (gioCho < 24) return { text: t("chờ {{count}} giờ", { count: gioCho }), lau: false };
  return { text: t("chờ {{count}} ngày", { count: Math.floor(gioCho / 24) }), lau: true };
}

/** "mã QR đã hết hạn lúc 14:15" hay "thu ngân đã hủy mã QR" — tiền về trước hạn mà mã đã đóng là bị hủy tay. */
function maQrDaDong(gd) {
  const truocHan = gd.thanhToanLuc && gd.hetHanLuc && new Date(gd.thanhToanLuc) <= new Date(gd.hetHanLuc);
  return truocHan ? t("thu ngân đã hủy mã QR trước khi tiền về") : t("mã QR đã hết hạn lúc {{gio}}", { gio: gio(gd.hetHanLuc) });
}

/**
 * Kể bằng lời: chuyện gì đã xảy ra + nên làm gì, theo lý do máy chủ trả về. Tiền về sau khi mã đã hủy mà khách có đưa
 * trước tiền mặt: tiền mặt phải trả lại khách nên khoản payOS một mình không đủ trả hóa đơn -> chỉ còn cách trả lại.
 */
function keChuyen(gd) {
  const kq = keChuyenTheoLyDo(gd);
  const tm = tienMatTruoc(gd);
  if (gd.tienVeSauHuy && tm) {
    const traPayos = gd.soTienDaNhan == null ? t("số tiền khách đã chuyển") : formatCurrency(gd.soTienDaNhan);
    return {
      ...kq,
      goiY: gd.tienMatTraLaiLuc
        ? t("Quầy đã trả lại khách {{tm}} tiền mặt đưa trước nên khoản chuyển khoản này không đủ trả hóa đơn: trả lại {{traPayos}} cho khách.", { tm: formatCurrency(tm), traPayos })
        : t("Mã QR đã hủy nên khách phải được trả lại cả {{tm}} tiền mặt đưa trước (quầy chưa xác nhận đã trả) — khoản chuyển khoản này không đủ trả hóa đơn: trả lại {{traPayos}} cho khách, trả tiền mặt rồi bấm Đã trả lại tiền mặt.", { tm: formatCurrency(tm), traPayos }),
    };
  }
  return kq;
}

function keChuyenTheoLyDo(gd) {
  const nhan = soTien(gd.soTienDaNhan);
  const tong = soTien(gd.soTien);
  const lech = nhan == null ? 0 : nhan - tong;
  const thuNgan = gd.tenThuNgan ? t("thu ngân {{ten}}", { ten: gd.tenThuNgan }) : t("quầy");
  const tm = tienMatTruoc(gd);
  const hoaDon = tm
    ? t("hóa đơn {{tongHoaDon}} (mã QR {{maQr}}, còn lại khách trả tiền mặt)", { tongHoaDon: formatCurrency(tong + tm), maQr: formatCurrency(tong) })
    : t("hóa đơn {{tongHoaDon}}", { tongHoaDon: formatCurrency(tong) });
  const quay = `${hoaDon}${gd.tenThuNgan ? ` ${t("của thu ngân {{ten}}", { ten: gd.tenThuNgan })}` : ""}${gd.tenKho ? ` ${t("ở {{kho}}", { kho: gd.tenKho })}` : ""}`;
  const luc = gd.thanhToanLuc ? ` ${t("lúc {{gio}}", { gio: gio(gd.thanhToanLuc) })}` : "";
  // Tiền về khi mã QR đã đóng: món hàng có thể đã bán bằng cách khác -> luôn nói ra, kể cả khi chuyển dư
  const muon = gd.tienVeSauHuy ? ` ${t("Tiền về khi {{trangThaiQr}}.", { trangThaiQr: maQrDaDong(gd) })}` : "";
  const hoiQuay = gd.tienVeSauHuy ? `${t("Hỏi {{thuNgan}} khách đã nhận hàng chưa (có thể món này đã bán bằng cách khác).", { thuNgan })} ` : "";
  switch (gd.lyDo) {
    case "CHUA_RO_SO_TIEN":
      return {
        nhan: t("Chưa rõ số tiền"),
        loai: "bad",
        chuyen: t("Đã có tiền chuyển khoản cho {{quay}} nhưng chưa rõ khách chuyển bao nhiêu.{{muon}}", { quay, muon }),
        goiY: t("Tra sao kê ngân hàng theo nội dung chuyển khoản (trong Chi tiết kỹ thuật) rồi trả lại đúng số tiền khách đã chuyển."),
      };
    case "CHUYEN_THIEU":
      return {
        nhan: t("Chuyển thiếu {{soTien}}", { soTien: formatCurrency(-lech) }),
        loai: "bad",
        chuyen: t("{{khach}} mới chuyển {{soTien}}{{luc}} cho {{quay}}.{{muon}}", { khach: tenKhach(gd), soTien: formatCurrency(nhan), luc, quay, muon }),
        goiY: t("Chuyển thiếu thì không bán được. Trả lại {{soTien}} cho khách, rồi khách quét mã thanh toán lại.", { soTien: formatCurrency(nhan) }),
      };
    case "CHUYEN_DU":
      return {
        nhan: t("Chuyển dư {{soTien}}", { soTien: formatCurrency(lech) }),
        loai: "warn",
        chuyen: t("{{khach}} chuyển {{soTien}}{{luc}} cho {{quay}}, dư {{lech}}.{{muon}}", { khach: tenKhach(gd), soTien: formatCurrency(nhan), luc, quay, lech: formatCurrency(lech), muon }),
        goiY: t("{{hoiQuay}}Khách vẫn lấy hàng thì bán cho khách đúng {{tongHoaDon}}, xong rồi trả lại phần dư {{lech}}. Không lấy hàng thì trả lại toàn bộ.", { hoiQuay, tongHoaDon: formatCurrency(tong + tm), lech: formatCurrency(lech) }),
      };
    case "TIEN_VE_MUON":
      return {
        nhan: gd.thanhToanLuc && gd.hetHanLuc && new Date(gd.thanhToanLuc) <= new Date(gd.hetHanLuc) ? t("Tiền về sau khi mã QR bị hủy") : t("Tiền về sau khi mã QR hết hạn"),
        loai: "warn",
        chuyen: t("{{khach}} chuyển {{soTien}}{{luc}} cho {{quay}}, nhưng {{trangThaiQr}} nên hệ thống không tự tạo đơn.", { khach: tenKhach(gd), soTien: formatCurrency(nhan), luc, quay, trangThaiQr: maQrDaDong(gd) }),
        goiY: t("{{hoiQuay}}Đã nhận và chưa bán cho ai khác thì bán cho khách; nếu hàng đã bán bằng cách khác (vd. tiền mặt) thì trả lại tiền.", { hoiQuay }),
      };
    case "LOI_TAO_DON":
      return {
        nhan: t("Tạo đơn bị lỗi"),
        loai: "warn",
        chuyen: t("{{khach}} chuyển đủ {{soTien}}{{luc}} cho {{quay}}, nhưng hệ thống tạo đơn bị lỗi.", { khach: tenKhach(gd), soTien: formatCurrency(tong), luc, quay }),
        goiY: t("Thử bán cho khách lại. Nếu vẫn lỗi (vd. sản phẩm đã ngừng bán) thì trả lại tiền."),
      };
    default:
      return {
        nhan: t("Chưa có đơn"),
        loai: "warn",
        chuyen: t("{{khach}} đã chuyển {{soTien}}{{luc}} cho {{quay}} nhưng chưa có đơn bán.{{muon}}", { khach: tenKhach(gd), soTien: formatCurrency(nhan ?? tong), luc, quay, muon }),
        goiY: t("{{hoiQuay}}Khách vẫn lấy hàng thì bán cho khách, nếu không thì trả lại tiền.", { hoiQuay }),
      };
  }
}

/** Vì sao không bán cho khách được (nút bị khóa); null = bán được. */
function lyDoKhongBan(gd) {
  const nhan = soTien(gd.soTienDaNhan);
  if (nhan == null) return t("Chưa rõ số tiền đã nhận — kiểm tra sao kê ngân hàng rồi trả lại tiền.");
  if (nhan < soTien(gd.soTien)) return t("Khách chuyển thiếu nên không bán được.");
  // Máy chủ cũng từ chối (409): tiền mặt đưa trước đã / phải trả lại khách khi hủy mã
  if (gd.tienVeSauHuy && tienMatTruoc(gd)) return t("Tiền về sau khi mã QR đã hủy, phần tiền mặt khách đưa trước phải trả lại khách — chỉ trả lại khoản chuyển khoản này.");
  return null;
}

const tomTatHang = (gd) => (gd.items ?? [])
  .map((d) => `${Number(d.soLuong)} × ${d.tenSanPham || t("biến thể #{{id}}", { id: d.bienTheSanPhamId })}`)
  .join(", ");

export default function DoiSoatChuyenKhoan() {
  const [tab, setTab] = useState(TAB_CAN_XU_LY);
  const [boLoc, setBoLoc] = useState({ loai: "quan-ly", khoId: "", tuNgay: "", denNgay: "", page: 0, size: SO_DONG_MAC_DINH });
  const [khoOptions, setKhoOptions] = useState([{ value: "", label: t("Tất cả kho") }]);
  const [hopThoai, setHopThoai] = useState(null); // { loai: "ban" | "tra-lai" | "xem", gd }
  const soCanXuLy = useSoChuyenKhoanCanXuLy();

  useEffect(() => {
    taiLaiSoChuyenKhoanCanXuLy();
  }, []);

  useEffect(() => {
    getMineKhoList()
      .then((ds) => setKhoOptions([
        { value: "", label: t("Tất cả kho") },
        ...ds.filter(laKhoBanTaiQuay).map((kho) => ({ value: String(kho.id), label: kho.tenKho })),
      ]))
      .catch(() => { /* Không tải được kho: vẫn lọc được theo ngày */ });
  }, []);

  const thamSo = tab === TAB_CAN_XU_LY
    ? { trangThai: "PAID_ERROR", page: 0, size: 100 }
    : {
      ...BO_LOC_DA_XU_LY.find((b) => b.value === boLoc.loai)?.params,
      khoId: boLoc.khoId ? Number(boLoc.khoId) : undefined,
      tuNgay: boLoc.tuNgay,
      denNgay: boLoc.denNgay,
      page: boLoc.page,
      size: boLoc.size,
    };
  // Gắn tab vào kết quả: useTaiDuLieu giữ dữ liệu cũ khi đổi khóa, không được vẽ dòng của tab kia thành thẻ có nút xử lý
  const danhSach = useTaiDuLieu(
    () => posService.listPayosTransactions(thamSo).then((page) => ({ ...page, tabTai: tab })),
    JSON.stringify(thamSo),
  );
  const dungTab = danhSach.data?.tabTai === tab;
  const data = dungTab ? danhSach.data?.content ?? [] : [];
  const total = dungTab ? danhSach.data?.totalElements ?? 0 : 0;
  const loading = danhSach.initialLoading || (danhSach.loading && !dungTab);
  const loadError = Boolean(danhSach.error) && !(danhSach.loiTaiLai && dungTab);
  // Xử lý xong dòng cuối của trang cuối -> lùi về trang cuối còn dữ liệu
  const trangCuoi = tab === TAB_DA_XU_LY && danhSach.data && !danhSach.loading
    ? trangCuoiNeuVuot({ trang: boLoc.page, kichThuoc: boLoc.size, soDong: data.length, tong: total })
    : null;
  if (trangCuoi != null && trangCuoi !== boLoc.page) setBoLoc((p) => ({ ...p, page: trangCuoi }));

  const { reload } = danhSach;
  const taiLai = useCallback(() => {
    reload();
    taiLaiSoChuyenKhoanCanXuLy();
  }, [reload]);

  const tabs = useMemo(() => [
    { value: TAB_CAN_XU_LY, label: t("Cần xử lý"), count: soCanXuLy, tone: "danger" },
    { value: TAB_DA_XU_LY, label: t("Đã xử lý") },
  ], [soCanXuLy]);
  const coLoc = Boolean(boLoc.khoId || boLoc.tuNgay || boLoc.denNgay);
  const xoaLoc = () => setBoLoc((p) => ({ ...p, khoId: "", tuNgay: "", denNgay: "", page: 0 }));
  const doiNgay = (truong) => (e) => setBoLoc((p) => ({ ...p, [truong]: e.target.value, page: 0 }));

  const daXuLyXong = (capNhat, thongBao) => {
    toast.success(thongBao);
    setHopThoai(capNhat ? { loai: "xem", gd: capNhat } : null);
    taiLai();
  };
  // Người khác đã xử lý khoản này trước (máy chủ trả 409)
  const giaoDichCu = () => {
    toast.warning(t("Khoản này vừa được người khác xử lý — đã tải lại danh sách. Nếu bạn đã chuyển trả tiền cho khách, hãy báo chủ cửa hàng để đối chiếu."));
    setHopThoai(null);
    taiLai();
  };
  // Hỏi trạng thái mới nhất trước khi mở: danh sách không tự tải lại, tránh hai người cùng trả tiền một khoản
  const [dangMo, setDangMo] = useState(null);
  const moXuLy = async (loai, gd) => {
    setDangMo(gd.orderCode);
    try {
      const moiNhat = await posService.getPayosStatus(gd.orderCode);
      if (moiNhat?.trangThai !== "PAID_ERROR") {
        toast.warning(t("Khoản này vừa được xử lý ở nơi khác — đã tải lại danh sách."));
        taiLai();
        return;
      }
      setHopThoai({ loai, gd });
    } catch {
      toast.error(t("Không kiểm tra được trạng thái mới nhất của khoản này. Kiểm tra mạng rồi thử lại."));
    } finally {
      setDangMo(null);
    }
  };

  // Xác nhận đã trả lại khách tiền mặt đưa trước của mã QR không thành (cùng nút "Đã trả lại tiền mặt" ở quầy).
  const [dangTraTienMat, setDangTraTienMat] = useState(null); // orderCode đang gửi
  const xacNhanTraTienMat = async (gd) => {
    setDangTraTienMat(gd.orderCode);
    try {
      const moi = await posService.returnPayosCash(gd.orderCode);
      toast.success(t("Đã ghi nhận trả lại khách {{soTien}} tiền mặt.", { soTien: formatCurrency(tienMatTruoc(gd)) }));
      // Hộp xem đang mở giao dịch này: hiện ngay "đã trả lại" (tên người xác nhận có sau khi tải lại danh sách)
      setHopThoai((h) => (h?.gd?.orderCode === gd.orderCode
        ? { ...h, gd: { ...h.gd, trangThai: moi?.trangThai ?? h.gd.trangThai, tienMatTraLaiLuc: moi?.tienMatTraLaiLuc ?? new Date().toISOString() } }
        : h));
      taiLai();
    } catch (error) {
      toast.error(error?.response?.data?.message || t("Không ghi nhận được việc trả lại tiền mặt. Vui lòng thử lại."));
    } finally {
      setDangTraTienMat(null);
    }
  };

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader />

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={<StatusTabs label={t("Đối soát chuyển khoản")} tabs={tabs} value={tab} onChange={setTab} />}
            hasFilter={tab === TAB_DA_XU_LY && coLoc}
            onClear={xoaLoc}
          >
            {tab === TAB_DA_XU_LY ? (
              <>
                <FilterSelect
                  label={t("Hiển thị")}
                  value={boLoc.loai}
                  options={BO_LOC_DA_XU_LY}
                  onChange={(loai) => setBoLoc((p) => ({ ...p, loai, page: 0 }))}
                />
                <FilterSelect
                  label={t("Kho")}
                  value={boLoc.khoId}
                  options={khoOptions}
                  onChange={(khoId) => setBoLoc((p) => ({ ...p, khoId, page: 0 }))}
                />
                <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-bo-surface pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
                  <Calendar className="size-4 shrink-0 text-bo-muted" />
                  <span className="shrink-0 text-xs text-bo-muted">{t("Từ")}</span>
                  <Input type="date" aria-label={t("Từ ngày tạo mã QR")} className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" value={boLoc.tuNgay} onChange={doiNgay("tuNgay")} />
                  <span className="shrink-0 text-xs text-bo-muted">{t("đến")}</span>
                  <Input type="date" aria-label={t("Đến ngày tạo mã QR")} className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" value={boLoc.denNgay} onChange={doiNgay("denNgay")} />
                </label>
              </>
            ) : null}
          </ListToolbar>
        }
        footer={
          tab === TAB_DA_XU_LY && !loadError && (total > 0 || !loading) ? (
            <TablePagination
              page={boLoc.page}
              size={boLoc.size}
              total={total}
              onPageChange={(page) => page >= 0 && setBoLoc((p) => ({ ...p, page }))}
              onSizeChange={(size) => setBoLoc((p) => (p.size === size ? p : { ...p, size, page: 0 }))}
            />
          ) : null
        }
      >
        {loading ? (
          <LoadingState label={t("Đang tải danh sách chuyển khoản")} />
        ) : loadError ? (
          <ErrorState description={LOAD_ERROR_MESSAGE} onRetry={taiLai} />
        ) : tab === TAB_CAN_XU_LY ? (
          <div className="space-y-3 p-4">
            <p className="max-w-3xl rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm leading-6 text-bo-muted">
              {t("Khách đã chuyển khoản qua mã QR tại quầy nhưng hệ thống chưa tạo được đơn bán. Với mỗi khoản: nếu khách vẫn lấy hàng thì")} <strong className="text-bo-foreground">{t("bán cho khách")}</strong>{t(", nếu không thì")} <strong className="text-bo-foreground">{t("trả lại tiền")}</strong>{t(". Không thu tiền lại của khách.")}
            </p>
            {data.length === 0 ? (
              <EmptyState
                icon={CircleCheckBig}
                title={t("Không có khoản nào cần xử lý")}
                description={t("Mọi khoản chuyển khoản tại quầy đều đã có đơn bán.")}
              />
            ) : (
              data.map((gd) => (
                <TheCanXuLy
                  key={gd.orderCode}
                  gd={gd}
                  dangMo={dangMo === gd.orderCode}
                  onBan={() => moXuLy("ban", gd)}
                  onTraLai={() => moXuLy("tra-lai", gd)}
                  dangTraTienMat={dangTraTienMat === gd.orderCode}
                  onTraTienMat={() => xacNhanTraTienMat(gd)}
                />
              ))
            )}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t("Không có giao dịch phù hợp")}
            description={coLoc ? t("Thử đổi kho hoặc khoảng ngày.") : t("Khoản đã bán cho khách hoặc đã trả lại tiền sẽ hiện ở đây.")}
            action={coLoc ? <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">{t("Xóa lọc")}</Button> : null}
          />
        ) : (
          <>
          {/* Điện thoại: mỗi giao dịch một thẻ, chạm thẻ mở hộp xem như bấm dòng — số tiền + kết quả, kho · thu ngân,
              lúc tạo mã · người chuyển, ghi chú tiền (đơn, đã nhận, tiền mặt) và người xử lý */}
          <ul className={`divide-y divide-bo-border transition-opacity md:hidden ${danhSach.loading ? "opacity-60" : ""}`} aria-busy={danhSach.loading}>
            {data.map((gd) => {
              const ghiChuTien = [
                gd.soDonHang ? t("Đơn {{so}}", { so: gd.soDonHang }) : null,
                gd.soTienDaNhan != null && soTien(gd.soTienDaNhan) !== soTienHienThi(gd) ? t("đã nhận {{soTien}}", { soTien: formatCurrency(gd.soTienDaNhan) }) : null,
                tienMatTruoc(gd) ? t("+ tiền mặt trả trước {{soTien}}", { soTien: formatCurrency(tienMatTruoc(gd)) }) : null,
              ].filter(Boolean).join(" · ");
              return (
                <li key={gd.orderCode}>
                  <button
                    type="button"
                    aria-label={t("Xem giao dịch {{soTien}} lúc {{gio}}", { soTien: formatCurrency(gd.soTien), gio: gio(gd.ngayTao) })}
                    onClick={() => setHopThoai({ loai: "xem", gd })}
                    className="grid w-full grid-cols-1 gap-1 px-4 py-3 text-left active:bg-bo-surface-subtle"
                  >
                    <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="min-w-0 truncate text-[15px] font-semibold tabular-nums text-bo-foreground">{formatCurrency(soTienHienThi(gd))}</span>
                      <StatusBadge label={nhanTrangThai(gd)} />
                    </span>
                    <span className="min-w-0 truncate text-sm text-bo-foreground">{gd.tenKho || "—"} · {gd.tenThuNgan || "—"}</span>
                    <span className="min-w-0 truncate text-[13px] text-bo-muted">{gio(gd.ngayTao)}{gd.tenNguoiChuyen ? ` · ${gd.tenNguoiChuyen}` : ""}</span>
                    {ghiChuTien ? <span className="text-[13px] text-bo-muted">{ghiChuTien}</span> : null}
                    {canTraLaiTienMat(gd) ? (
                      <span className="text-[13px] font-medium text-amber-800">{t("Chưa trả lại tiền mặt {{soTien}}", { soTien: formatCurrency(tienMatTruoc(gd)) })}</span>
                    ) : tienMatTruoc(gd) && gd.tienMatTraLaiLuc ? (
                      <span className="text-[13px] text-bo-muted">{t("Đã trả lại tiền mặt {{gio}}", { gio: gio(gd.tienMatTraLaiLuc) })}{gd.tenNguoiTraLaiTienMat ? ` · ${gd.tenNguoiTraLaiTienMat}` : ""}</span>
                    ) : null}
                    {gd.tenNguoiXuLy ? <span className="text-[13px] text-bo-muted">{t("Xử lý: {{ten}} · {{gio}}", { ten: gd.tenNguoiXuLy, gio: gio(gd.xuLyLuc) })}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* Máy tính bảng dọc (cảm ứng): bỏ cột Người chuyển, Người xử lý — đưa thành dòng phụ dưới lúc tạo mã và kết quả —
              để bảng vừa khung, không vuốt ngang */}
          <table className={`w-full min-w-[960px] text-sm transition-opacity max-md:hidden cam-ung:max-lg:min-w-0 ${danhSach.loading ? "opacity-60" : ""}`} aria-busy={danhSach.loading}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={headCell}>{t("Tạo mã QR lúc")}</th>
                <th className={`${headCell} text-right`}>{t("Số tiền")}</th>
                <th className={`${headCell} cam-ung:max-lg:hidden`}>{t("Người chuyển")}</th>
                <th className={headCell}>{t("Kho · thu ngân")}</th>
                <th className={headCell}>{t("Kết quả")}</th>
                <th className={`${headCell} cam-ung:max-lg:hidden`}>{t("Người xử lý")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((gd) => (
                <tr
                  key={gd.orderCode}
                  tabIndex={0}
                  aria-label={t("Xem giao dịch {{soTien}} lúc {{gio}}", { soTien: formatCurrency(gd.soTien), gio: gio(gd.ngayTao) })}
                  className="cursor-pointer transition-colors hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
                  onClick={() => setHopThoai({ loai: "xem", gd })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHopThoai({ loai: "xem", gd }); } }}
                >
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">
                    {gio(gd.ngayTao)}
                    {gd.tenNguoiChuyen ? <div className="mt-0.5 hidden text-bo-foreground cam-ung:max-lg:block">{gd.tenNguoiChuyen}</div> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-bo-foreground">
                    <span className="font-semibold">{formatCurrency(soTienHienThi(gd))}</span>
                    {gd.soTienDaNhan != null && soTien(gd.soTienDaNhan) !== soTienHienThi(gd) ? <div className="text-xs font-normal text-bo-muted">{t("đã nhận {{soTien}}", { soTien: formatCurrency(gd.soTienDaNhan) })}</div> : null}
                    {tienMatTruoc(gd) ? <div className="text-xs font-normal text-bo-muted">{t("+ tiền mặt trả trước {{soTien}}", { soTien: formatCurrency(tienMatTruoc(gd)) })}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-bo-foreground cam-ung:max-lg:hidden">{gd.tenNguoiChuyen || <span className="text-bo-muted">—</span>}</td>
                  <td className="px-3 py-3"><div className="text-bo-foreground">{gd.tenKho || "—"}</div><div className="text-xs text-bo-muted">{gd.tenThuNgan || "—"}</div></td>
                  <td className="px-3 py-3">
                    <StatusBadge label={nhanTrangThai(gd)} />
                    {gd.soDonHang ? <div className="mt-1 text-xs text-bo-muted">{t("Đơn {{so}}", { so: gd.soDonHang })}</div> : null}
                    {canTraLaiTienMat(gd) ? (
                      <div className="mt-1 text-xs font-medium text-amber-800">{t("Chưa trả lại tiền mặt {{soTien}}", { soTien: formatCurrency(tienMatTruoc(gd)) })}</div>
                    ) : tienMatTruoc(gd) && gd.tienMatTraLaiLuc ? (
                      <div className="mt-1 text-xs text-bo-muted">{t("Đã trả lại tiền mặt {{gio}}", { gio: gio(gd.tienMatTraLaiLuc) })}{gd.tenNguoiTraLaiTienMat ? ` · ${gd.tenNguoiTraLaiTienMat}` : ""}</div>
                    ) : null}
                    {gd.tenNguoiXuLy ? <div className="mt-1 hidden text-xs text-bo-muted cam-ung:max-lg:block">{t("Xử lý: {{ten}} · {{gio}}", { ten: gd.tenNguoiXuLy, gio: gio(gd.xuLyLuc) })}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-bo-muted cam-ung:max-lg:hidden">{gd.tenNguoiXuLy ? <>{gd.tenNguoiXuLy}<div>{gio(gd.xuLyLuc)}</div></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </TableShell>

      {hopThoai?.loai === "ban" ? (
        <HopThoaiBanChoKhach gd={hopThoai.gd} onClose={() => setHopThoai(null)} onXong={daXuLyXong} onCu={giaoDichCu} />
      ) : null}
      {hopThoai?.loai === "tra-lai" ? (
        <HopThoaiTraLaiTien gd={hopThoai.gd} onClose={() => setHopThoai(null)} onXong={daXuLyXong} onCu={giaoDichCu} />
      ) : null}
      {hopThoai?.loai === "xem" ? (
        <HopThoaiXem
          gd={hopThoai.gd}
          onClose={() => setHopThoai(null)}
          dangTraTienMat={dangTraTienMat === hopThoai.gd.orderCode}
          onTraTienMat={() => xacNhanTraTienMat(hopThoai.gd)}
        />
      ) : null}
    </PageContainer>
  );
}

/** Một khoản tiền cần xử lý: số tiền, lý do bằng lời, gợi ý, hai nút. */
function TheCanXuLy({ gd, dangMo, onBan, onTraLai, dangTraTienMat, onTraTienMat }) {
  const chuyen = keChuyen(gd);
  const cho = thoiGianCho(gd.thanhToanLuc);
  const khongBan = lyDoKhongBan(gd);
  const vien = chuyen.loai === "bad" ? "border-l-bo-danger" : "border-l-amber-500";
  const nhanMau = chuyen.loai === "bad" ? "bg-bo-danger-soft text-bo-danger" : "bg-amber-50 text-amber-800";
  return (
    <article className={`space-y-2.5 rounded-lg border border-l-4 border-bo-border bg-white p-4 ${vien}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-bold tabular-nums text-bo-foreground">
          {formatCurrency(gd.soTienDaNhan ?? gd.soTien)}
          {gd.lyDo === "CHUYEN_THIEU" || gd.lyDo === "CHUYEN_DU" ? <span className="ml-1 text-sm font-medium text-bo-muted">/ {formatCurrency(gd.soTien)}</span> : null}
        </p>
        <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className={`rounded-full px-2.5 py-0.5 ${nhanMau}`}>{chuyen.nhan}</span>
          {cho ? <span className={`rounded-full px-2.5 py-0.5 ${cho.lau ? "bg-bo-danger-soft text-bo-danger" : "bg-bo-surface-subtle text-bo-muted"}`}>{cho.text}</span> : null}
        </div>
      </div>
      <p className="text-sm leading-6 text-bo-foreground">{chuyen.chuyen}</p>
      <p className="text-xs text-bo-muted">
        {t("Hàng: {{hang}}", { hang: tomTatHang(gd) || "—" })} · {gd.dangGiuCho ? t("đang được giữ trong kho") : t("đã trả về kho bán tiếp")}
      </p>
      {cauTienMat(gd) ? (
        <div className={`flex flex-wrap items-center gap-2 text-xs ${canTraLaiTienMat(gd) ? "font-medium text-amber-800" : "text-bo-foreground"}`}>
          <span>{cauTienMat(gd)}</span>
          {canTraLaiTienMat(gd) ? <NutTraLaiTienMat gd={gd} dangGui={dangTraTienMat} onXacNhan={onTraTienMat} /> : null}
        </div>
      ) : null}
      <p className="rounded-md bg-bo-primary-soft px-3 py-2 text-[13px] leading-5 text-bo-foreground">{t("Gợi ý: {{goiY}}", { goiY: chuyen.goiY })}</p>
      {/* Cảm ứng: hai nút cao 44px; điện thoại: mỗi nút một hàng, rộng hết thẻ */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="bg-bo-primary text-white hover:bg-bo-primary-hover max-md:w-full"
          disabled={Boolean(khongBan) || dangMo}
          onClick={onBan}
          aria-label={t("Bán cho khách khoản {{soTien}}", { soTien: formatCurrency(soTienHienThi(gd)) })}
          aria-describedby={khongBan ? `ly-do-khong-ban-${gd.orderCode}` : undefined}
        >
          {t("Bán cho khách (tạo đơn)")}
        </Button>
        <Button variant="outline" className="border-bo-border bg-bo-surface max-md:w-full" disabled={dangMo} onClick={onTraLai} aria-label={t("Trả lại tiền khoản {{soTien}}", { soTien: formatCurrency(soTienHienThi(gd)) })}>
          {dangMo ? t("Đang kiểm tra…") : t("Trả lại tiền cho khách")}
        </Button>
        {khongBan ? <span id={`ly-do-khong-ban-${gd.orderCode}`} className="text-xs text-bo-muted">{khongBan}</span> : null}
      </div>
      <ChiTietKyThuat gd={gd} />
    </article>
  );
}

/**
 * Nút "Đã trả lại tiền mặt" (tiền mặt khách đưa trước của mã QR không thành): bấm hai lần — lần đầu hỏi lại đúng số
 * tiền — để không lỡ tay đánh dấu đã trả khi quầy chưa trả cho khách.
 */
function NutTraLaiTienMat({ gd, dangGui, onXacNhan }) {
  const [hoiLai, setHoiLai] = useState(false);
  if (!hoiLai) {
    return (
      <Button size="sm" variant="outline" className="h-8 border-amber-300 bg-bo-surface text-amber-900 hover:bg-amber-50" disabled={dangGui} onClick={(e) => { e.stopPropagation(); setHoiLai(true); }}>
        {t("Đã trả lại tiền mặt")}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-bo-foreground">{t("Khách đã nhận lại {{soTien}}?", { soTien: formatCurrency(tienMatTruoc(gd)) })}</span>
      <Button size="sm" className="h-8 bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dangGui} onClick={(e) => { e.stopPropagation(); onXacNhan(); }}>
        {dangGui ? t("Đang ghi…") : t("Xác nhận đã trả")}
      </Button>
      <Button size="sm" variant="ghost" className="h-8" disabled={dangGui} onClick={(e) => { e.stopPropagation(); setHoiLai(false); }}>
        {t("Hủy")}
      </Button>
    </span>
  );
}

/** Mã kỹ thuật cho người đối soát với ngân hàng / my.payos.vn — thu gọn mặc định. */
function ChiTietKyThuat({ gd }) {
  return (
    <details className="text-xs text-bo-muted">
      {/* Cảm ứng: vùng chạm cao 44px, lấn vào khe trên và lề dưới của thẻ nên thẻ không cao thêm nhiều */}
      <summary className="cursor-pointer select-none hover:text-bo-foreground cam-ung:-mb-3.5 cam-ung:-mt-2.5 cam-ung:py-3.5">{t("Chi tiết kỹ thuật")}</summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt>{t("Mã QR (payOS)")}</dt><dd className="font-mono">{gd.orderCode}</dd>
        <dt>{t("Nội dung CK")}</dt><dd className="break-all font-mono">{gd.noiDungCk || "—"}</dd>
        <dt>{t("Mã GD ngân hàng")}</dt><dd className="break-all font-mono">{gd.maGiaoDichNganHang || "—"}</dd>
        <dt>{t("Tạo mã · hết hạn")}</dt><dd>{gio(gd.ngayTao)} · {gio(gd.hetHanLuc)}</dd>
        {gd.errorMessage ? <><dt>{t("Ghi nhận của hệ thống")}</dt><dd>{gd.errorMessage}</dd></> : null}
      </dl>
    </details>
  );
}

/**
 * Tài khoản khách đã chuyển (payOS chỉ gửi khi tài khoản nhận ở một số ngân hàng); không có thì hướng dẫn tra
 * sao kê theo thời điểm và nội dung chuyển khoản.
 */
function KhoiTaiKhoanKhach({ gd }) {
  if (!gd.tenNguoiChuyen && !gd.soTkNguoiChuyen) {
    return (
      <p className="text-bo-muted">
        {t("payOS không gửi tài khoản người chuyển: tra sao kê ngân hàng của cửa hàng theo thời điểm {{gio}} và nội dung", { gio: gio(gd.thanhToanLuc) })}{" "}
        <span className="font-mono">{gd.noiDungCk || "—"}</span> {t("để biết trả về đâu.")}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 rounded-md border border-dashed border-bo-border bg-bo-surface-subtle px-3 py-2">
      <span className="font-medium">{gd.tenNguoiChuyen || "—"}</span>
      {gd.nganHangNguoiChuyen ? <span className="text-bo-muted">· {gd.nganHangNguoiChuyen}</span> : null}
      {gd.soTkNguoiChuyen ? (
        <span className="inline-flex items-center gap-1 font-mono">· {gd.soTkNguoiChuyen}<NutSaoChep giaTri={gd.soTkNguoiChuyen} nhan={t("Sao chép số tài khoản khách")} /></span>
      ) : null}
    </div>
  );
}

/** Lỗi 409 "không còn chờ xử lý" = người khác đã xử lý trước. */
const laGiaoDichCu = (error) =>
  error?.response?.status === 409 && cauGocCuaLoi(error).includes("không còn chờ xử lý");

/** Bán cho khách: xem trước đơn sẽ tạo rồi mới xác nhận. */
function HopThoaiBanChoKhach({ gd, onClose, onXong, onCu }) {
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const du = (soTien(gd.soTienDaNhan) ?? 0) - soTien(gd.soTien);
  const traMuon = Boolean(gd.tienVeSauHuy);

  const xacNhan = async () => {
    if (traMuon && !daKiemTra) return setLoi(t("Xác nhận đã hỏi quầy: khách này đã nhận hàng, chưa bán cho ai khác."));
    setDangGui(true);
    setLoi("");
    try {
      const capNhat = await posService.createOrderFromPayosError(gd.orderCode, ghiChu.trim());
      onXong(capNhat, du > 0
        ? t("Đã tạo đơn bán {{so}}. Nhớ trả lại phần dư {{du}} cho khách.", { so: capNhat?.soDonHang ?? "", du: formatCurrency(du) })
        : t("Đã tạo đơn bán {{so}}.", { so: capNhat?.soDonHang ?? "" }));
    } catch (error) {
      if (laGiaoDichCu(error)) return onCu();
      setLoi(error?.response?.data?.message || t("Không tạo được đơn. Vui lòng thử lại."));
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dangGui && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Bán cho khách")}</DialogTitle>
          <DialogDescription>{t("Kiểm tra đơn sẽ được tạo trước khi xác nhận.")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-sm">
          <p className="font-semibold text-bo-foreground">{t("Sẽ tạo đơn bán {{soTien}}", { soTien: formatCurrency(soTien(gd.soTien) + tienMatTruoc(gd)) })}</p>
          <p className="text-bo-muted">{t("Ngày đơn: {{gio}} (lúc tiền về) · người bán: {{nguoiBan}}", { gio: gio(gd.thanhToanLuc), nguoiBan: gd.tenThuNgan || "—" })}</p>
          <p className="text-bo-muted">{t("Trừ kho {{kho}}: {{hang}}", { kho: gd.tenKho || "—", hang: tomTatHang(gd) || "—" })}</p>
          <p className="text-bo-muted">
            {t("Thanh toán: chuyển khoản {{soTien}}", { soTien: formatCurrency(gd.soTien) })}
            {tienMatTruoc(gd) ? <> {t("+ tiền mặt {{soTien}} (khách đưa trước tại quầy)", { soTien: formatCurrency(tienMatTruoc(gd)) })}</> : null}
          </p>
        </div>
        {traMuon ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] leading-5 text-amber-900">
            <p><strong>{t("Tiền về khi {{trangThaiQr}}.", { trangThaiQr: maQrDaDong(gd) })}</strong> {t("Thu ngân có thể đã bán các món này bằng cách khác (vd. tiền mặt). Chỉ bán khi chắc khách này đã nhận hàng.")}</p>
            <label className="flex items-start gap-2">
              <input className="mt-0.5" type="checkbox" checked={daKiemTra} onChange={(e) => setDaKiemTra(e.target.checked)} disabled={dangGui} />
              <span>{t("Tôi đã hỏi quầy: khách này đã nhận hàng, chưa bán cho ai khác.")}</span>
            </label>
          </div>
        ) : null}
        {du > 0 ? (
          <div className="space-y-2 rounded-md border border-bo-border p-3 text-[13px] leading-5">
            <p className="text-bo-foreground">
              {t("Khách chuyển dư")} <strong>{formatCurrency(du)}</strong>. <strong>{t("Tạo đơn xong")}</strong> {t("rồi mới trả lại phần dư (tạo đơn lỗi thì sẽ phải trả lại toàn bộ, không trả phần dư trước). Ghi chú đơn sẽ có dòng \"cần hoàn lại {{du}}\".", { du: formatCurrency(du) })}
            </p>
            <KhoiTaiKhoanKhach gd={gd} />
            <label className="block text-bo-muted" htmlFor="ghi-chu-ban">{t("Ghi chú (không bắt buộc)")}</label>
            <Input id="ghi-chu-ban" maxLength={500} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} disabled={dangGui} placeholder={t("vd. sẽ trả phần dư qua BIDV")} />
          </div>
        ) : null}
        {loi ? <p className="text-sm text-bo-danger" role="alert">{loi}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-bo-border bg-bo-surface" disabled={dangGui} onClick={onClose}>{t("Quay lại")}</Button>
          <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dangGui} onClick={xacNhan}>{dangGui ? t("Đang tạo đơn…") : t("Tạo đơn bán")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Trả lại tiền: 3 bước — chuyển trả về đúng tài khoản, ghi mã giao dịch hoàn, xem kết quả. */
function HopThoaiTraLaiTien({ gd, onClose, onXong, onCu }) {
  const [maHoan, setMaHoan] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const soTra = gd.soTienDaNhan ?? null;
  const tm = tienMatTruoc(gd);

  const xacNhan = async () => {
    if (!maHoan.trim()) return setLoi(t("Nhập mã giao dịch hoàn tiền trên app ngân hàng (hoặc ghi chú cách đã trả)."));
    setDangGui(true);
    setLoi("");
    try {
      const capNhat = await posService.markPayosRefunded(gd.orderCode, maHoan.trim());
      onXong(capNhat, t("Đã ghi lại việc trả lại tiền cho khách."));
    } catch (error) {
      if (laGiaoDichCu(error)) return onCu();
      setLoi(error?.response?.data?.message || t("Không ghi lại được. Vui lòng thử lại."));
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dangGui && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Trả lại tiền cho khách")}</DialogTitle>
          <DialogDescription className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            {t("Hệ thống không tự chuyển tiền. Bạn chuyển trả bằng app ngân hàng của cửa hàng, rồi ghi lại ở đây.")}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">1</span>
            <div className="space-y-1.5">
              <p className="font-semibold text-bo-foreground">
                {t("Chuyển trả {{soTien}} về tài khoản khách đã dùng:", { soTien: soTra == null ? t("số tiền khách đã chuyển (xem sao kê)") : formatCurrency(soTra) })}
              </p>
              <KhoiTaiKhoanKhach gd={gd} />
              {tm > 0 && !gd.tienMatTraLaiLuc ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-900">
                  {t("Khách còn đưa trước")} <strong>{formatCurrency(tm)}</strong> {t("tiền mặt tại quầy: nhờ {{nguoi}} trả lại khách số này. Trả xong, quầy (hoặc bạn, ở chi tiết giao dịch) bấm \"Đã trả lại tiền mặt\".", { nguoi: gd.tenThuNgan ? t("thu ngân {{ten}}", { ten: gd.tenThuNgan }) : t("quầy") })}
                </p>
              ) : tm > 0 ? <p className="text-xs text-bo-muted">{cauTienMat(gd)}</p> : null}
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">2</span>
            <div className="space-y-1.5">
              <label className="block font-semibold text-bo-foreground" htmlFor="ma-hoan">{t("Ghi lại mã giao dịch hoàn tiền (bắt buộc)")}</label>
              <Input id="ma-hoan" autoFocus maxLength={500} value={maHoan} onChange={(e) => setMaHoan(e.target.value)} disabled={dangGui} placeholder={t("vd. FT26298123456")} />
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">3</span>
            <p className="text-bo-muted">
              {t("Kết quả: khoản này chuyển sang \"Đã xử lý · Đã trả lại tiền\"")}{gd.dangGiuCho ? t("; hàng đang giữ ({{hang}}) được trả về kho để bán tiếp", { hang: tomTatHang(gd) }) : ""}{t("; hóa đơn trên quầy (nếu thu ngân còn mở) được mở khóa. Không tạo đơn bán.")}
            </p>
          </li>
        </ol>
        {loi ? <p className="text-sm text-bo-danger" role="alert">{loi}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-bo-border bg-bo-surface" disabled={dangGui} onClick={onClose}>{t("Quay lại")}</Button>
          <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dangGui} onClick={xacNhan}>{dangGui ? t("Đang ghi…") : t("Tôi đã chuyển trả, ghi lại")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Xem một giao dịch đã xử lý / mọi mã QR (chỉ đọc). */
function HopThoaiXem({ gd, onClose, dangTraTienMat, onTraTienMat }) {
  const chuyen = gd.lyDo ? keChuyen(gd) : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatCurrency(soTienHienThi(gd))} · {t(nhanTrangThai(gd))}</DialogTitle>
          <DialogDescription>{t("{{kho}} · thu ngân {{thuNgan}} · tạo mã QR {{gio}}", { kho: gd.tenKho || "—", thuNgan: gd.tenThuNgan || "—", gio: gio(gd.ngayTao) })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {chuyen ? <p className="text-bo-foreground">{chuyen.chuyen}</p> : null}
          {gd.soDonHang ? <p>{t("Đơn bán:")} <strong>{gd.soDonHang}</strong></p> : null}
          {cauTienMat(gd) ? (
            <div className={`space-y-2 rounded-md px-3 py-2 ${canTraLaiTienMat(gd) ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-bo-surface-subtle text-bo-muted"}`}>
              <p>{cauTienMat(gd)}</p>
              {canTraLaiTienMat(gd) ? <NutTraLaiTienMat gd={gd} dangGui={dangTraTienMat} onXacNhan={onTraTienMat} /> : null}
            </div>
          ) : null}
          {gd.tenNguoiChuyen ? <p className="text-bo-muted">{t("Người chuyển: {{ten}}", { ten: gd.tenNguoiChuyen })}{gd.nganHangNguoiChuyen ? ` · ${gd.nganHangNguoiChuyen}` : ""}{gd.soTkNguoiChuyen ? ` · ${gd.soTkNguoiChuyen}` : ""}</p> : null}
          {gd.tenNguoiXuLy ? <p className="text-bo-muted">{t("Xử lý bởi {{ten}} lúc {{gio}}", { ten: gd.tenNguoiXuLy, gio: gio(gd.xuLyLuc) })}{gd.ghiChuXuLy ? ` — ${gd.ghiChuXuLy}` : ""}</p> : null}
          <p className="text-bo-muted">{t("Hàng: {{hang}}", { hang: tomTatHang(gd) || "—" })}</p>
          <ChiTietKyThuat gd={gd} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-bo-border bg-bo-surface" onClick={onClose}>{t("Đóng")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
