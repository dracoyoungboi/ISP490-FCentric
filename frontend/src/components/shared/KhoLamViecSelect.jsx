import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Store, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMineKhoList } from "@/services/khoService";
import { laKhoGiaoDich, laKhoTong } from "@/utils/kho";
import { KHO_LAM_VIEC_EVENT, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Chữ trên ô theo vai trò: nhân viên và quản lý kho làm việc tại một kho nên gọi là "Nơi làm việc";
 * quản trị viên không thuộc kho nào, ô chỉ là chọn kho để xem.
 */
const CHU_NOI_LAM_VIEC = {
  nhan: "Nơi làm việc",
  goiY: "Trang này chỉ hiện chứng từ của nơi bạn đang làm việc",
  menu: "Đổi nơi làm việc. Các trang chỉ xem một kho sẽ hiện theo nơi này.",
};
const CHU_DANG_XEM_KHO = {
  nhan: "Đang xem kho",
  goiY: "Trang này chỉ hiện chứng từ của kho đang chọn",
  menu: "Chọn kho để xem. Các trang chỉ xem một kho sẽ hiện theo kho này.",
};

/**
 * Ô "Nơi làm việc" (kho làm việc) cho các trang chỉ xem một kho (Đơn chờ xuất, Phiếu nhặt hàng, Chuyển kho nội bộ).
 * - Luôn ghi rõ trang đang xem kho nào.
 * - Người có từ 2 kho giao dịch trở lên đổi được kho ngay tại đây; đổi kho là đổi kho làm việc của
 *   tài khoản trên trình duyệt này, giống chọn kho ở Báo cáo tồn kho.
 * - Danh sách lấy từ /kho/mine (quản trị viên: mọi kho), bỏ Kho Trung Chuyển và kho ngừng hoạt động.
 */
export default function KhoLamViecSelect({ onChange }) {
  const [dsKho, setDsKho] = useState([]);
  const [khoId, setKhoId] = useState(getKhoLamViecId);
  const khoIdRef = useRef(khoId);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Đổi kho ở nơi khác (ô Kho làm việc ở đáy sidebar, màn đóng gói…): cập nhật và tải lại trang đang xem
  useEffect(() => {
    const nghe = (event) => {
      const id = event.detail ?? null;
      if (id === khoIdRef.current) return;
      khoIdRef.current = id;
      setKhoId(id);
      onChangeRef.current?.(id);
    };
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);

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
  const chu = hasAnyRole([ROLES.QUAN_TRI_VIEN]) ? CHU_DANG_XEM_KHO : CHU_NOI_LAM_VIEC;

  const chonKho = (id) => {
    if (id === khoId) return;
    khoIdRef.current = id;
    setKhoId(id);
    setKhoLamViecId(id);
    onChange?.(id);
  };

  // Chưa tải xong danh sách: chưa hiện để tránh nhấp nháy tên kho
  if (dsKho.length === 0) return null;

  const noiDung = (
    <>
      {khoHienTai && !laKhoTong(khoHienTai) ? (
        <Store className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      ) : (
        <Warehouse className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
      )}
      <span className="shrink-0 text-bo-muted">{chu.nhan}:</span>
      <span className="truncate font-medium">{tenKho}</span>
    </>
  );

  // Chỉ một kho (hoặc kho hiện tại là kho duy nhất được chọn): chỉ hiện tên, không cho đổi
  if (dsKho.length === 1 && khoHienTai) {
    return (
      <div
        className="flex h-9 w-full items-center gap-2 rounded-md border border-bo-border bg-bo-surface-subtle px-3 text-sm text-bo-foreground sm:w-auto sm:max-w-[320px]"
        title={chu.goiY}
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
          aria-label={`${chu.nhan}: ${tenKho}. Bấm để đổi`}
          title={chu.goiY}
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
          {chu.menu}
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
