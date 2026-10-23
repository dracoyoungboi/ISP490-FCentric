import { useId } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import NutDongBoNgay from "./NutDongBoNgay";

const NUT_BA_CHAM = "rounded-lg border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle max-sm:size-11";
const MUC_MENU = "cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";

/**
 * Cụm nút đầu trang của Sản phẩm và Đơn hàng gian hàng (PA1 chốt 19/10/2026): nút ⋯ cho các việc ít làm
 * của trang, rồi "Đồng bộ ngay" kèm bảng tiến độ. Một gian hàng chỉ có một lệnh đồng bộ tay, đẩy tồn và lấy đơn
 * đều nằm trong lệnh đó, nên không còn nút "Đẩy tồn ngay" / "Lấy đơn mới" riêng.
 *
 * - `thaoTac`: [{ ma, nhan, moTa, Icon, onChon }] — mục của menu ⋯ (mỗi mục một dòng giải thích ngắn).
 * - `viecPhu`: chữ trên nút đồng bộ khi một mục ⋯ đang chạy (vd. "Đang tải sản phẩm…").
 * - `khoaThaoTac`: lý do khóa các mục ⋯ vì trang chưa sẵn sàng hay đang làm việc khác (chuỗi), không khóa thì false.
 * - `lyDoKhoaDongBo`: lý do không cho bắt đầu "Đồng bộ ngay" (vd. ủy quyền đã hết hạn), chuyển cho NutDongBoNgay.
 * Mục ⋯ bị khóa thì menu ghi lý do (đọc được cả bằng trình đọc màn hình qua aria-describedby): đang đồng bộ thì vì
 * cùng gọi tới gian hàng, chồng nhau dễ chạm giới hạn của sàn.
 */
export default function ThaoTacDongBo({ tienDo, tenSan, onDen, thaoTac = [], viecPhu = null, khoaThaoTac = false, lyDoKhoaDongBo = null }) {
  const idLyDo = useId();
  const dangDongBo = tienDo.dangChay || tienDo.dangGui;
  const lyDoKhoa = dangDongBo
    ? `Đang đồng bộ với ${tenSan}, chờ đợt này xong rồi chạy.`
    : viecPhu
      ? `${viecPhu.replace(/…$/, "")}, chờ xong rồi chạy việc khác.`
      : khoaThaoTac || null;

  return (
    <div className="flex max-w-full items-center gap-2">
      {thaoTac.length ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" aria-label="Thao tác khác" title="Thao tác khác" className={NUT_BA_CHAM}>
              <Ellipsis className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            aria-describedby={lyDoKhoa ? idLyDo : undefined}
            className="z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-lg border border-bo-border bg-white p-1 shadow-lg"
          >
            {thaoTac.map(({ ma, nhan, moTa, Icon, onChon }) => (
              <DropdownMenuItem key={ma} disabled={Boolean(lyDoKhoa)} onSelect={onChon} className={MUC_MENU}>
                {Icon ? <Icon className="mt-0.5 size-4 text-slate-400" aria-hidden="true" /> : null}
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-bo-foreground">{nhan}</span>
                  {moTa ? <span className="text-xs leading-4 text-bo-muted">{moTa}</span> : null}
                </span>
              </DropdownMenuItem>
            ))}
            {/* Mục bị khóa thì không nhận tiêu điểm: lý do gắn vào menu bằng aria-describedby, ẩn khỏi cây truy cập để không đọc hai lần */}
            {lyDoKhoa ? (
              <div id={idLyDo} aria-hidden="true" className="px-2.5 pb-1.5 pt-1 text-xs leading-4 text-bo-warning">
                {lyDoKhoa}
              </div>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <NutDongBoNgay tienDo={tienDo} tenSan={tenSan} onDen={onDen} viecPhu={viecPhu} lyDoKhoa={lyDoKhoaDongBo} />
    </div>
  );
}
