import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, KeyRound, ShieldAlert } from "lucide-react";

import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import TheThietBi from "@/components/nguoi-dung/ho-so/TheThietBi";
import { SO_THE_TREN_TRANG } from "@/components/nguoi-dung/ho-so/thietBiHoSo";
import { cn } from "@/lib/utils";
import { moTaThietBi } from "@/utils/thietBi";
import { t } from "@/i18n";

/**
 * Tab "Đăng nhập" ở Chi tiết người dùng (quản trị viên): dựng từ dữ liệu sẵn có (không thêm bảng).
 * - Khung chú ý (đỏ) khi sai mật khẩu nhiều lần, hoặc có người nhập đúng mật khẩu khi tài khoản đang khóa.
 * - Không lặp số liệu: "đăng nhập gần nhất" ở cột Tài khoản, số thiết bị ở tiêu đề mục bên dưới, số lần sai ở khung
 *   chú ý + bảng lịch sử — nên bỏ dải thẻ tóm tắt.
 * - Thiết bị đang đăng nhập: CHỈ XEM — quản trị viên không đăng xuất từng thiết bị của người khác (gửi liên kết đặt lại
 *   mật khẩu hoặc khóa tài khoản thì đăng xuất mọi thiết bị).
 * - Lịch sử đăng nhập 90 ngày, nhóm theo ngày: giờ · kết quả · IP. Không có "đăng xuất" (hệ thống không ghi) và không có
 *   thiết bị cho từng dòng (chỉ IP được lưu).
 */

// Nhãn + chấm màu cho từng kết quả một lần đăng nhập. t() gọi ở cấp module vẫn đúng: đổi ngôn ngữ tải lại trang.
const KET_QUA = {
  thanh_cong: { nhan: t("Thành công"), cham: "bg-bo-tt-xong-hinh" },
  sai_mat_khau: { nhan: t("Sai mật khẩu"), cham: "bg-bo-tt-loi-hinh" },
  tai_khoan_khoa: { nhan: t("Tài khoản khóa · nhập đúng mật khẩu"), cham: "bg-bo-tt-chu-y-hinh" },
};

const LOC = [
  { ma: "all", nhan: t("Tất cả"), thuoc: () => true },
  { ma: "thanh_cong", nhan: t("Thành công"), thuoc: (d) => d.ketQua === "thanh_cong" },
  { ma: "that_bai", nhan: t("Thất bại"), thuoc: (d) => d.ketQua !== "thanh_cong" },
];

/** Giờ:phút của một mốc, giờ Việt Nam. */
function gioPhut(luc) {
  if (!luc) return "—";
  const d = luc instanceof Date ? luc : new Date(luc);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/** Tiêu đề nhóm ngày: "Hôm nay" / "Hôm qua" / dd/mm/yyyy. */
function nhanNgay(luc) {
  const d = luc instanceof Date ? luc : new Date(luc);
  const homNay = new Date();
  const homQua = new Date();
  homQua.setDate(homQua.getDate() - 1);
  const cungNgay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (cungNgay(d, homNay)) return t("Hôm nay");
  if (cungNgay(d, homQua)) return t("Hôm qua");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Gom các dòng theo ngày, giữ thứ tự mới nhất trước. */
function nhomTheoNgay(ds) {
  const nhom = [];
  let hienTai = null;
  for (const d of ds) {
    const khoa = nhanNgay(d.luc);
    if (!hienTai || hienTai.khoa !== khoa) {
      hienTai = { khoa, ds: [] };
      nhom.push(hienTai);
    }
    hienTai.ds.push(d);
  }
  return nhom;
}

export function KetQuaPill({ ketQua }) {
  const kq = KET_QUA[ketQua] || KET_QUA.sai_mat_khau;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-bo-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", kq.cham)} aria-hidden="true" />
      {kq.nhan}
    </span>
  );
}

export default function DangNhapNguoiDung({
  data,
  loading,
  error,
  onThuLai,
  onCapLaiMatKhau,
  onDoiMatKhau,
  coEmail = true,
  laChinhMinh = false,
}) {
  const [loc, setLoc] = useState("all");
  // Nhiều thiết bị: mặc định hiện SO_THE_TREN_TRANG thẻ, "Xem tất cả" mở rộng tại chỗ (trang không phình).
  const [moRongThietBi, setMoRongThietBi] = useState(false);

  // Thiết bị đã mới-hoạt-động-trước từ máy chủ (dsPhienHieuLuc). Chỉ thêm tên + loại để chọn biểu tượng (không sắp
  // lại theo thời gian — tránh đọc Date.now() trong lúc vẽ).
  const phien = useMemo(
    () => (Array.isArray(data?.phien) ? data.phien.map((p) => ({ ...p, ...moTaThietBi(p.userAgent) })) : []),
    [data],
  );
  const lichSu = useMemo(() => (Array.isArray(data?.lichSu) ? data.lichSu : []), [data]);
  const dsLoc = useMemo(() => lichSu.filter((LOC.find((l) => l.ma === loc) || LOC[0]).thuoc), [lichSu, loc]);
  const nhomNgay = useMemo(() => nhomTheoNgay(dsLoc), [dsLoc]);

  if (loading && !data) {
    return (
      <div className="nd-cuon flex flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
        <LoadingState className="nd-trong min-h-48" label={t("Đang tải nhật ký đăng nhập")} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="nd-cuon flex flex-1 flex-col px-4 pb-6 pt-5 sm:px-6">
        <ErrorState
          className="nd-trong min-h-48"
          title={t("Không tải được nhật ký đăng nhập")}
          description={t("Kiểm tra kết nối rồi thử lại.")}
          onRetry={onThuLai}
        />
      </div>
    );
  }

  const tomTat = data?.tomTat ?? {};
  const soLoc = (ma) => lichSu.filter((LOC.find((l) => l.ma === ma) || LOC[0]).thuoc).length;

  return (
    <div className="nd-cuon flex flex-1 flex-col gap-5 px-4 pb-6 pt-5 sm:px-6">
      {/* ── Khung chú ý ── */}
      {tomTat.canChuY ? (
        <div className="flex flex-col gap-3 rounded-lg border border-bo-danger/30 bg-bo-danger-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 size-[18px] shrink-0 text-bo-danger" aria-hidden="true" />
            <p className="text-[13px] leading-5 text-slate-700">
              {/* Quản trị viên tự xem chính mình: không tự gửi liên kết cho mình, mà đổi mật khẩu ở Hồ sơ */}
              {laChinhMinh
                ? tomTat.lyDoChuY === "khoa_dung_mat_khau"
                  ? t("Có người nhập đúng mật khẩu của bạn khi tài khoản đang khóa trong 24 giờ qua. Mật khẩu có thể đã lộ — nên đổi mật khẩu.")
                  : t("{{count}} lần đăng nhập sai mật khẩu vào tài khoản của bạn trong 24 giờ qua. Nếu không phải bạn, nên đổi mật khẩu.", { count: tomTat.soLanSaiGanDay ?? tomTat.soSai24h })
                : tomTat.lyDoChuY === "khoa_dung_mat_khau"
                  ? t("Có người nhập đúng mật khẩu khi tài khoản đang khóa trong 24 giờ qua. Mật khẩu cũ có thể đã lộ — nên gửi liên kết đặt lại mật khẩu.")
                  : t("{{count}} lần đăng nhập sai mật khẩu trong 24 giờ qua. Nếu không phải người dùng tự quên, nên gửi liên kết đặt lại mật khẩu.", { count: tomTat.soLanSaiGanDay ?? tomTat.soSai24h })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!laChinhMinh && !coEmail}
            onClick={laChinhMinh ? onDoiMatKhau : onCapLaiMatKhau}
            className="shrink-0 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle max-sm:h-11"
          >
            <KeyRound className="size-3.5" aria-hidden="true" />
            {laChinhMinh ? t("Đổi mật khẩu") : t("Gửi liên kết đặt lại mật khẩu")}
          </Button>
        </div>
      ) : null}

      {/* ── Thiết bị đang đăng nhập (chỉ xem) ── */}
      <section aria-labelledby="nd-thiet-bi">
        <h3 id="nd-thiet-bi" className="mb-2.5 text-[14px] font-semibold leading-5 text-bo-foreground">
          {t("Thiết bị đang đăng nhập")}
          {phien.length ? <span className="font-normal text-bo-muted"> ({phien.length})</span> : null}
        </h3>
        {phien.length === 0 ? (
          <p className="text-sm text-bo-muted">{t("Không có thiết bị nào đang đăng nhập.")}</p>
        ) : (
          <>
            <ul className="m-0 grid list-none gap-2.5 p-0 @lg:grid-cols-2">
              {(moRongThietBi ? phien : phien.slice(0, SO_THE_TREN_TRANG)).map((p) => (
                <TheThietBi key={p.id} phien={p} />
              ))}
            </ul>
            {phien.length > SO_THE_TREN_TRANG ? (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMoRongThietBi((m) => !m)}
                  className="border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
                >
                  {moRongThietBi ? t("Thu gọn") : t("Xem tất cả {{count}} thiết bị", { count: phien.length })}
                  {moRongThietBi ? (
                    <ChevronUp className="size-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="size-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-[18px] text-bo-muted">
          <span aria-hidden="true">ⓘ</span>
          <span>
            {laChinhMinh
              ? t("Quản lý và đăng xuất thiết bị của bạn ở Hồ sơ.")
              : t("Quản trị viên chỉ xem. Muốn đăng xuất mọi thiết bị của người này: gửi liên kết đặt lại mật khẩu, hoặc khóa tài khoản.")}
          </span>
        </p>
      </section>

      {/* ── Lịch sử đăng nhập 90 ngày ── */}
      <section aria-labelledby="nd-lich-su-dn" className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h3 id="nd-lich-su-dn" className="text-[14px] font-semibold leading-5 text-bo-foreground">
            {t("Lịch sử đăng nhập")}
            <span className="ml-1.5 font-normal text-bo-muted">{t("90 ngày")}</span>
          </h3>
          <div role="tablist" aria-label={t("Lọc lịch sử đăng nhập")} className="inline-flex rounded-lg border border-bo-border bg-bo-surface-subtle p-0.5">
            {LOC.map((l) => {
              const chon = l.ma === loc;
              return (
                <button
                  key={l.ma}
                  type="button"
                  role="tab"
                  aria-selected={chon}
                  onClick={() => setLoc(l.ma)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-bo-primary/40",
                    chon ? "bg-bo-surface text-bo-foreground shadow-sm" : "text-bo-muted hover:text-bo-foreground",
                  )}
                >
                  {l.nhan}
                  <span className="ml-1 tabular-nums text-bo-muted">{soLoc(l.ma)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {dsLoc.length === 0 ? (
          <p className="rounded-lg border border-dashed border-bo-border px-4 py-6 text-center text-sm text-bo-muted">
            {loc === "all" ? t("Chưa có lần đăng nhập nào trong 90 ngày.") : t("Không có lần nào phù hợp bộ lọc.")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-bo-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">
                  <th scope="col" className="h-9 w-px whitespace-nowrap px-4">{t("Giờ")}</th>
                  <th scope="col" className="h-9 px-4">{t("Kết quả")}</th>
                  <th scope="col" className="h-9 px-4 text-right">{t("Địa chỉ IP")}</th>
                </tr>
              </thead>
              <tbody>
                {nhomNgay.map((nhom) => (
                  <Fragment key={nhom.khoa}>
                    <tr className="border-b border-bo-border bg-bo-surface-subtle/60">
                      <th scope="colgroup" colSpan={3} className="px-4 py-1.5 text-left text-xs font-semibold text-bo-muted">
                        {nhom.khoa}
                      </th>
                    </tr>
                    {nhom.ds.map((d) => (
                      <tr key={d.id} className="border-b border-bo-border last:border-b-0">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-bo-foreground">{gioPhut(d.luc)}</td>
                        <td className="px-4 py-2.5"><KetQuaPill ketQua={d.ketQua} /></td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono text-[13px] text-bo-muted">
                          {d.diaChiIp || "—"}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
