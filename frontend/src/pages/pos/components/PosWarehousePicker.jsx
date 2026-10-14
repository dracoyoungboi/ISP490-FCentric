import { useEffect, useId, useRef, useState } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Hai dòng chữ "Kho bán hàng" / tên kho, không ô biểu tượng (chốt kiểu C: gọn ~140px, cao 36px). */
function WarehouseLabel({ name, hidden = false }) {
  return (
    <span aria-hidden={hidden || undefined} className="min-w-0 text-left">
      <span className="hidden text-[10px] leading-3 text-bo-muted sm:block">Kho bán hàng</span>
      <span className="block max-w-[9rem] truncate text-[13px] font-semibold leading-4 text-bo-foreground sm:max-w-[16rem]">{name}</span>
    </span>
  );
}

/**
 * Ô chọn kho của hóa đơn đang mở (chốt PA2, thu gọn kiểu C): hai dòng chữ, không viền, mở danh sách
 * nền trắng như menu tài khoản (lớp backoffice-user-menu để CSS menu cũ tông vàng không áp vào).
 * - Chỉ có 1 Kho bán hàng bán được (kể cả quản trị viên khi hệ thống chỉ có 1 Kho bán hàng): hiện chữ cố định.
 * - disabled (đang thanh toán / hóa đơn chờ thanh toán): vẫn hiện kho, vẫn nhận con trỏ để đọc lý do,
 *   bấm không mở danh sách mà gọi onBlockedOpen (trang hiện thông báo lý do).
 * - blocked (đang mở hộp thoại khác): đóng danh sách nếu đang mở và không cho mở, để không chọn kho
 *   đè lên hộp thoại (vd. biên lai hiện ra khi chuyển khoản về trong lúc đang mở danh sách).
 * Nghiệp vụ đổi kho (hỏi lại khi giỏ có hàng, xóa giỏ hóa đơn đó) do onChange ở PosSalesPage xử lý.
 * onPicked: sau khi chọn một kho và danh sách đã đóng, trang tự đưa con trỏ đi (ô tìm kiếm, hoặc nút trong
 * hộp hỏi lại) thay vì trả về nút kho — tránh con trỏ nằm sau hộp thoại. Đóng bằng Esc / bấm ra ngoài thì
 * vẫn trả con trỏ về nút kho như menu thông thường.
 */
export default function PosWarehousePicker({
  warehouses,
  value,
  onChange,
  onPicked,
  onBlockedOpen,
  disabled = false,
  disabledReason = '',
  blocked = false,
}) {
  const [open, setOpen] = useState(false);
  // Bị khóa / có hộp thoại khi đang mở: đóng hẳn (không tự mở lại khi hộp thoại đóng).
  if (open && (blocked || disabled)) setOpen(false);
  const pickedRef = useRef(false);
  const blockedRef = useRef(blocked);
  const titleId = useId();
  const noteId = useId();
  useEffect(() => {
    blockedRef.current = blocked || disabled;
  });

  const current = warehouses.find((warehouse) => warehouse.id === value) || null;
  const name = current?.tenKho || (warehouses.length ? 'Chọn kho' : 'Chưa có kho');
  const fullName = current ? `${current.tenKho} (${current.maKho})` : name;

  if (warehouses.length <= 1) {
    return (
      <div className="flex h-9 min-w-0 items-center px-2 xl:shrink-0" data-pos-warehouse="" title={`Kho bán hàng: ${fullName}`}>
        <WarehouseLabel hidden name={name} />
        <span className="sr-only">Kho bán hàng: {fullName}</span>
      </div>
    );
  }

  const label = disabled && disabledReason
    ? `Kho bán hàng: ${fullName}. ${disabledReason}`
    : `Kho bán hàng: ${fullName} — bấm để đổi kho`;
  const isOpen = open && !disabled && !blocked;

  const handleOpenChange = (next) => {
    if (next && disabled) {
      onBlockedOpen?.();
      return;
    }
    setOpen(next && !blocked);
  };

  return (
    <DropdownMenu modal={false} onOpenChange={handleOpenChange} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-disabled={disabled || undefined}
          aria-label={label}
          className="group flex h-9 min-w-0 items-center gap-1 rounded-lg pl-2 pr-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-bo-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent data-[state=open]:bg-slate-100 xl:shrink-0"
          data-pos-warehouse=""
          title={label}
          type="button"
        >
          <WarehouseLabel name={name} />
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-bo-muted transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-describedby={noteId}
        aria-labelledby={titleId}
        className="backoffice-user-menu z-[90] w-[300px] max-w-[calc(100vw-24px)] rounded-lg border border-bo-border bg-white p-1 text-bo-foreground shadow-lg"
        onCloseAutoFocus={(event) => {
          if (pickedRef.current && onPicked) {
            event.preventDefault();
            onPicked();
          } else if (blockedRef.current) {
            // Đóng vì hộp thoại khác mở ra: con trỏ thuộc về hộp thoại, không kéo về nút kho phía sau.
            event.preventDefault();
          }
          pickedRef.current = false;
        }}
        sideOffset={6}
      >
        <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-semibold leading-4 text-bo-muted" id={titleId}>Kho bán hàng</p>
        <DropdownMenuPrimitive.RadioGroup onValueChange={(next) => { pickedRef.current = true; onChange(Number(next)); }} value={value != null ? String(value) : ''}>
          {warehouses.map((warehouse) => (
            <DropdownMenuPrimitive.RadioItem
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-slate-700 outline-none select-none focus:bg-slate-100 data-[highlighted]:bg-slate-100 data-[state=checked]:font-semibold data-[state=checked]:text-[#0b4fae]"
              data-pos-warehouse-option={warehouse.maKho}
              key={warehouse.id}
              value={String(warehouse.id)}
            >
              <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center text-bo-primary">
                <DropdownMenuPrimitive.ItemIndicator><Check size={16} /></DropdownMenuPrimitive.ItemIndicator>
              </span>
              <span className="min-w-0">
                <span className="block truncate leading-[18px]">{warehouse.tenKho}</span>
                <span className="block text-[11px] font-normal leading-[14px] text-bo-muted">{warehouse.maKho}</span>
              </span>
            </DropdownMenuPrimitive.RadioItem>
          ))}
        </DropdownMenuPrimitive.RadioGroup>
        <DropdownMenuSeparator className="bg-bo-border" />
        <p className="flex items-start gap-2 px-2.5 py-2 text-xs leading-4 text-bo-muted" id={noteId}>
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>Mỗi hóa đơn bán từ một kho. Nếu hóa đơn đã có hàng, hệ thống sẽ hỏi lại trước khi đổi kho vì giỏ sẽ bị xóa.</span>
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
