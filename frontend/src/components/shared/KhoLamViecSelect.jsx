import { useEffect, useState } from "react";
import { Check, ChevronDown, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMineKhoList } from "@/services/khoService";
import { laKhoGiaoDich } from "@/utils/kho";

const KHOA_KHO_LAM_VIEC = "selected_kho_id";

/** Kho làm việc hiện tại (localStorage `selected_kho_id`, apiClient gửi qua header `kho_id`). */
const docKhoLamViec = () =>
  Number(window.localStorage.getItem(KHOA_KHO_LAM_VIEC)) || null;

/**
 * Ô "Kho làm việc" cho các trang chỉ xem một kho (Đơn chờ xuất, Phiếu nhặt hàng, Chuyển kho nội bộ).
 * - Luôn ghi rõ trang đang xem kho nào.
 * - Người có từ 2 kho giao dịch trở lên đổi được kho ngay tại đây; đổi kho là đổi kho làm việc của
 *   tài khoản trên trình duyệt này, giống chọn kho ở Báo cáo tồn kho.
 * - Danh sách lấy từ /kho/mine (quản trị viên: mọi kho), bỏ Kho Trung Chuyển và kho ngừng hoạt động.
 */
export default function KhoLamViecSelect({ onChange }) {
  const [dsKho, setDsKho] = useState([]);
  const [khoId, setKhoId] = useState(docKhoLamViec);

  useEffect(() => {
    let huy = false;
    getMineKhoList()
      .then((ds) => {
        if (!huy) setDsKho((ds ?? []).filter(laKhoGiaoDich));
      })
      .catch(() => {
        if (!huy) setDsKho([]);
      });
    return () => {
      huy = true;
    };
  }, []);

  const khoHienTai = dsKho.find((kho) => kho.id === khoId);
  const tenKho = khoHienTai?.tenKho ?? "Chưa chọn kho";

  const chonKho = (id) => {
    if (id === khoId) return;
    window.localStorage.setItem(KHOA_KHO_LAM_VIEC, String(id));
    setKhoId(id);
    onChange?.(id);
  };

  // Chưa tải xong danh sách: chưa hiện để tránh nhấp nháy tên kho
  if (dsKho.length === 0) return null;

  const noiDung = (
    <>
      <Warehouse className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      <span className="shrink-0 text-bo-muted">Kho làm việc:</span>
      <span className="truncate font-medium">{tenKho}</span>
    </>
  );

  // Chỉ một kho (hoặc kho hiện tại là kho duy nhất được chọn): chỉ hiện tên, không cho đổi
  if (dsKho.length === 1 && khoHienTai) {
    return (
      <div
        className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 text-sm text-bo-foreground sm:w-auto sm:max-w-[320px]"
        title="Trang này chỉ hiện chứng từ của kho làm việc"
      >
        {noiDung}
      </div>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Kho làm việc: ${tenKho}. Bấm để đổi kho`}
          title="Trang này chỉ hiện chứng từ của kho làm việc"
          className="h-9 w-full justify-between gap-2 border-bo-border bg-white px-3 text-sm font-normal text-bo-foreground hover:bg-bo-surface-subtle sm:w-auto sm:max-w-[320px]"
        >
          <span className="flex min-w-0 items-center gap-2">{noiDung}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-50 w-[260px] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
      >
        <p className="px-2.5 pb-1 pt-1.5 text-xs text-bo-muted">
          Đổi kho làm việc. Các trang chỉ xem một kho sẽ hiện theo kho này.
        </p>
        {dsKho.map((kho) => (
          <DropdownMenuItem
            key={kho.id}
            onClick={() => chonKho(kho.id)}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900"
          >
            <span className="truncate">{kho.tenKho}</span>
            {kho.id === khoId ? <Check className="size-4 shrink-0 text-bo-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
