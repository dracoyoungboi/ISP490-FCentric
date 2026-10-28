import { useCallback, useEffect, useState } from "react";
import { FilePlus2, FileText, SearchX, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import StatusTabs from "@/components/shared/StatusTabs";
import TablePagination from "@/components/shared/TablePagination";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { donBanHangService } from "@/services/donBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { BangBaoGiaKhachHang, BangDonKhachHang } from "./BangGiaoDichKhachHang";
import {
  LUA_CHON_THOI_GIAN,
  SAP_XEP_MOI_NHAT,
  dieuKienBaoGia,
  dieuKienDon,
  luaChonKenh,
} from "./tinhKhachHang";

const TRE_TIM_KIEM_MS = 350;
/** Từ số đơn này trở lên mới hiện ô tìm và bộ lọc (ít đơn thì nhìn là thấy, không cần lọc). */
const SO_DON_HIEN_LOC = 10;

function KhungDangTai() {
  return (
    <div aria-hidden="true" className="divide-y divide-slate-100">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="grid grid-cols-6 gap-3 px-4 py-4 sm:px-6">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="ml-auto h-3 w-24 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

/**
 * Tải một trang ở máy chủ; trang đang xem vượt số trang thật (vd. đơn vừa bị xóa ở nơi khác) thì tải luôn trang cuối
 * còn dữ liệu. Kết quả là Page của Spring: `number` là trang thật sự đang hiện.
 */
async function taiTrang(goi, trang, kichThuoc) {
  const res = await goi(trang);
  const ve = trangCuoiNeuVuot({ trang, kichThuoc, soDong: res?.content?.length ?? 0, tong: res?.totalElements });
  return ve == null ? res : goi(ve);
}

/**
 * Cột trái của thân khối: tab Đơn hàng / Báo giá của khách, mỗi tab một bảng phân trang ở máy chủ
 * (nhiều đơn không làm trang dài ra: màn rộng thì thân bảng tự cuộn, phân trang luôn ở đáy khối).
 * Hàng tab và bộ lọc dùng chung ListToolbar / StatusTabs / FilterSelect / SearchInput / TablePagination như các trang danh sách.
 *
 * - `tongDon`: tổng số đơn (kể cả nháp) theo số tổng hợp — số trên tab và điều kiện hiện bộ lọc; `undefined` khi chưa có.
 * - `kenhMua`: kênh khách đã mua, làm lựa chọn lọc kênh (chỉ hiện khi khách mua qua từ 2 kênh).
 * - `xemBaoGia`: vai trò thấy báo giá (vai trò kho chỉ thấy chứng từ của kho mình, báo giá chưa có kho nên ẩn tab).
 * - `ghiChuPhamVi`: câu phạm vi dữ liệu theo vai trò, hiện ở chân bảng.
 */
export default function GiaoDichKhachHang({
  khachHangId,
  tab,
  onDoiTab,
  tongDon,
  kenhMua,
  xemBaoGia,
  coTheTaoBaoGia,
  coTheTaoDon,
  onTaoBaoGia,
  ghiChuPhamVi,
}) {
  // ── Bộ lọc đơn (ô tìm có trễ để không gọi máy chủ theo từng phím) ─────────
  const [oTim, setOTim] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [kenh, setKenh] = useState("");
  const [thoiGian, setThoiGian] = useState("");
  const [trangDon, setTrangDon] = useState(0);
  const [soDongDon, setSoDongDon] = useState(SO_DONG_MAC_DINH);
  const [trangBg, setTrangBg] = useState(0);
  const [soDongBg, setSoDongBg] = useState(SO_DONG_MAC_DINH);

  useEffect(() => {
    const moi = oTim.trim();
    if (moi === tuKhoa) return undefined;
    const hen = setTimeout(() => {
      setTuKhoa(moi);
      setTrangDon(0);
    }, TRE_TIM_KIEM_MS);
    return () => clearTimeout(hen);
  }, [oTim, tuKhoa]);

  const dangLoc = Boolean(tuKhoa || kenh || thoiGian);
  const xoaLoc = () => {
    setOTim("");
    setTuKhoa("");
    setKenh("");
    setThoiGian("");
    setTrangDon(0);
  };

  // ── Đơn hàng ──────────────────────────────────────────────────────────────
  const taiDon = useCallback(() => {
    const filters = dieuKienDon({ khachHangId, tuKhoa, kenh, thoiGian });
    return taiTrang(
      (page) => donBanHangService.filter({ filters, sorts: SAP_XEP_MOI_NHAT, page, size: soDongDon }),
      trangDon,
      soDongDon,
    );
  }, [khachHangId, tuKhoa, kenh, thoiGian, trangDon, soDongDon]);
  const donQ = useTaiDuLieu(taiDon, `don-kh-${khachHangId}|${tuKhoa}|${kenh}|${thoiGian}|${trangDon}|${soDongDon}`, {
    enabled: Boolean(khachHangId),
  });

  // ── Báo giá ───────────────────────────────────────────────────────────────
  const taiBaoGia = useCallback(
    () =>
      taiTrang(
        (page) =>
          donBanHangService.filter({ filters: dieuKienBaoGia(khachHangId), sorts: SAP_XEP_MOI_NHAT, page, size: soDongBg }),
        trangBg,
        soDongBg,
      ),
    [khachHangId, trangBg, soDongBg],
  );
  const bgQ = useTaiDuLieu(taiBaoGia, `bg-kh-${khachHangId}|${trangBg}|${soDongBg}`, {
    enabled: Boolean(khachHangId) && xemBaoGia,
  });

  const laTabDon = tab === "don-hang" || !xemBaoGia;
  const q = laTabDon ? donQ : bgQ;
  const dong = q.data?.content ?? [];
  const tong = q.data?.totalElements ?? 0;

  // Tổng số đơn khi không lọc: lấy từ số tổng hợp; chưa có thì dùng tổng của danh sách lúc chưa lọc
  const tongDonKhongLoc = tongDon ?? (!dangLoc && donQ.data ? donQ.data.totalElements : undefined);
  const hienLoc = laTabDon && (dangLoc || (tongDonKhongLoc ?? 0) >= SO_DON_HIEN_LOC);
  const luaChonKenhDs = luaChonKenh(kenhMua);
  const hienLocKenh = kenh !== "" || luaChonKenhDs.length > 2;

  const tabs = [
    { value: "don-hang", label: "Đơn hàng", count: tongDonKhongLoc },
    xemBaoGia ? { value: "bao-gia", label: "Báo giá", count: bgQ.data?.totalElements } : null,
  ].filter(Boolean);

  let noiDung;
  if (q.error && !q.loiTaiLai) {
    noiDung = (
      <ErrorState
        className="kh-trong min-h-56"
        title={laTabDon ? "Không tải được đơn hàng của khách" : "Không tải được báo giá của khách"}
        description={getApiErrorMessage(q.error, "Kiểm tra kết nối rồi thử lại.")}
        onRetry={q.reload}
      />
    );
  } else if (q.data === undefined) {
    noiDung = <KhungDangTai />;
  } else if (dong.length === 0) {
    if (laTabDon && dangLoc) {
      noiDung = (
        <EmptyState
          className="kh-trong min-h-56"
          icon={SearchX}
          title="Không có đơn phù hợp"
          description="Thử bỏ bớt điều kiện lọc."
          action={
            <Button type="button" variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface shadow-none">
              Xóa lọc
            </Button>
          }
        />
      );
    } else {
      const nutTaoBaoGia = coTheTaoBaoGia ? (
        <Button type="button" onClick={onTaoBaoGia} className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover">
          <FilePlus2 className="size-4" aria-hidden="true" />
          Tạo báo giá
        </Button>
      ) : null;
      noiDung = laTabDon ? (
        <EmptyState
          className="kh-trong min-h-56"
          icon={ShoppingBag}
          title="Chưa có đơn hàng"
          description="Đơn bán tạo từ báo giá khách đồng ý, đơn Shopify và đơn tại quầy của khách này sẽ hiện ở đây."
          action={nutTaoBaoGia}
        />
      ) : (
        <EmptyState
          className="kh-trong min-h-56"
          icon={FileText}
          title="Chưa có báo giá"
          description="Báo giá gửi cho khách hàng này sẽ hiện ở đây; khách đồng ý thì tạo đơn bán ngay từ báo giá."
          action={nutTaoBaoGia}
        />
      );
    }
  } else {
    noiDung = laTabDon ? (
      <BangDonKhachHang dons={dong} />
    ) : (
      <BangBaoGiaKhachHang baoGias={dong} coTheTaoDon={coTheTaoDon} />
    );
  }

  const ghiChu = ghiChuPhamVi
    ? laTabDon
      ? ghiChuPhamVi
      : ghiChuPhamVi.replace("Chỉ tính đơn", "Chỉ hiện báo giá")
    : "";

  return (
    <section aria-label="Giao dịch của khách hàng" className="kh-giao-dich flex min-w-0 flex-col">
      <ListToolbar
        tabs={
          <StatusTabs
            label="Loại giao dịch"
            tabs={tabs}
            value={laTabDon ? "don-hang" : "bao-gia"}
            onChange={onDoiTab}
          />
        }
        hasFilter={hienLoc && dangLoc}
        onClear={xoaLoc}
      >
        {hienLoc ? (
          <>
            <SearchInput
              label="Tìm theo mã đơn"
              placeholder="Tìm theo mã đơn"
              value={oTim}
              onChange={(e) => setOTim(e.target.value)}
              onClear={() => {
                setOTim("");
                setTuKhoa("");
                setTrangDon(0);
              }}
              className="sm:w-60"
            />
            {hienLocKenh ? (
              <FilterSelect
                label="Kênh bán"
                value={kenh}
                options={luaChonKenhDs}
                onChange={(v) => {
                  setKenh(v);
                  setTrangDon(0);
                }}
                onClear={() => {
                  setKenh("");
                  setTrangDon(0);
                }}
                clearLabel="Bỏ lọc kênh bán"
              />
            ) : null}
            <FilterSelect
              label="Thời gian đặt"
              value={thoiGian}
              options={LUA_CHON_THOI_GIAN}
              onChange={(v) => {
                setThoiGian(v);
                setTrangDon(0);
              }}
              onClear={() => {
                setThoiGian("");
                setTrangDon(0);
              }}
              clearLabel="Bỏ lọc thời gian"
              align="end"
            />
          </>
        ) : null}
      </ListToolbar>

      <div
        id="vung-giao-dich-kh"
        role="tabpanel"
        aria-label={laTabDon ? "Đơn hàng của khách hàng, mới nhất ở trên" : "Báo giá của khách hàng"}
        aria-busy={q.loading || undefined}
        className={cn(
          "kh-bang min-w-0 flex-1 overflow-x-auto transition-opacity",
          q.loading && q.data !== undefined && "opacity-60",
        )}
      >
        {noiDung}
      </div>

      {q.data !== undefined && (tong > 0 || ghiChu) && !(q.error && !q.loiTaiLai) ? (
        <div className="mt-auto border-t border-bo-border px-4 py-3 sm:px-6">
          {tong > 0 ? (
            <TablePagination
              page={q.data.number ?? (laTabDon ? trangDon : trangBg)}
              size={laTabDon ? soDongDon : soDongBg}
              total={tong}
              totalLabel={laTabDon ? "đơn" : "báo giá"}
              onPageChange={laTabDon ? setTrangDon : setTrangBg}
              onSizeChange={(n) => {
                if (laTabDon) {
                  setSoDongDon(n);
                  setTrangDon(0);
                } else {
                  setSoDongBg(n);
                  setTrangBg(0);
                }
              }}
              extra={ghiChu ? <span className="text-xs text-bo-muted">{ghiChu}</span> : null}
            />
          ) : (
            <p className="text-xs text-bo-muted">{ghiChu}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
