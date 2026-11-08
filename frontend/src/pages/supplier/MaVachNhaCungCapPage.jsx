import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScanBarcode, SearchX, Unlink } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import { VAI_TRO_KHO } from "@/components/backoffice/sidebar.config";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import FilterSelect from "@/components/shared/FilterSelect";
import ListPageHeader from "@/components/shared/ListPageHeader";
import ListToolbar from "@/components/shared/ListToolbar";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import { RowActionButton, RowActions } from "@/components/shared/RowActions";
import SearchInput from "@/components/shared/SearchInput";
import TablePagination from "@/components/shared/TablePagination";
import TableShell from "@/components/shared/TableShell";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/components/ui/confirm-modal";
import DongThongBao from "@/components/nhap-kho/DongThongBao";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { trangCuoiNeuVuot } from "@/lib/tinhTaiLai";
import { cn } from "@/lib/utils";
import { THONG_BAO_CHUA_HO_TRO_MA_VACH, maVachNhaCungCapService } from "@/services/maVachNhaCungCapService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { ganGiong, trongNhuMa } from "@/utils/maVach";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Gỡ liên kết gắn nhầm: quản trị viên và quản lý kho (người duyệt nhập hàng).
const QUYEN_GO_LIEN_KET = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO];
// Chờ người dùng ngừng gõ rồi mới tìm trên máy chủ
const CHO_GO_MS = 300;

// Số liên kết tối đa tải về để gợi ý mã gần giống khi tìm không thấy (chỉ tải khi từ khóa trông như mã)
const SO_LIEN_KET_GOI_Y = 1000;

const bienTheDayDu = (r) => [r.tenBienThe, r.mauSac, r.kichCo ? `Kích cỡ ${r.kichCo}` : null].filter(Boolean).join(" · ");

/**
 * Mã vạch nhà cung cấp (FO-095, PA1): tra mã vạch trên tem của nhà cung cấp ứng với biến thể nào của FCentric.
 * Liên kết chỉ được tạo ở màn kiểm đếm (đã chốt 19/10): quét mã chưa có trong hệ thống, quét lại để xác nhận
 * rồi chọn biến thể. Trang này để tra cứu và gỡ liên kết gắn nhầm. Tên cột trùng các trường của hộp liên kết.
 */
export default function MaVachNhaCungCapPage() {
  const hoTro = maVachNhaCungCapService.hoTro;
  const coTheGo = hasAnyRole(QUYEN_GO_LIEN_KET);
  // Chi tiết phiếu nhập chỉ mở được với vai trò kho (trang chặn như PhieuNhapKhoController): nhân viên mua hàng thấy
  // mã phiếu dạng chữ thường
  const xemPhieuNhap = hasAnyRole(VAI_TRO_KHO);

  const [tuKhoa, setTuKhoa] = useState("");
  const [tuKhoaTim, setTuKhoaTim] = useState("");
  const [nhaCungCapId, setNhaCungCapId] = useState("");
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const [canGo, setCanGo] = useState(null);
  const [dangGo, setDangGo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTuKhoaTim(tuKhoa.trim()), CHO_GO_MS);
    return () => clearTimeout(t);
  }, [tuKhoa]);

  const ncc = useTaiDuLieu(() => maVachNhaCungCapService.dsNhaCungCap(), "ncc", { enabled: hoTro });
  const ketQua = useTaiDuLieu(
    () => maVachNhaCungCapService.timKiem({ q: tuKhoaTim, nhaCungCapId: nhaCungCapId || undefined, page: trang, size: soDong }),
    `${tuKhoaTim}|${nhaCungCapId}|${trang}|${soDong}`,
    { enabled: hoTro },
  );
  // Quay lại tab thì tải lại ngầm (giữ bảng đang xem)
  useTaiLaiKhiQuayLai(ketQua.reload, { bat: hoTro && !ketQua.loading, lanCuoi: ketQua.capNhatLuc });
  // Trang đang xem vượt số trang thật (vd. vừa gỡ dòng cuối của trang cuối) → lùi về trang cuối còn dữ liệu
  useEffect(() => {
    if (ketQua.loading) return;
    const trangCuoi = trangCuoiNeuVuot({
      trang,
      kichThuoc: soDong,
      soDong: ketQua.data?.content?.length ?? 0,
      tong: ketQua.data?.totalElements,
    });
    if (trangCuoi != null) queueMicrotask(() => setTrang(trangCuoi));
  }, [ketQua.loading, ketQua.data, trang, soDong]);
  const dong = ketQua.data?.content ?? [];
  const tong = Number(ketQua.data?.totalElements ?? 0);
  const dangLoc = Boolean(tuKhoa.trim() || nhaCungCapId);

  // Tìm không thấy mà từ khóa trông như mã: gợi ý mã đã liên kết gần giống (máy quét đọc lệch / gõ nhầm 1–2 ký tự)
  const timMa = !ketQua.loading && !dong.length && trongNhuMa(tuKhoaTim);
  const tatCa = useTaiDuLieu(
    () => maVachNhaCungCapService.timKiem({ nhaCungCapId: nhaCungCapId || undefined, page: 0, size: SO_LIEN_KET_GOI_Y }),
    `goi-y|${nhaCungCapId}`,
    { enabled: hoTro && timMa },
  );
  const ganDung = timMa
    ? ganGiong(
        tuKhoaTim,
        (tatCa.data?.content ?? []).map((r) => ({ ma: r.maVach, nhan: `${r.tenNhaCungCap} · ${bienTheDayDu(r)}` })),
      )
    : [];

  const luaChonNcc = useMemo(
    () => [
      { value: "", label: "Tất cả nhà cung cấp" },
      ...(Array.isArray(ncc.data) ? ncc.data : []).map((n) => ({ value: String(n.id), label: n.tenNhaCungCap })),
    ],
    [ncc.data],
  );

  const xoaLoc = () => {
    setTuKhoa("");
    setTuKhoaTim("");
    setNhaCungCapId("");
    setTrang(0);
  };

  const goLienKet = async () => {
    if (!canGo) return;
    setDangGo(true);
    try {
      await maVachNhaCungCapService.huyLienKet(canGo.id);
      toast.success(`Đã gỡ liên kết mã ${canGo.maVach}`, { description: "Lần quét sau, mã được hỏi lại như mã chưa có trong hệ thống." });
      setCanGo(null);
      ketQua.reload();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không gỡ được liên kết."));
    } finally {
      setDangGo(false);
    }
  };

  if (!hoTro) {
    return (
      <PageContainer className="flex flex-col gap-4">
        <ListPageHeader />
        <DongThongBao>{THONG_BAO_CHUA_HO_TRO_MA_VACH}</DongThongBao>
      </PageContainer>
    );
  }

  let bang;
  // Đang lùi về trang cuối (trang vừa tải rỗng vì vượt số trang) thì hiện đang tải, không hiện ô trống
  if (ketQua.initialLoading || (ketQua.loading && !dong.length && trang > 0)) {
    bang = <LoadingState rows={6} label="Đang tải mã vạch nhà cung cấp" />;
  } else if (ketQua.error && !ketQua.data) {
    bang = (
      <ErrorState
        title="Không tải được mã vạch nhà cung cấp"
        description={getApiErrorMessage(ketQua.error, "Vui lòng thử lại.")}
        onRetry={ketQua.reload}
      />
    );
  } else if (!dong.length) {
    bang = dangLoc ? (
      <EmptyState
        icon={SearchX}
        // Từ khóa trông như mã có thể là SKU / mã hàng NCC (đã có trong hệ thống), hoặc mã liên kết ở nhà cung cấp
        // khác khi đang lọc: chỉ nói là chưa có liên kết khớp, không nói mã chưa có trong hệ thống
        title={timMa ? `Không có liên kết nào khớp ${tuKhoaTim}${nhaCungCapId ? " ở nhà cung cấp đang lọc" : ""}` : "Không có liên kết nào khớp"}
        description={
          timMa
            ? `Mã vạch nhà cung cấp được liên kết lúc kiểm đếm hàng nhập: quét mã chưa có trong hệ thống, quét lại để xác nhận rồi chọn biến thể.${nhaCungCapId ? " Bỏ lọc nhà cung cấp để tìm cả ở nhà cung cấp khác." : ""}`
            : "Thử tìm theo mã vạch, mã hàng NCC hoặc SKU khác, hoặc bỏ lọc nhà cung cấp."
        }
        action={
          <div className="flex w-full max-w-[560px] flex-col items-center gap-3">
            {ganDung.length ? (
              <div className="w-full overflow-hidden rounded-lg border border-orange-200 bg-bo-warning-soft/40 text-left">
                <p className="border-b border-orange-200 px-3 py-2 text-[13px] font-semibold text-orange-900">Gần giống mã đã liên kết</p>
                {ganDung.map((g) => (
                  <div key={g.ma} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-orange-100 px-3 py-2.5 first:border-t-0">
                    <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                      <span className="break-all font-mono text-sm font-semibold">
                        {g.kyTu.map((k, i) => (
                          <span key={i} className={k.lech ? "rounded-sm bg-orange-300 text-orange-950" : undefined}>{k.c}</span>
                        ))}
                      </span>
                      <span className="text-xs text-bo-muted">{g.nhan}</span>
                    </div>
                    <span className="whitespace-nowrap text-xs font-medium text-orange-800">lệch {g.lech} ký tự</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTuKhoa(g.ma);
                        setTuKhoaTim(g.ma);
                        setTrang(0);
                      }}
                      className="border-bo-border bg-bo-surface text-xs max-md:text-sm"
                    >
                      Xem mã này
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle">
              Xóa lọc
            </Button>
          </div>
        }
      />
    ) : (
      <EmptyState
        icon={ScanBarcode}
        title="Chưa có mã vạch nhà cung cấp nào"
        description="Khi kiểm đếm hàng nhập, quét phải mã chưa có trong hệ thống và xác nhận đó là mã vạch của nhà cung cấp, mã được liên kết với biến thể FCentric và hiện ở đây."
      />
    );
  } else {
    bang = (
      <>
      {/* Điện thoại: mỗi liên kết một thẻ — mã vạch NCC, biến thể FCentric (màu · cỡ · SKU), nhà cung cấp · mã hàng NCC,
          lúc liên kết · người liên kết; chân thẻ: phiếu nhập đã liên kết (chạm mở phiếu) và Gỡ liên kết (người có quyền) */}
      <ul className="divide-y divide-bo-border md:hidden">
        {dong.map((r) => {
          const coChan = Boolean(r.phieuNhapKhoId || r.soPhieuNhap) || coTheGo;
          return (
            <li key={r.id} className={cn("grid grid-cols-1 gap-1 px-4 pt-3", coChan ? "pb-1" : "pb-3")}>
              <span className="break-all font-mono text-[15px] font-semibold text-bo-heading">{r.maVach}</span>
              <span className="text-sm">
                <span className="font-medium text-bo-heading">{r.tenBienThe}</span>
                <span className="block text-[13px] text-bo-muted">
                  {[r.mauSac, r.kichCo ? `Kích cỡ ${r.kichCo}` : null].filter(Boolean).join(" · ")}
                  {r.mauSac || r.kichCo ? " · " : ""}
                  <span className="font-mono">{r.sku}</span>
                </span>
              </span>
              <span className="flex min-w-0 items-baseline gap-2 text-[13px]">
                <span className="min-w-0 truncate text-bo-foreground">{r.tenNhaCungCap || "—"}</span>
                {r.maHangNcc ? <span className="shrink-0 font-mono text-slate-600">{r.maHangNcc}</span> : null}
              </span>
              <span className="text-xs tabular-nums text-bo-muted">
                {[r.ngayLienKet ? `Liên kết ${formatDate(r.ngayLienKet)}` : null, r.tenNguoiLienKet].filter(Boolean).join(" · ") || "—"}
              </span>
              {coChan ? (
                <span className="flex min-h-9 items-center justify-between gap-3">
                  {r.phieuNhapKhoId && xemPhieuNhap ? (
                    <Link
                      to={`/goods-receipts/${r.phieuNhapKhoId}`}
                      aria-label={`Mở phiếu nhập ${r.soPhieuNhap ?? `#${r.phieuNhapKhoId}`}`}
                      className="inline-flex h-9 min-w-0 items-center gap-1 text-[13px]"
                    >
                      <span className="shrink-0 text-bo-muted">Từ phiếu</span>
                      <span className="truncate font-mono font-medium text-bo-primary">{r.soPhieuNhap ?? `#${r.phieuNhapKhoId}`}</span>
                    </Link>
                  ) : r.soPhieuNhap ? (
                    <span className="min-w-0 truncate text-[13px] text-bo-muted">
                      Từ phiếu <span className="font-mono text-slate-600">{r.soPhieuNhap}</span>
                    </span>
                  ) : <span />}
                  {coTheGo ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCanGo(r)}
                      className="h-9 shrink-0 gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-danger"
                    >
                      <Unlink className="size-4" aria-hidden="true" />
                      Gỡ liên kết
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {/* Máy tính bảng dọc (cảm ứng): bỏ cột Mã hàng NCC, Nhà cung cấp (thành dòng phụ dưới mã vạch) và Thao tác —
          Gỡ liên kết chuyển xuống dưới ô Liên kết từ, cao 44px — để bảng vừa khung, không vuốt ngang */}
      <table className="w-full min-w-[1000px] text-sm max-md:hidden cam-ung:max-lg:min-w-0">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-bo-border bg-bo-surface-subtle">
            {[
              ["Mã vạch NCC", ""],
              ["Mã hàng NCC", "cam-ung:max-lg:hidden"],
              ["Nhà cung cấp", "cam-ung:max-lg:hidden"],
              ["Biến thể FCentric", ""],
              ["Liên kết từ", "w-[220px] cam-ung:max-lg:w-auto"],
              ...(coTheGo ? [["Thao tác", "w-[88px] text-center cam-ung:max-lg:hidden"]] : []),
            ].map(([h, c]) => (
              <th key={h} className={cn("h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted", c)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-bo-border">
          {dong.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-bo-surface-subtle">
              <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] font-semibold text-bo-heading">
                {r.maVach}
                {r.maHangNcc ? <div className="hidden text-xs font-normal text-slate-600 cam-ung:max-lg:block">{r.maHangNcc}</div> : null}
                <div className="mt-0.5 hidden whitespace-normal font-backoffice text-xs font-normal text-bo-foreground cam-ung:max-lg:block">{r.tenNhaCungCap || "—"}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-slate-600 cam-ung:max-lg:hidden">{r.maHangNcc || "—"}</td>
              <td className="px-3 py-3 text-bo-foreground cam-ung:max-lg:hidden">{r.tenNhaCungCap || "—"}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-bo-heading">{r.tenBienThe}</div>
                <div className="text-xs text-bo-muted">
                  {[r.mauSac, r.kichCo ? `Kích cỡ ${r.kichCo}` : null].filter(Boolean).join(" · ")}
                  {r.mauSac || r.kichCo ? " · " : ""}
                  <span className="font-mono">{r.sku}</span>
                </div>
              </td>
              <td className="px-3 py-3">
                {r.phieuNhapKhoId && xemPhieuNhap ? (
                  <Link to={`/goods-receipts/${r.phieuNhapKhoId}`} className="font-mono text-[13px] font-medium text-bo-primary hover:underline">
                    {r.soPhieuNhap ?? `#${r.phieuNhapKhoId}`}
                  </Link>
                ) : r.soPhieuNhap ? (
                  <span className="font-mono text-[13px] text-slate-600">{r.soPhieuNhap}</span>
                ) : (
                  <span className="text-bo-muted">—</span>
                )}
                <div className="text-xs tabular-nums text-bo-muted">
                  {[r.ngayLienKet ? formatDate(r.ngayLienKet) : null, r.tenNguoiLienKet].filter(Boolean).join(" · ") || "—"}
                </div>
                {coTheGo ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCanGo(r)}
                    className="mt-1.5 hidden h-9 w-fit gap-1.5 border-bo-input-border bg-bo-surface px-3 text-sm font-medium text-bo-danger cam-ung:max-lg:flex"
                  >
                    <Unlink className="size-4" aria-hidden="true" />
                    Gỡ liên kết
                  </Button>
                ) : null}
              </td>
              {coTheGo ? (
                <td className="px-3 py-3 cam-ung:max-lg:hidden">
                  <RowActions>
                    <RowActionButton icon={Unlink} label="Gỡ liên kết" tone="danger" onClick={() => setCanGo(r)} />
                  </RowActions>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      </>
    );
  }

  return (
    <PageContainer fill className="space-y-4">
      <ListPageHeader />
      <MockModeNotice show={maVachNhaCungCapService.mau} reason="máy chủ chưa có API mã vạch nhà cung cấp" />
      <TableShell
        fill
        toolbar={
          <ListToolbar hasFilter={dangLoc} onClear={xoaLoc}>
            <SearchInput
              label="Tìm mã vạch nhà cung cấp"
              placeholder="Quét hoặc nhập mã vạch, mã hàng, SKU, tên, màu"
              value={tuKhoa}
              onChange={(e) => {
                setTuKhoa(e.target.value);
                setTrang(0);
              }}
              onClear={() => {
                setTuKhoa("");
                setTrang(0);
              }}
              className="sm:w-[380px]"
            />
            <FilterSelect
              label="Lọc theo nhà cung cấp"
              value={nhaCungCapId}
              options={luaChonNcc}
              onChange={(v) => {
                setNhaCungCapId(v);
                setTrang(0);
              }}
              className="sm:w-[240px]"
            />
          </ListToolbar>
        }
        footer={
          dong.length ? (
            <TablePagination
              page={trang}
              size={soDong}
              total={tong}
              onPageChange={(p) => p >= 0 && p * soDong < tong && setTrang(p)}
              onSizeChange={(s) => {
                setSoDong(s);
                setTrang(0);
              }}
            />
          ) : null
        }
      >
        {bang}
      </TableShell>

      <ConfirmModal
        isOpen={Boolean(canGo)}
        onClose={() => !dangGo && setCanGo(null)}
        onConfirm={goLienKet}
        title="Gỡ liên kết mã vạch?"
        description={
          canGo
            ? `Mã ${canGo.maVach} của ${canGo.tenNhaCungCap} sẽ không còn tự nhận là ${bienTheDayDu(canGo)}. Lần quét sau, mã được hỏi lại như mã chưa có trong hệ thống.`
            : ""
        }
        confirmText="Gỡ liên kết"
        cancelText="Không gỡ"
        isLoading={dangGo}
      />
    </PageContainer>
  );
}
