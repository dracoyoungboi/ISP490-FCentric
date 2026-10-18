import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScanBarcode, SearchX, Unlink } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
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
import { ROLES, hasAnyRole } from "@/utils/roles";

// Gỡ liên kết gắn nhầm: quản trị viên và quản lý kho (người duyệt nhập hàng).
const QUYEN_GO_LIEN_KET = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO];
// Chờ người dùng ngừng gõ rồi mới tìm trên máy chủ
const CHO_GO_MS = 300;

/**
 * Mã vạch nhà cung cấp (FO-095, PA1): tra mã vạch trên tem của nhà cung cấp ứng với biến thể nào của FCentric.
 * Liên kết được tạo ở màn kiểm đếm khi quét phải mã lạ; trang này để tra cứu và gỡ liên kết gắn nhầm.
 */
export default function MaVachNhaCungCapPage() {
  const hoTro = maVachNhaCungCapService.hoTro;
  const coTheGo = hasAnyRole(QUYEN_GO_LIEN_KET);

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
      toast.success(`Đã gỡ liên kết mã ${canGo.maVach}`, { description: "Lần quét sau, mã này sẽ được hỏi liên kết lại." });
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
        title="Không có liên kết nào khớp"
        description="Mã lạ sẽ được liên kết khi kho quét lúc nhập hàng."
        action={
          <Button variant="outline" onClick={xoaLoc} className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
            Xóa lọc
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ScanBarcode}
        title="Chưa có mã vạch nhà cung cấp nào"
        description="Khi kiểm đếm hàng nhập, quét phải mã lạ thì nhân viên kho liên kết mã đó với biến thể đang kiểm."
      />
    );
  } else {
    bang = (
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-bo-border bg-bo-surface-subtle">
            {[
              ["Mã vạch NCC", ""],
              ["Mã hàng NCC", ""],
              ["Nhà cung cấp", ""],
              ["Biến thể FCentric", ""],
              ["Liên kết ngày", "w-[132px]"],
              ["Từ phiếu nhập", "w-[156px]"],
              ...(coTheGo ? [["Thao tác", "w-[88px] text-center"]] : []),
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
              <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] font-semibold text-bo-heading">{r.maVach}</td>
              <td className="whitespace-nowrap px-3 py-3 font-mono text-[13px] text-slate-600">{r.maHangNcc || "—"}</td>
              <td className="px-3 py-3 text-bo-foreground">{r.tenNhaCungCap || "—"}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-bo-heading">{r.tenBienThe}</div>
                <div className="font-mono text-xs text-bo-muted">{r.sku}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-slate-600">{r.ngayLienKet ? formatDate(r.ngayLienKet) : "—"}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {r.phieuNhapKhoId ? (
                  <Link to={`/goods-receipts/${r.phieuNhapKhoId}`} className="font-mono text-[13px] font-medium text-bo-primary hover:underline">
                    {r.soPhieuNhap ?? `#${r.phieuNhapKhoId}`}
                  </Link>
                ) : r.soPhieuNhap ? (
                  <span className="font-mono text-[13px] text-slate-600">{r.soPhieuNhap}</span>
                ) : (
                  <span className="text-bo-muted">—</span>
                )}
              </td>
              {coTheGo ? (
                <td className="px-3 py-3">
                  <RowActions>
                    <RowActionButton icon={Unlink} label="Gỡ liên kết" tone="danger" onClick={() => setCanGo(r)} />
                  </RowActions>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
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
              placeholder="Quét hoặc nhập mã vạch, mã hàng, SKU"
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
            ? `Mã ${canGo.maVach} sẽ không còn tự nhận ra là ${canGo.tenBienThe}. Lần quét sau, nhân viên kho được hỏi liên kết lại.`
            : ""
        }
        confirmText="Gỡ liên kết"
        cancelText="Không gỡ"
        isLoading={dangGo}
      />
    </PageContainer>
  );
}
