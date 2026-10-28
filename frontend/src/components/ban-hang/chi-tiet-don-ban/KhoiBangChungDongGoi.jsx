import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { AnhThuNho, HopXemBangChung } from "@/components/outbound/dong-goi/XemBangChung";
import { dinhGio, dinhNgay, dongHo } from "@/components/outbound/dong-goi/dinhDangBangChung";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { TRANG_THAI_DON } from "@/constants/trangThaiXuatBan";
import { cn } from "@/lib/utils";
import { dongGoiService } from "@/services/dongGoiService";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatDate } from "@/utils/formatters";
import { TEN_NGAN_BANG_CHUNG, noiDungBangChung } from "./bangChungDon";

/**
 * Khối "Bằng chứng đóng gói" ở cột phải Chi tiết đơn bán: chỉ xem (không chụp, xóa, tải lại — máy chủ cũng chặn khi đơn
 * đã qua bước đóng gói). Ảnh thu nhỏ của từng tệp, bấm mở hộp xem lớn dùng chung với màn Đóng gói; ghi rõ ngày hết
 * hạn lưu, hoặc lý do không có tệp (đã tự xóa sau hạn lưu / đơn xuất trước khi có bước đóng gói). Quay lại tab thì
 * tải lại ngầm (bằng chứng có thể vừa được chụp ở màn khác).
 *
 * Nơi gọi chỉ gắn khối khi `coKhoiBangChung(...)` đúng. `donId`, `trangThai`: đơn đang mở (đơn Chờ đóng gói: người kho
 * đã có nút Đóng gói ở đầu trang, khối không thêm nút).
 */
export default function KhoiBangChungDongGoi({ donId, trangThai }) {
  const tai = useCallback(() => dongGoiService.layBangChung(donId), [donId]);
  // Khóa theo trạng thái: đơn đổi bước (vd. vừa đóng gói xong) thì tải lại cùng chi tiết đơn
  const q = useTaiDuLieu(tai, `bang-chung-don-${donId}-${trangThai}`, { enabled: donId != null });
  const [xem, setXem] = useState(null);
  // Hook giữ dữ liệu cũ khi đổi khóa: mở sang đơn khác thì không hiện bằng chứng của đơn trước
  const data = q.data && String(q.data.donBanHangId) === String(donId) ? q.data : undefined;
  // Người kho vừa chụp / quay ở màn Đóng gói hay Phiếu nhặt (trạng thái đơn chưa đổi): quay lại tab thì tải ngầm
  useTaiLaiKhiQuayLai(() => q.reload(), { bat: Boolean(data) && !q.loading && !xem, lanCuoi: q.capNhatLuc });

  // Đơn hủy chỉ hiện khối khi còn tệp: lúc đang tải / lỗi không vẽ gì (khỏi hiện rồi biến mất, khỏi báo lỗi cho khối ẩn)
  if (!data && Number(trangThai) === TRANG_THAI_DON.DA_HUY) return null;
  if (!data && q.loading) {
    return (
      <NhomThuocTinh nhan="Bằng chứng đóng gói">
        <span className="inline-flex items-center gap-2 text-[13px] text-bo-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải bằng chứng…
        </span>
      </NhomThuocTinh>
    );
  }
  if (!data) {
    return (
      <NhomThuocTinh nhan="Bằng chứng đóng gói">
        <DongThongBao tone="bad" actions={<NutChu onClick={q.reload}>Thử lại</NutChu>}>
          {/* Câu của máy chủ thường đã có dấu chấm cuối: bỏ đi để không thành ".." */}
          Không tải được bằng chứng: {getApiErrorMessage(q.error, "lỗi không xác định").replace(/[.!\s]+$/, "")}.
        </DongThongBao>
      </NhomThuocTinh>
    );
  }

  const nd = noiDungBangChung(data, trangThai);
  if (nd.kieu === "an") return null;
  // Một dòng chữ như các nhóm khác của cột phải; chỉ tô màu cảnh báo khi đơn còn Chờ đóng gói mà thiếu tệp
  const dong = nd.kieu === "co"
    ? nd.canChuY
      ? nd.thieu.length ? `Còn thiếu: ${nd.thieu.join(", ")}` : "Chưa đủ bằng chứng để hoàn tất đóng gói."
      : [nd.dem, nd.hanLuu ? `lưu đến ${formatDate(nd.hanLuu)}` : ""].filter(Boolean).join(" · ")
    : nd.kieu === "daXoa"
      ? `Tệp bằng chứng đã tự xóa sau hạn lưu (hết hạn ${formatDate(nd.ngay)}).`
      : nd.cau;

  return (
    <NhomThuocTinh nhan="Bằng chứng đóng gói">
      <div className="grid gap-2.5">
        <p className={cn("m-0 text-[13px] leading-5", nd.canChuY ? "font-medium text-bo-warning" : "text-bo-muted")}>{dong}</p>

        {nd.kieu === "co" ? (
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
            {nd.o.map((x) => {
              const bc = x.bangChung;
              const ten = TEN_NGAN_BANG_CHUNG[x.loai] ?? x.ten;
              const luc = bc.ngayTao ? `${dinhNgay(bc.ngayTao)} ${dinhGio(bc.ngayTao)}`.trim() : "";
              return (
                <li key={x.loai} className={cn("min-w-0", x.laVideo && "col-span-2")}>
                  <button
                    type="button"
                    onClick={() => setXem(x)}
                    aria-label={[`Xem ${ten}`, bc.tenNguoiTao, luc].filter(Boolean).join(", ")}
                    className="group grid w-full gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
                  >
                    <span className={cn("relative grid place-items-center overflow-hidden rounded-md border border-bo-border bg-bo-surface-subtle", x.laVideo ? "aspect-video" : "aspect-[4/3]")}>
                      <AnhThuNho bc={bc} laVideo={x.laVideo} ten={ten} />
                      {x.laVideo ? (
                        <>
                          <span className="absolute grid size-9 place-items-center rounded-full bg-black/55 text-white" aria-hidden="true">
                            <Play className="size-4 fill-current" />
                          </span>
                          {bc.thoiLuongGiay ? (
                            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
                              {dongHo(Number(bc.thoiLuongGiay))}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </span>
                    <span className="min-w-0 text-xs leading-4">
                      <span className="block font-medium text-bo-foreground group-hover:text-bo-primary">{ten}</span>
                      {bc.tenNguoiTao || luc ? (
                        <span className="block truncate text-bo-muted">{[bc.tenNguoiTao, luc].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <HopXemBangChung o={xem} onDong={() => setXem(null)} />
    </NhomThuocTinh>
  );
}
