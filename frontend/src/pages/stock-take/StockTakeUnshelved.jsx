// src/pages/stock-take/StockTakeUnshelved.jsx
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleCheck, Loader2, MapPinCheck, PackageOpen, Search, Warehouse } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import ListPageHeader from "@/components/shared/ListPageHeader";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import AnhBienThe from "@/components/chung-tu/AnhBienThe";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import MauKichCo from "@/components/chung-tu/MauKichCo";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { boDau, docSo, soVN } from "@/components/chung-tu/bangChungTu";
import { GOI_Y_O, NHAN_O, O_NHAP } from "@/components/chung-tu/kieuHopThoai";
import ChonKhoKiemKe from "@/components/kiem-ke/ChonKhoKiemKe";
import { docSoDem } from "@/components/kiem-ke/kiemKe";
import useKhoKiemKe from "@/components/kiem-ke/useKhoKiemKe";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { layHangChuaCoKe, laySoDo, xepKe } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { setKhoLamViecId, getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

const TH = "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";
const NUT_VIEN = "h-8 gap-1.5 border-bo-border bg-bo-surface text-[13px] hover:bg-bo-surface-subtle";
// Hộp xếp kệ: danh sách kệ dài hơn ngần này thì có ô lọc theo mã kệ
const SO_KE_CO_O_LOC = 12;

/**
 * Hàng chưa có kệ (/stock-take/unshelved?khoId=&tuDot=) — Đ4: lô còn tồn ở kho mà sổ kệ chưa ghi đủ (tồn lô ở kho − Σ kệ).
 * Kiểm kê toàn kho / theo danh mục bị chặn khi còn hàng này trong phạm vi; xếp lên kệ ở đây rồi bắt đầu lại. Lô có kệ gợi
 * ý (kệ lô đang nằm) xếp một chạm cả phần chưa có kệ vào kệ đó; muốn kệ khác hay số khác thì mở hộp. `tuDot` (nếu có): đợt
 * vừa bị chặn, để có nút quay lại.
 */
export default function StockTakeUnshelved() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tuDot = Number(params.get("tuDot"));
  const dotVe = Number.isInteger(tuDot) && tuDot > 0 ? tuDot : null;
  const kho = useKhoKiemKe();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const tai = useCallback(() => layHangChuaCoKe(kho.khoId), [kho.khoId]);
  const q = useTaiDuLieu(tai, `kk-chua-ke-${kho.khoId}`, { enabled: kho.khoId != null });
  const taiKe = useCallback(() => laySoDo(kho.khoId), [kho.khoId]);
  const [moHop, setMoHop] = useState(null);
  const qKe = useTaiDuLieu(taiKe, `kk-ke-xep-${kho.khoId}`, { enabled: kho.khoId != null && moHop != null });
  const [tim, setTim] = useState("");
  // Đổi kho: danh sách kho cũ còn giữ trong lúc tải — coi như đang tải, không hiện lô của kho cũ
  const duLieu = q.dungKhoa ? q.data : undefined;
  const ds = useMemo(() => {
    const tu = boDau(tim.trim()).toLowerCase();
    return (duLieu ?? []).filter((h) => !tu || boDau(`${h.maLo} ${h.sanPham?.tenSanPham ?? ""} ${h.sanPham?.maSku ?? ""}`).toLowerCase().includes(tu));
  }, [duLieu, tim]);
  const tongChua = (duLieu ?? []).reduce((s, h) => s + docSo(h.chuaCoKe), 0);

  // Xếp một chạm vào kệ gợi ý: lô đang chạy (một lô một lúc để danh sách tải lại không chen nhau)
  const [dangXepLo, setDangXepLo] = useState(null);
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: !q.loading && moHop == null && dangXepLo == null, lanCuoi: q.capNhatLuc });

  // Hộp xếp kệ. keIdChon null: người dùng chưa tự chọn — dùng kệ gợi ý nếu kệ đó có trong danh sách chọn được
  // (danh sách kệ chỉ tải khi mở hộp, nên không gán sẵn lúc mở được)
  const [keIdChon, setKeId] = useState(null);
  const [soLuong, setSoLuong] = useState(null);
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState(null);
  const [timKe, setTimKe] = useState("");
  const moXep = (h) => {
    setMoHop(h);
    setKeId(null);
    setSoLuong(docSo(h.chuaCoKe));
    setLoi(null);
    setTimKe("");
  };
  const dsKe = useMemo(
    () =>
      ((qKe.dungKhoa ? qKe.data : undefined)?.khuVuc ?? [])
        .flatMap((kv) => (kv.ke ?? []).map((k) => ({ ...k, khu: kv.ten || kv.ma })))
        .filter((k) => k.trangThai !== "BAO_TRI" && k.khoa !== "toan_ke")
        .sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi", { numeric: true })),
    [qKe.data, qKe.dungKhoa],
  );
  // Kệ gợi ý bảo trì / đang khóa kiểm kê thì không có trong dsKe: để trống, người dùng tự chọn
  const keGoiYId = moHop?.keGoiY?.id != null ? String(moHop.keGoiY.id) : "";
  const keId = keIdChon ?? (keGoiYId && dsKe.some((k) => String(k.id) === keGoiYId) ? keGoiYId : "");
  const coOLocKe = dsKe.length > SO_KE_CO_O_LOC;
  // Lọc theo mã kệ; kệ đang chọn luôn giữ trong danh sách để ô chọn không mất giá trị
  const dsKeHien = useMemo(() => {
    const tu = boDau(timKe.trim()).toLowerCase();
    if (!coOLocKe || !tu) return dsKe;
    return dsKe.filter((k) => String(k.id) === String(keId) || boDau(String(k.ma)).toLowerCase().includes(tu));
  }, [dsKe, coOLocKe, timKe, keId]);
  const keDangTai = qKe.loading && !qKe.dungKhoa;
  const loiTaiKe = !qKe.loading && qKe.error && !qKe.dungKhoa ? qKe.error : null;

  /** Ghi sổ kệ (cùng API, cùng tham số cho hộp và nút một chạm); nhân viên kho đổi kho làm việc về kho đang xem trước. */
  const ghiSoKe = (loHangId, viTriKhoId, sl) => {
    if (!laQtv && getKhoLamViecId() !== kho.khoId) setKhoLamViecId(kho.khoId);
    return xepKe(kho.khoId, { loHangId, viTriKhoId, soLuong: sl });
  };
  const xep = async () => {
    if (!moHop) return;
    setLoi(null);
    setDangChay(true);
    try {
      await ghiSoKe(moHop.loHangId, Number(keId), soLuong);
      const ke = dsKe.find((k) => String(k.id) === String(keId));
      toast.success("Đã xếp lên kệ", { description: `${soVN(soLuong)} sản phẩm lô ${moHop.maLo} → kệ ${ke?.ma ?? ""}` });
      setMoHop(null);
      q.reload();
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Chưa xếp được lên kệ"));
    } finally {
      setDangChay(false);
    }
  };
  const xepVaoGoiY = async (h) => {
    if (!h.keGoiY?.id || dangXepLo != null) return;
    const sl = docSo(h.chuaCoKe);
    setDangXepLo(h.loHangId);
    try {
      await ghiSoKe(h.loHangId, Number(h.keGoiY.id), sl);
      // Đã xếp cả phần chưa có kệ: gỡ dòng ngay (không chờ tải lại), khỏi bấm lần hai vào dòng cũ
      q.setData((cu) => (Array.isArray(cu) ? cu.filter((x) => x.loHangId !== h.loHangId) : cu));
      toast.success("Đã xếp lên kệ", { description: `${soVN(sl)} sản phẩm lô ${h.maLo} → kệ ${h.keGoiY.ma}` });
    } catch (error) {
      toast.error(`Chưa xếp được lô ${h.maLo} vào kệ ${h.keGoiY.ma}`, {
        description: getApiErrorMessage(error, "Lỗi kết nối. Thử lại hoặc chọn kệ khác."),
      });
    } finally {
      setDangXepLo(null);
      // Thành công hay lỗi đều tải lại: lỗi thường vì số chưa có kệ / kệ vừa đổi ở máy khác
      q.reload();
    }
  };
  const thieu = loiTaiKe ? "Chưa tải được danh sách kệ" : !keId ? "Chọn kệ" : !soLuong ? "Nhập số lượng" : moHop && soLuong > docSo(moHop.chuaCoKe) ? `Tối đa ${soVN(moHop.chuaCoKe)}` : null;

  /** Nút thao tác của một lô: có kệ gợi ý thì xếp một chạm + "Kệ khác"; không có thì "Chọn kệ". */
  const thaoTac = (h) => {
    const dangXep = dangXepLo === h.loHangId;
    if (!h.keGoiY?.id) {
      return (
        <Button size="sm" variant="outline" onClick={() => moXep(h)} disabled={dangXepLo != null} className={NUT_VIEN}>
          <PackageOpen className="size-3.5" />
          Chọn kệ
        </Button>
      );
    }
    return (
      <span className="inline-flex items-center gap-3">
        {/* Màn cảm ứng: nút chữ giữ cỡ vẽ, vùng chạm 44px là lớp ::before trong suốt do lớp cảm ứng dùng chung (index.css) lo */}
        <NutChu onClick={() => moXep(h)} disabled={dangXepLo != null}>
          Kệ khác
        </NutChu>
        <Button
          size="sm"
          onClick={() => xepVaoGoiY(h)}
          disabled={dangXepLo != null}
          aria-busy={dangXep || undefined}
          title={`Xếp cả ${soVN(h.chuaCoKe)} sản phẩm chưa có kệ vào kệ ${h.keGoiY.ma}`}
          className="h-8 gap-1.5 text-[13px]"
        >
          {dangXep ? <Loader2 className="size-3.5 animate-spin" /> : <MapPinCheck className="size-3.5" />}
          {dangXep ? "Đang xếp…" : `Xếp vào ${h.keGoiY.ma}`}
        </Button>
      </span>
    );
  };

  const khongCoKho = !kho.dangTai && !kho.loi && !kho.dsKho.length;
  const veDot = dotVe ? () => navigate(`/stock-take/${dotVe}`) : null;

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader
        title="Hàng chưa có kệ"
        actions={
          <Button
            variant="outline"
            onClick={() => navigate("/stock-take")}
            className="h-9 gap-2 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle"
          >
            <ArrowLeft className="size-4" />
            Đợt kiểm kê
          </Button>
        }
      />

      {kho.loi ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <ErrorState
            title="Không tải được danh sách kho"
            description={`${getApiErrorMessage(kho.loi, "Lỗi kết nối")}. Thử lại sau giây lát.`}
            onRetry={kho.taiLai}
          />
        </div>
      ) : khongCoKho ? (
        <div className="rounded-lg border border-bo-border bg-bo-surface">
          <EmptyState
            icon={Warehouse}
            title={laQtv ? "Chưa có kho giao dịch nào" : "Bạn chưa được phân kho nào"}
            description={laQtv ? "Tạo kho trước rồi quay lại để xếp hàng lên kệ." : "Nhờ quản trị viên phân kho để xem hàng chưa có kệ."}
          />
        </div>
      ) : (
        <>
          {duLieu?.length ? (
            <DongThongBao
              tone="warn"
              actions={veDot ? <NutChu onClick={veDot}>Về đợt kiểm kê</NutChu> : undefined}
            >
              Kiểm kê toàn kho và theo danh mục cần mọi sản phẩm có kệ. Xếp các lô dưới đây lên kệ rồi bắt đầu lại đợt.{" "}
              <span className="text-bo-muted">Chỉ ghi sổ kệ, tồn kho không đổi.</span>
            </DongThongBao>
          ) : null}

          <TableShell
            fill
            toolbar={
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                {/* Tên kho chỉ nằm ở đây (một kho: chữ tĩnh), tiêu đề trang không ghi lại */}
                {kho.dsKho.length ? (
                  <ChonKhoKiemKe dsKho={kho.dsKho} value={kho.khoId} onChange={kho.doiKho} className="w-full sm:w-[240px]" />
                ) : null}
                <label className="relative flex min-w-[220px] max-w-sm flex-1 items-center">
                  <span className="sr-only">Tìm lô</span>
                  <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
                  <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm mã lô, SKU, tên sản phẩm" className={cn(O_NHAP, "pl-8")} />
                </label>
                {duLieu?.length ? (
                  <span className="text-[13px] text-bo-muted tabular-nums lg:ml-auto">
                    {soVN(duLieu.length)} lô · <b className="font-semibold text-bo-foreground">{soVN(tongChua)}</b> sản phẩm chưa có kệ
                  </span>
                ) : null}
              </div>
            }
          >
            {kho.dangTai || (q.loading && !q.dungKhoa) ? (
              <LoadingState rows={5} label="Đang tải hàng chưa có kệ" />
            ) : q.error && !duLieu ? (
              <ErrorState description={`Không tải được: ${getApiErrorMessage(q.error, "lỗi kết nối")}.`} onRetry={q.reload} />
            ) : !duLieu?.length ? (
              <EmptyState
                icon={CircleCheck}
                title="Mọi hàng trong kho đã có kệ"
                description={
                  veDot ? "Sổ kệ khớp tồn lô. Quay lại đợt kiểm kê để bắt đầu." : "Sổ kệ khớp tồn lô; có thể kiểm kê toàn kho hoặc theo danh mục."
                }
                action={
                  veDot ? (
                    <Button onClick={veDot} className="gap-2">
                      <ArrowLeft className="size-4" />
                      Về đợt kiểm kê
                    </Button>
                  ) : undefined
                }
              />
            ) : !ds.length ? (
              <EmptyState
                icon={Search}
                title={`Không có lô nào khớp “${tim.trim()}”`}
                description="Thử mã lô, SKU hoặc tên sản phẩm khác."
                action={
                  <Button variant="outline" onClick={() => setTim("")} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
                    Xóa tìm kiếm
                  </Button>
                }
              />
            ) : (
              <>
                {/* Điện thoại: mỗi lô một thẻ, nút xếp kệ trong tầm tay */}
                <ul className="divide-y divide-bo-border md:hidden">
                  {ds.map((h) => (
                    <li key={h.loHangId} className="grid gap-2 px-4 py-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <AnhBienThe src={h.sanPham?.anh} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
                          <span className="block truncate text-xs text-bo-muted">
                            <MauKichCo dong={h.sanPham} className="align-bottom" /> · lô <span className="font-mono">{h.maLo}</span>
                          </span>
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <span className="text-[13px] tabular-nums text-bo-muted">
                          <b className="font-semibold text-bo-warning">Chưa có kệ {soVN(h.chuaCoKe)}</b>
                          {docSo(h.trenKe) > 0 ? ` / tồn ${soVN(h.tonLo)}` : null}
                        </span>
                        <span className="ml-auto shrink-0">{thaoTac(h)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <table className="w-full min-w-[680px] text-sm max-md:hidden">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                      <th className={`${TH} text-left`}>Sản phẩm</th>
                      <th className={`${TH} text-left`}>Lô</th>
                      <th className={`${TH} text-right`}>Chưa có kệ</th>
                      <th className={`${TH} text-right`}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bo-border">
                    {ds.map((h) => (
                      <tr key={h.loHangId} className="hover:bg-bo-surface-subtle">
                        <td className="px-4 py-3">
                          <span className="flex min-w-0 items-center gap-3">
                            <AnhBienThe src={h.sanPham?.anh} />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-bo-foreground">{h.sanPham?.tenSanPham || "—"}</span>
                              <span className="block text-xs text-bo-muted">
                                <MauKichCo dong={h.sanPham} className="align-bottom" /> · <span className="font-mono">{h.sanPham?.maSku}</span>
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-slate-700">{h.maLo}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className="block font-semibold text-bo-warning">{soVN(h.chuaCoKe)}</span>
                          {/* Lô đã lên kệ một phần: ghi tồn lô để thấy phần còn thiếu là bao nhiêu trên tổng */}
                          {docSo(h.trenKe) > 0 ? (
                            <span className="block text-xs text-bo-muted" title={`Trên kệ ${soVN(h.trenKe)}`}>
                              / tồn {soVN(h.tonLo)}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{thaoTac(h)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </TableShell>
        </>
      )}

      <HopXacNhanChungTu
        mo={Boolean(moHop)}
        onDoiMo={(m) => !m && !dangChay && setMoHop(null)}
        tieuDe={moHop ? `Xếp lô ${moHop.maLo} lên kệ` : ""}
        moTa={moHop ? `${moHop.sanPham?.tenSanPham ?? ""} · còn ${soVN(moHop.chuaCoKe)} sản phẩm chưa có kệ. Chỉ ghi sổ kệ, tồn kho không đổi.` : undefined}
        nhanXacNhan="Xếp lên kệ"
        iconXacNhan={PackageOpen}
        dangChay={dangChay}
        khoaXacNhan={Boolean(thieu)}
        lyDoKhoa={thieu ?? undefined}
        loi={loi}
        onXacNhan={xep}
      >
        <div className="grid gap-1.5">
          <label htmlFor="xep-ke-chon" className={NHAN_O}>
            Kệ <span className="text-bo-danger">*</span>
          </label>
          {coOLocKe ? (
            <label className="relative flex items-center">
              <span className="sr-only">Lọc theo mã kệ</span>
              <Search className="pointer-events-none absolute left-2.5 size-4 text-bo-muted" aria-hidden="true" />
              <input value={timKe} onChange={(e) => setTimKe(e.target.value)} placeholder="Lọc theo mã kệ" className={cn(O_NHAP, "pl-8")} />
            </label>
          ) : null}
          <select id="xep-ke-chon" value={keId} onChange={(e) => setKeId(e.target.value)} className={O_NHAP} disabled={keDangTai || Boolean(loiTaiKe)}>
            <option value="">
              {keDangTai ? "Đang tải kệ…" : loiTaiKe ? "Chưa tải được danh sách kệ" : dsKeHien.length ? "Chọn kệ…" : timKe.trim() ? "Không có kệ khớp" : "Kho chưa có kệ chọn được"}
            </option>
            {dsKeHien.map((k) => (
              <option key={k.id} value={k.id}>
                {k.ma} · {k.khu}
                {k.sucChua ? ` · ${soVN(k.dangChua)}/${soVN(k.sucChua)}` : ""}
                {moHop?.keGoiY?.id === k.id ? " (lô đang ở kệ này)" : ""}
              </option>
            ))}
          </select>
          {loiTaiKe ? (
            <span role="alert" className="text-[13px] leading-5 text-bo-danger">
              Không tải được danh sách kệ: {getApiErrorMessage(loiTaiKe, "lỗi kết nối")}.{" "}
              <NutChu onClick={qKe.reload}>Thử lại</NutChu>
            </span>
          ) : (
            <span className={GOI_Y_O}>Kệ bảo trì và kệ đang khóa kiểm kê không chọn được</span>
          )}
        </div>
        <label className="grid gap-1.5">
          <span className={NHAN_O}>
            Số lượng <span className="text-bo-danger">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={soLuong == null ? "" : String(soLuong)}
            onChange={(e) => setSoLuong(docSoDem(e.target.value, 1_000_000) || null)}
            className={cn(O_NHAP, "max-w-[160px] tabular-nums")}
          />
        </label>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
