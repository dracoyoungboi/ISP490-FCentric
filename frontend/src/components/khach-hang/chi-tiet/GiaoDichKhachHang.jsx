import { useCallback, useEffect, useState } from "react";
import { SearchX, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListToolbar from "@/components/shared/ListToolbar";
import SearchInput from "@/components/shared/SearchInput";
import TablePagination from "@/components/shared/TablePagination";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { donBanHangService } from "@/services/donBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { BangDonKhachHang } from "./BangGiaoDichKhachHang";
import { LUA_CHON_THOI_GIAN, SAP_XEP_MOI_NHAT, dieuKienDon, luaChonKenh } from "./tinhKhachHang";
import { t } from "@/i18n";

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
 * Cột trái của thân khối: đơn hàng của khách, phân trang ở máy chủ (nhiều đơn không làm trang dài ra: màn rộng thì thân
 * bảng tự cuộn, phân trang luôn ở đáy khối). Hàng tiêu đề (vẽ như tab đang chọn của StatusTabs) và bộ lọc dùng chung
 * ListToolbar / FilterSelect / SearchInput / TablePagination như các trang danh sách.
 *
 * - `tongDon`: tổng số đơn (kể cả nháp) theo số tổng hợp — số cạnh tiêu đề và điều kiện hiện bộ lọc; `undefined` khi chưa có.
 * - `kenhMua`: kênh khách đã mua, làm lựa chọn lọc kênh (chỉ hiện khi khách mua qua từ 2 kênh).
 * - `ghiChuPhamVi`: câu phạm vi dữ liệu theo vai trò, hiện ở chân bảng.
 */
export default function GiaoDichKhachHang({ khachHangId, tongDon, kenhMua, ghiChuPhamVi }) {
  // ── Bộ lọc đơn (ô tìm có trễ để không gọi máy chủ theo từng phím) ─────────
  const [oTim, setOTim] = useState("");
  const [tuKhoa, setTuKhoa] = useState("");
  const [kenh, setKenh] = useState("");
  const [thoiGian, setThoiGian] = useState("");
  const [trangDon, setTrangDon] = useState(0);
  const [soDongDon, setSoDongDon] = useState(SO_DONG_MAC_DINH);

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
  const q = useTaiDuLieu(taiDon, `don-kh-${khachHangId}|${tuKhoa}|${kenh}|${thoiGian}|${trangDon}|${soDongDon}`, {
    enabled: Boolean(khachHangId),
  });
  const dong = q.data?.content ?? [];
  const tong = q.data?.totalElements ?? 0;

  // Tổng số đơn khi không lọc: lấy từ số tổng hợp; chưa có thì dùng tổng của danh sách lúc chưa lọc
  const tongDonKhongLoc = tongDon ?? (!dangLoc && q.data ? q.data.totalElements : undefined);
  const hienLoc = dangLoc || (tongDonKhongLoc ?? 0) >= SO_DON_HIEN_LOC;
  const luaChonKenhDs = luaChonKenh(kenhMua);
  const hienLocKenh = kenh !== "" || luaChonKenhDs.length > 2;

  let noiDung;
  if (q.error && !q.loiTaiLai) {
    noiDung = (
      <ErrorState
        className="kh-trong min-h-56"
        title={t("Không tải được đơn hàng của khách")}
        description={getApiErrorMessage(q.error, t("Kiểm tra kết nối rồi thử lại."))}
        onRetry={q.reload}
      />
    );
  } else if (q.data === undefined) {
    noiDung = <KhungDangTai />;
  } else if (dong.length === 0) {
    if (dangLoc) {
      noiDung = (
        <EmptyState
          className="kh-trong min-h-56"
          icon={SearchX}
          title={t("Không có đơn phù hợp")}
          description={t("Thử bỏ bớt điều kiện lọc.")}
          action={
            <Button type="button" variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface shadow-none">
              {t("Xóa lọc")}
            </Button>
          }
        />
      );
    } else {
      noiDung = (
        <EmptyState
          className="kh-trong min-h-56"
          icon={ShoppingBag}
          title={t("Chưa có đơn hàng")}
          description={t("Đơn tại quầy và đơn từ sàn của khách này sẽ hiện ở đây.")}
        />
      );
    }
  } else {
    noiDung = <BangDonKhachHang dons={dong} />;
  }

  const ghiChu = ghiChuPhamVi || "";

  return (
    <section aria-label={t("Giao dịch của khách hàng")} className="kh-giao-dich flex min-w-0 flex-col">
      <ListToolbar
        tabs={
          <h2 className="-mb-px inline-flex h-12 items-center gap-2 border-b-2 border-bo-primary px-2.5 text-sm font-semibold text-bo-foreground">
            {t("Đơn hàng")}
            {tongDonKhongLoc > 0 ? (
              <span className="inline-flex h-5 min-w-[22px] items-center justify-center rounded-full bg-bo-primary-soft px-1.5 text-xs font-semibold tabular-nums text-bo-primary">
                {tongDonKhongLoc.toLocaleString("vi-VN")}
              </span>
            ) : null}
          </h2>
        }
        hasFilter={hienLoc && dangLoc}
        onClear={xoaLoc}
      >
        {hienLoc ? (
          <>
            <SearchInput
              label={t("Tìm theo mã đơn")}
              placeholder={t("Tìm theo mã đơn")}
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
                label={t("Kênh bán")}
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
                clearLabel={t("Bỏ lọc kênh bán")}
              />
            ) : null}
            <FilterSelect
              label={t("Thời gian đặt")}
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
              clearLabel={t("Bỏ lọc thời gian")}
              align="end"
            />
          </>
        ) : null}
      </ListToolbar>

      <div
        id="vung-giao-dich-kh"
        role="region"
        aria-label={t("Đơn hàng của khách hàng, mới nhất ở trên")}
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
              page={q.data.number ?? trangDon}
              size={soDongDon}
              total={tong}
              totalLabel={t("đơn", { context: "don_vi" })}
              onPageChange={setTrangDon}
              onSizeChange={(n) => {
                setSoDongDon(n);
                setTrangDon(0);
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
