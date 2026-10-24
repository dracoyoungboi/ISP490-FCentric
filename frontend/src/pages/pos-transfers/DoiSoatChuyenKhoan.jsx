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
  { value: "quan-ly", label: "Quản lý đã xử lý", params: { daXuLy: true } },
  { value: "ban", label: "Đã bán cho khách", params: { daXuLy: true, trangThai: "PAID" } },
  { value: "tra-lai", label: "Đã trả lại tiền", params: { trangThai: "REFUNDED" } },
  { value: "moi-ma-qr", label: "Mọi mã QR", params: {} },
];

const NHAN_TRANG_THAI = {
  PAID_ERROR: "Chờ xử lý",
  PENDING: "Chờ thanh toán",
  REFUNDED: "Đã trả lại tiền",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  FAILED: "Lỗi",
};
const nhanTrangThai = (gd) =>
  gd.trangThai === "PAID" ? (gd.tenNguoiXuLy || gd.xuLyLuc ? "Đã bán cho khách" : "Đã thanh toán") : NHAN_TRANG_THAI[gd.trangThai] ?? gd.trangThai;

const LOAD_ERROR_MESSAGE = "Không tải được danh sách chuyển khoản. Vui lòng thử lại.";
const headCell = "h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted";

const soTien = (v) => (v == null ? null : Number(v));
// Đã bán: số tiền của đơn (tổng hóa đơn), không phải số khách chuyển (có thể dư); còn lại: số khách đã chuyển
const soTienHienThi = (gd) => (gd.trangThai === "PAID" ? soTien(gd.soTien) : soTien(gd.soTienDaNhan ?? gd.soTien));
const tenKhach = (gd) => (gd.tenNguoiChuyen ? `Khách ${gd.tenNguoiChuyen}` : "Khách");
const gio = (iso) => (iso ? formatDateTime(iso) : "—");

/** "chờ 15 phút" / "chờ 2 giờ" / "chờ 3 ngày" tính từ lúc tiền về. */
function thoiGianCho(iso) {
  if (!iso) return null;
  const phut = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (phut < 60) return { text: `chờ ${phut} phút`, lau: false };
  const gioCho = Math.floor(phut / 60);
  if (gioCho < 24) return { text: `chờ ${gioCho} giờ`, lau: false };
  return { text: `chờ ${Math.floor(gioCho / 24)} ngày`, lau: true };
}

/** "mã QR đã hết hạn lúc 14:15" hay "thu ngân đã hủy mã QR" — tiền về trước hạn mà mã đã đóng là bị hủy tay. */
function maQrDaDong(gd) {
  const truocHan = gd.thanhToanLuc && gd.hetHanLuc && new Date(gd.thanhToanLuc) <= new Date(gd.hetHanLuc);
  return truocHan ? "thu ngân đã hủy mã QR trước khi tiền về" : `mã QR đã hết hạn lúc ${gio(gd.hetHanLuc)}`;
}

/** Kể bằng lời: chuyện gì đã xảy ra + nên làm gì, theo lý do máy chủ trả về. */
function keChuyen(gd) {
  const nhan = soTien(gd.soTienDaNhan);
  const tong = soTien(gd.soTien);
  const lech = nhan == null ? 0 : nhan - tong;
  const thuNgan = gd.tenThuNgan ? `thu ngân ${gd.tenThuNgan}` : "quầy";
  const quay = `hóa đơn ${formatCurrency(tong)}${gd.tenThuNgan ? ` của thu ngân ${gd.tenThuNgan}` : ""}${gd.tenKho ? ` ở ${gd.tenKho}` : ""}`;
  const luc = gd.thanhToanLuc ? ` lúc ${gio(gd.thanhToanLuc)}` : "";
  // Tiền về khi mã QR đã đóng: món hàng có thể đã bán bằng cách khác -> luôn nói ra, kể cả khi chuyển dư
  const muon = gd.tienVeSauHuy ? ` Tiền về khi ${maQrDaDong(gd)}.` : "";
  const hoiQuay = gd.tienVeSauHuy ? `Hỏi ${thuNgan} khách đã nhận hàng chưa (có thể món này đã bán bằng cách khác). ` : "";
  switch (gd.lyDo) {
    case "CHUA_RO_SO_TIEN":
      return {
        nhan: "Chưa rõ số tiền",
        loai: "bad",
        chuyen: `Đã có tiền chuyển khoản cho ${quay} nhưng chưa rõ khách chuyển bao nhiêu.${muon}`,
        goiY: "Tra sao kê ngân hàng theo nội dung chuyển khoản (trong Chi tiết kỹ thuật) rồi trả lại đúng số tiền khách đã chuyển.",
      };
    case "CHUYEN_THIEU":
      return {
        nhan: `Chuyển thiếu ${formatCurrency(-lech)}`,
        loai: "bad",
        chuyen: `${tenKhach(gd)} mới chuyển ${formatCurrency(nhan)}${luc} cho ${quay}.${muon}`,
        goiY: `Chuyển thiếu thì không bán được. Trả lại ${formatCurrency(nhan)} cho khách, rồi khách quét mã thanh toán lại.`,
      };
    case "CHUYEN_DU":
      return {
        nhan: `Chuyển dư ${formatCurrency(lech)}`,
        loai: "warn",
        chuyen: `${tenKhach(gd)} chuyển ${formatCurrency(nhan)}${luc} cho ${quay}, dư ${formatCurrency(lech)}.${muon}`,
        goiY: `${hoiQuay}Khách vẫn lấy hàng thì bán cho khách đúng ${formatCurrency(tong)}, xong rồi trả lại phần dư ${formatCurrency(lech)}. Không lấy hàng thì trả lại toàn bộ.`,
      };
    case "TIEN_VE_MUON":
      return {
        nhan: gd.thanhToanLuc && gd.hetHanLuc && new Date(gd.thanhToanLuc) <= new Date(gd.hetHanLuc) ? "Tiền về sau khi mã QR bị hủy" : "Tiền về sau khi mã QR hết hạn",
        loai: "warn",
        chuyen: `${tenKhach(gd)} chuyển ${formatCurrency(nhan)}${luc} cho ${quay}, nhưng ${maQrDaDong(gd)} nên hệ thống không tự tạo đơn.`,
        goiY: `${hoiQuay}Đã nhận và chưa bán cho ai khác thì bán cho khách; nếu hàng đã bán bằng cách khác (vd. tiền mặt) thì trả lại tiền.`,
      };
    case "LOI_TAO_DON":
      return {
        nhan: "Tạo đơn bị lỗi",
        loai: "warn",
        chuyen: `${tenKhach(gd)} chuyển đủ ${formatCurrency(tong)}${luc} cho ${quay}, nhưng hệ thống tạo đơn bị lỗi.`,
        goiY: "Thử bán cho khách lại. Nếu vẫn lỗi (vd. sản phẩm đã ngừng bán) thì trả lại tiền.",
      };
    default:
      return {
        nhan: "Chưa có đơn",
        loai: "warn",
        chuyen: `${tenKhach(gd)} đã chuyển ${formatCurrency(nhan ?? tong)}${luc} cho ${quay} nhưng chưa có đơn bán.${muon}`,
        goiY: `${hoiQuay}Khách vẫn lấy hàng thì bán cho khách, nếu không thì trả lại tiền.`,
      };
  }
}

/** Vì sao không bán cho khách được (nút bị khóa); null = bán được. */
function lyDoKhongBan(gd) {
  const nhan = soTien(gd.soTienDaNhan);
  if (nhan == null) return "Chưa rõ số tiền đã nhận — kiểm tra sao kê ngân hàng rồi trả lại tiền.";
  if (nhan < soTien(gd.soTien)) return "Khách chuyển thiếu nên không bán được.";
  return null;
}

const tomTatHang = (gd) => (gd.items ?? [])
  .map((d) => `${Number(d.soLuong)} × ${d.tenSanPham || `biến thể #${d.bienTheSanPhamId}`}`)
  .join(", ");

export default function DoiSoatChuyenKhoan() {
  const [tab, setTab] = useState(TAB_CAN_XU_LY);
  const [boLoc, setBoLoc] = useState({ loai: "quan-ly", khoId: "", tuNgay: "", denNgay: "", page: 0, size: SO_DONG_MAC_DINH });
  const [khoOptions, setKhoOptions] = useState([{ value: "", label: "Tất cả kho" }]);
  const [hopThoai, setHopThoai] = useState(null); // { loai: "ban" | "tra-lai" | "xem", gd }
  const soCanXuLy = useSoChuyenKhoanCanXuLy();

  useEffect(() => {
    taiLaiSoChuyenKhoanCanXuLy();
  }, []);

  useEffect(() => {
    getMineKhoList()
      .then((ds) => setKhoOptions([
        { value: "", label: "Tất cả kho" },
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
    { value: TAB_CAN_XU_LY, label: "Cần xử lý", count: soCanXuLy, tone: "danger" },
    { value: TAB_DA_XU_LY, label: "Đã xử lý" },
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
    toast.warning("Khoản này vừa được người khác xử lý — đã tải lại danh sách. Nếu bạn đã chuyển trả tiền cho khách, hãy báo chủ cửa hàng để đối chiếu.");
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
        toast.warning("Khoản này vừa được xử lý ở nơi khác — đã tải lại danh sách.");
        taiLai();
        return;
      }
      setHopThoai({ loai, gd });
    } catch {
      toast.error("Không kiểm tra được trạng thái mới nhất của khoản này. Kiểm tra mạng rồi thử lại.");
    } finally {
      setDangMo(null);
    }
  };

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader />

      <TableShell
        fill
        toolbar={
          <ListToolbar
            tabs={<StatusTabs label="Đối soát chuyển khoản" tabs={tabs} value={tab} onChange={setTab} />}
            hasFilter={tab === TAB_DA_XU_LY && coLoc}
            onClear={xoaLoc}
          >
            {tab === TAB_DA_XU_LY ? (
              <>
                <FilterSelect
                  label="Hiển thị"
                  value={boLoc.loai}
                  options={BO_LOC_DA_XU_LY}
                  onChange={(loai) => setBoLoc((p) => ({ ...p, loai, page: 0 }))}
                />
                <FilterSelect
                  label="Kho"
                  value={boLoc.khoId}
                  options={khoOptions}
                  onChange={(khoId) => setBoLoc((p) => ({ ...p, khoId, page: 0 }))}
                />
                <label className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-white pl-3 pr-2 text-sm focus-within:border-bo-primary focus-within:ring-2 focus-within:ring-bo-primary/15 sm:w-auto">
                  <Calendar className="size-4 shrink-0 text-bo-muted" />
                  <span className="shrink-0 text-xs text-bo-muted">Từ</span>
                  <Input type="date" aria-label="Từ ngày tạo mã QR" className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" value={boLoc.tuNgay} onChange={doiNgay("tuNgay")} />
                  <span className="shrink-0 text-xs text-bo-muted">đến</span>
                  <Input type="date" aria-label="Đến ngày tạo mã QR" className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" value={boLoc.denNgay} onChange={doiNgay("denNgay")} />
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
          <LoadingState label="Đang tải danh sách chuyển khoản" />
        ) : loadError ? (
          <ErrorState description={LOAD_ERROR_MESSAGE} onRetry={taiLai} />
        ) : tab === TAB_CAN_XU_LY ? (
          <div className="space-y-3 p-4">
            <p className="max-w-3xl rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm leading-6 text-bo-muted">
              Khách đã chuyển khoản qua mã QR tại quầy nhưng hệ thống chưa tạo được đơn bán. Với mỗi khoản: nếu khách vẫn lấy hàng thì <strong className="text-bo-foreground">bán cho khách</strong>, nếu không thì <strong className="text-bo-foreground">trả lại tiền</strong>. Không thu tiền lại của khách.
            </p>
            {data.length === 0 ? (
              <EmptyState
                icon={CircleCheckBig}
                title="Không có khoản nào cần xử lý"
                description="Mọi khoản chuyển khoản tại quầy đều đã có đơn bán."
              />
            ) : (
              data.map((gd) => (
                <TheCanXuLy
                  key={gd.orderCode}
                  gd={gd}
                  dangMo={dangMo === gd.orderCode}
                  onBan={() => moXuLy("ban", gd)}
                  onTraLai={() => moXuLy("tra-lai", gd)}
                />
              ))
            )}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Không có giao dịch phù hợp"
            description={coLoc ? "Thử đổi kho hoặc khoảng ngày." : "Khoản đã bán cho khách hoặc đã trả lại tiền sẽ hiện ở đây."}
            action={coLoc ? <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">Xóa lọc</Button> : null}
          />
        ) : (
          <table className={`w-full min-w-[960px] text-sm transition-opacity ${danhSach.loading ? "opacity-60" : ""}`} aria-busy={danhSach.loading}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-bo-border bg-bo-surface-subtle">
                <th className={headCell}>Tạo mã QR lúc</th>
                <th className={`${headCell} text-right`}>Số tiền</th>
                <th className={headCell}>Người chuyển</th>
                <th className={headCell}>Kho · thu ngân</th>
                <th className={headCell}>Kết quả</th>
                <th className={headCell}>Người xử lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bo-border">
              {data.map((gd) => (
                <tr
                  key={gd.orderCode}
                  tabIndex={0}
                  aria-label={`Xem giao dịch ${formatCurrency(gd.soTien)} lúc ${gio(gd.ngayTao)}`}
                  className="cursor-pointer transition-colors hover:bg-bo-surface-subtle focus-visible:bg-bo-surface-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-bo-primary"
                  onClick={() => setHopThoai({ loai: "xem", gd })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHopThoai({ loai: "xem", gd }); } }}
                >
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-bo-muted">{gio(gd.ngayTao)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-bo-foreground">
                    <span className="font-semibold">{formatCurrency(soTienHienThi(gd))}</span>
                    {gd.soTienDaNhan != null && soTien(gd.soTienDaNhan) !== soTienHienThi(gd) ? <div className="text-xs font-normal text-bo-muted">đã nhận {formatCurrency(gd.soTienDaNhan)}</div> : null}
                  </td>
                  <td className="px-3 py-3 text-bo-foreground">{gd.tenNguoiChuyen || <span className="text-bo-muted">—</span>}</td>
                  <td className="px-3 py-3"><div className="text-bo-foreground">{gd.tenKho || "—"}</div><div className="text-xs text-bo-muted">{gd.tenThuNgan || "—"}</div></td>
                  <td className="px-3 py-3"><StatusBadge label={nhanTrangThai(gd)} />{gd.soDonHang ? <div className="mt-1 text-xs text-bo-muted">Đơn {gd.soDonHang}</div> : null}</td>
                  <td className="px-3 py-3 text-xs text-bo-muted">{gd.tenNguoiXuLy ? <>{gd.tenNguoiXuLy}<div>{gio(gd.xuLyLuc)}</div></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableShell>

      {hopThoai?.loai === "ban" ? (
        <HopThoaiBanChoKhach gd={hopThoai.gd} onClose={() => setHopThoai(null)} onXong={daXuLyXong} onCu={giaoDichCu} />
      ) : null}
      {hopThoai?.loai === "tra-lai" ? (
        <HopThoaiTraLaiTien gd={hopThoai.gd} onClose={() => setHopThoai(null)} onXong={daXuLyXong} onCu={giaoDichCu} />
      ) : null}
      {hopThoai?.loai === "xem" ? <HopThoaiXem gd={hopThoai.gd} onClose={() => setHopThoai(null)} /> : null}
    </PageContainer>
  );
}

/** Một khoản tiền cần xử lý: số tiền, lý do bằng lời, gợi ý, hai nút. */
function TheCanXuLy({ gd, dangMo, onBan, onTraLai }) {
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
        Hàng: {tomTatHang(gd) || "—"} · {gd.dangGiuCho ? "đang được giữ trong kho" : "đã trả về kho bán tiếp"}
      </p>
      <p className="rounded-md bg-bo-primary-soft px-3 py-2 text-[13px] leading-5 text-bo-foreground">Gợi ý: {chuyen.goiY}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="bg-bo-primary text-white hover:bg-bo-primary-hover"
          disabled={Boolean(khongBan) || dangMo}
          onClick={onBan}
          aria-label={`Bán cho khách khoản ${formatCurrency(soTienHienThi(gd))}`}
          aria-describedby={khongBan ? `ly-do-khong-ban-${gd.orderCode}` : undefined}
        >
          Bán cho khách (tạo đơn)
        </Button>
        <Button variant="outline" className="border-bo-border bg-white" disabled={dangMo} onClick={onTraLai} aria-label={`Trả lại tiền khoản ${formatCurrency(soTienHienThi(gd))}`}>
          {dangMo ? "Đang kiểm tra…" : "Trả lại tiền cho khách"}
        </Button>
        {khongBan ? <span id={`ly-do-khong-ban-${gd.orderCode}`} className="text-xs text-bo-muted">{khongBan}</span> : null}
      </div>
      <ChiTietKyThuat gd={gd} />
    </article>
  );
}

/** Mã kỹ thuật cho người đối soát với ngân hàng / my.payos.vn — thu gọn mặc định. */
function ChiTietKyThuat({ gd }) {
  return (
    <details className="text-xs text-bo-muted">
      <summary className="cursor-pointer select-none hover:text-bo-foreground">Chi tiết kỹ thuật</summary>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
        <dt>Mã QR (payOS)</dt><dd className="font-mono">{gd.orderCode}</dd>
        <dt>Nội dung CK</dt><dd className="break-all font-mono">{gd.noiDungCk || "—"}</dd>
        <dt>Mã GD ngân hàng</dt><dd className="break-all font-mono">{gd.maGiaoDichNganHang || "—"}</dd>
        <dt>Tạo mã · hết hạn</dt><dd>{gio(gd.ngayTao)} · {gio(gd.hetHanLuc)}</dd>
        {gd.errorMessage ? <><dt>Ghi nhận của hệ thống</dt><dd>{gd.errorMessage}</dd></> : null}
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
        payOS không gửi tài khoản người chuyển: tra sao kê ngân hàng của cửa hàng theo thời điểm {gio(gd.thanhToanLuc)} và nội dung{" "}
        <span className="font-mono">{gd.noiDungCk || "—"}</span> để biết trả về đâu.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 rounded-md border border-dashed border-bo-border bg-bo-surface-subtle px-3 py-2">
      <span className="font-medium">{gd.tenNguoiChuyen || "—"}</span>
      {gd.nganHangNguoiChuyen ? <span className="text-bo-muted">· {gd.nganHangNguoiChuyen}</span> : null}
      {gd.soTkNguoiChuyen ? (
        <span className="inline-flex items-center gap-1 font-mono">· {gd.soTkNguoiChuyen}<NutSaoChep giaTri={gd.soTkNguoiChuyen} nhan="Sao chép số tài khoản khách" /></span>
      ) : null}
    </div>
  );
}

/** Lỗi 409 "không còn chờ xử lý" = người khác đã xử lý trước. */
const laGiaoDichCu = (error) =>
  error?.response?.status === 409 && String(error?.response?.data?.message ?? "").includes("không còn chờ xử lý");

/** Bán cho khách: xem trước đơn sẽ tạo rồi mới xác nhận. */
function HopThoaiBanChoKhach({ gd, onClose, onXong, onCu }) {
  const [daKiemTra, setDaKiemTra] = useState(false);
  const [ghiChu, setGhiChu] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState("");
  const du = (soTien(gd.soTienDaNhan) ?? 0) - soTien(gd.soTien);
  const traMuon = Boolean(gd.tienVeSauHuy);

  const xacNhan = async () => {
    if (traMuon && !daKiemTra) return setLoi("Xác nhận đã hỏi quầy: khách này đã nhận hàng, chưa bán cho ai khác.");
    setDangGui(true);
    setLoi("");
    try {
      const capNhat = await posService.createOrderFromPayosError(gd.orderCode, ghiChu.trim());
      onXong(capNhat, du > 0
        ? `Đã tạo đơn bán ${capNhat?.soDonHang ?? ""}. Nhớ trả lại phần dư ${formatCurrency(du)} cho khách.`
        : `Đã tạo đơn bán ${capNhat?.soDonHang ?? ""}.`);
    } catch (error) {
      if (laGiaoDichCu(error)) return onCu();
      setLoi(error?.response?.data?.message || "Không tạo được đơn. Vui lòng thử lại.");
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dangGui && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bán cho khách</DialogTitle>
          <DialogDescription>Kiểm tra đơn sẽ được tạo trước khi xác nhận.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-sm">
          <p className="font-semibold text-bo-foreground">Sẽ tạo đơn bán {formatCurrency(gd.soTien)}</p>
          <p className="text-bo-muted">Ngày đơn: {gio(gd.thanhToanLuc)} (lúc tiền về) · người bán: {gd.tenThuNgan || "—"}</p>
          <p className="text-bo-muted">Trừ kho {gd.tenKho || "—"}: {tomTatHang(gd) || "—"}</p>
          <p className="text-bo-muted">Thanh toán: chuyển khoản {formatCurrency(gd.soTien)}</p>
        </div>
        {traMuon ? (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] leading-5 text-amber-900">
            <p><strong>Tiền về khi {maQrDaDong(gd)}.</strong> Thu ngân có thể đã bán các món này bằng cách khác (vd. tiền mặt). Chỉ bán khi chắc khách này đã nhận hàng.</p>
            <label className="flex items-start gap-2">
              <input className="mt-0.5" type="checkbox" checked={daKiemTra} onChange={(e) => setDaKiemTra(e.target.checked)} disabled={dangGui} />
              <span>Tôi đã hỏi quầy: khách này đã nhận hàng, chưa bán cho ai khác.</span>
            </label>
          </div>
        ) : null}
        {du > 0 ? (
          <div className="space-y-2 rounded-md border border-bo-border p-3 text-[13px] leading-5">
            <p className="text-bo-foreground">
              Khách chuyển dư <strong>{formatCurrency(du)}</strong>. <strong>Tạo đơn xong</strong> rồi mới trả lại phần dư (tạo đơn lỗi thì
              sẽ phải trả lại toàn bộ, không trả phần dư trước). Ghi chú đơn sẽ có dòng "cần hoàn lại {formatCurrency(du)}".
            </p>
            <KhoiTaiKhoanKhach gd={gd} />
            <label className="block text-bo-muted" htmlFor="ghi-chu-ban">Ghi chú (không bắt buộc)</label>
            <Input id="ghi-chu-ban" maxLength={500} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} disabled={dangGui} placeholder="vd. sẽ trả phần dư qua BIDV" />
          </div>
        ) : null}
        {loi ? <p className="text-sm text-bo-danger" role="alert">{loi}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-bo-border bg-white" disabled={dangGui} onClick={onClose}>Quay lại</Button>
          <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dangGui} onClick={xacNhan}>{dangGui ? "Đang tạo đơn…" : "Tạo đơn bán"}</Button>
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

  const xacNhan = async () => {
    if (!maHoan.trim()) return setLoi("Nhập mã giao dịch hoàn tiền trên app ngân hàng (hoặc ghi chú cách đã trả).");
    setDangGui(true);
    setLoi("");
    try {
      const capNhat = await posService.markPayosRefunded(gd.orderCode, maHoan.trim());
      onXong(capNhat, "Đã ghi lại việc trả lại tiền cho khách.");
    } catch (error) {
      if (laGiaoDichCu(error)) return onCu();
      setLoi(error?.response?.data?.message || "Không ghi lại được. Vui lòng thử lại.");
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !dangGui && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trả lại tiền cho khách</DialogTitle>
          <DialogDescription className="rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            Hệ thống không tự chuyển tiền. Bạn chuyển trả bằng app ngân hàng của cửa hàng, rồi ghi lại ở đây.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">1</span>
            <div className="space-y-1.5">
              <p className="font-semibold text-bo-foreground">
                Chuyển trả {soTra == null ? "số tiền khách đã chuyển (xem sao kê)" : formatCurrency(soTra)} về tài khoản khách đã dùng:
              </p>
              <KhoiTaiKhoanKhach gd={gd} />
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">2</span>
            <div className="space-y-1.5">
              <label className="block font-semibold text-bo-foreground" htmlFor="ma-hoan">Ghi lại mã giao dịch hoàn tiền (bắt buộc)</label>
              <Input id="ma-hoan" autoFocus maxLength={500} value={maHoan} onChange={(e) => setMaHoan(e.target.value)} disabled={dangGui} placeholder="vd. FT26298123456" />
            </div>
          </li>
          <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
            <span className="grid size-6 place-items-center rounded-full bg-bo-primary text-xs font-semibold text-white">3</span>
            <p className="text-bo-muted">
              Kết quả: khoản này chuyển sang "Đã xử lý · Đã trả lại tiền"{gd.dangGiuCho ? `; hàng đang giữ (${tomTatHang(gd)}) được trả về kho để bán tiếp` : ""}; hóa đơn trên quầy (nếu thu ngân còn mở) được mở khóa. Không tạo đơn bán.
            </p>
          </li>
        </ol>
        {loi ? <p className="text-sm text-bo-danger" role="alert">{loi}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="border-bo-border bg-white" disabled={dangGui} onClick={onClose}>Quay lại</Button>
          <Button className="bg-bo-primary text-white hover:bg-bo-primary-hover" disabled={dangGui} onClick={xacNhan}>{dangGui ? "Đang ghi…" : "Tôi đã chuyển trả, ghi lại"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Xem một giao dịch đã xử lý / mọi mã QR (chỉ đọc). */
function HopThoaiXem({ gd, onClose }) {
  const chuyen = gd.lyDo ? keChuyen(gd) : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formatCurrency(soTienHienThi(gd))} · {nhanTrangThai(gd)}</DialogTitle>
          <DialogDescription>{gd.tenKho || "—"} · thu ngân {gd.tenThuNgan || "—"} · tạo mã QR {gio(gd.ngayTao)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {chuyen ? <p className="text-bo-foreground">{chuyen.chuyen}</p> : null}
          {gd.soDonHang ? <p>Đơn bán: <strong>{gd.soDonHang}</strong></p> : null}
          {gd.tenNguoiChuyen ? <p className="text-bo-muted">Người chuyển: {gd.tenNguoiChuyen}{gd.nganHangNguoiChuyen ? ` · ${gd.nganHangNguoiChuyen}` : ""}{gd.soTkNguoiChuyen ? ` · ${gd.soTkNguoiChuyen}` : ""}</p> : null}
          {gd.tenNguoiXuLy ? <p className="text-bo-muted">Xử lý bởi {gd.tenNguoiXuLy} lúc {gio(gd.xuLyLuc)}{gd.ghiChuXuLy ? ` — ${gd.ghiChuXuLy}` : ""}</p> : null}
          <p className="text-bo-muted">Hàng: {tomTatHang(gd) || "—"}</p>
          <ChiTietKyThuat gd={gd} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-bo-border bg-white" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
