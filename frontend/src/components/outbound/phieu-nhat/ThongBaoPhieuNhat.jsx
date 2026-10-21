import { Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { formatQuantity } from "@/constants/outbound";

const NUT_VIEN = "h-8 border-bo-border bg-white px-3 text-[13px] font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const NUT_CHINH = "h-8 gap-1.5 bg-bo-primary px-3 text-[13px] font-semibold text-white hover:bg-bo-primary-hover";

/**
 * Các dòng thông báo của màn Thực hiện nhặt hàng (đặt trong vùng `thongBao` của KhungChungTu, dưới tiến trình):
 * cảnh báo hủy tức thời (WebSocket), đơn bị bỏ qua khi hoàn tất, phiếu chưa có người nhặt, đang giao người khác,
 * đã nhặt xong, đã hủy. Chữ của máy chủ có từ tiếng Anh ("Put-back", "Return-to-stock") nên câu ở đây tự viết lại
 * từ dữ liệu sự kiện. Trên điện thoại / khối hẹp, nút của dòng thông báo tự xuống hàng (chung-tu/DongThongBao).
 */

/**
 * Cảnh báo hủy nhận qua WebSocket (chỉ sống trong phiên), một dòng của gopCanhBaoHuy. `canhBao.loai`:
 * - "donNhat": đơn hủy khi đang nhặt (ORDER_CANCELLED_IN_PICK_LIST) — số cần nhặt tự giảm, kèm hàng cần để vào khay trả kệ;
 * - "donDongGoi": đơn hủy sau khi nhặt xong (ORDER_CANCELLED_IN_PACKING) — phiếu xuất nháp của đơn đã thu hồi;
 * - "caPhieu": mọi đơn đã hủy (PICK_LIST_CANCELLED) — câu của máy chủ (tiếng Việt) hiện nguyên văn.
 * `canhBao.soDonHang`: các số đơn đã nối, `canhBao.soDon`: số đơn (nhiều đơn thì "Các đơn …"). `traKe`: kết quả hangTraKe.
 */
export function CanhBaoHuy({ canhBao, traKe = [], onDaHieu }) {
  const nutDaHieu = (
    <Button type="button" variant="outline" size="sm" onClick={onDaHieu} className={NUT_VIEN}>
      Đã hiểu
    </Button>
  );

  if (canhBao.loai === "caPhieu") {
    return (
      <DongThongBao tone="bad" actions={nutDaHieu}>
        <b className="font-semibold">{canhBao.message || "Mọi đơn trong phiếu nhặt hàng đã hủy."}</b>
      </DongThongBao>
    );
  }

  const so = canhBao.soDonHang || "";
  const don = canhBao.soDon > 1 ? "các đơn" : "đơn";
  if (canhBao.loai === "donDongGoi") {
    return (
      <DongThongBao tone="warn" actions={nutDaHieu}>
        <b className="font-semibold">{canhBao.soDon > 1 ? "Các đơn" : "Đơn"} {so} đã hủy sau khi nhặt xong.</b> Phiếu xuất
        nháp của {don} đã thu hồi. Chuyển hàng của {don} vào thùng gom hàng trả kệ.
      </DongThongBao>
    );
  }

  return (
    <DongThongBao tone="warn" actions={nutDaHieu}>
      <b className="font-semibold">{canhBao.soDon > 1 ? "Các đơn" : "Đơn"} {so} đã hủy trên sàn.</b> Số cần nhặt đã tự giảm.
      {traKe.length ? (
        <>
          <div className="mt-1.5">Hàng cần để vào khay trả kệ:</div>
          <ul className="m-0 mt-1 grid list-none gap-0.5 p-0 text-slate-700">
            {traKe.map((k) => (
              <li key={k.khoa}>
                {k.ten}
                {k.bienThe ? ` · ${k.bienThe}` : ""}
                {k.sku ? (
                  <>
                    {" ("}
                    <span className="font-mono text-xs">{k.sku}</span>
                    {")"}
                  </>
                ) : null}
                : <b className="font-semibold tabular-nums">{formatQuantity(k.soLuong)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </DongThongBao>
  );
}

/**
 * Kết quả "Hoàn tất nhặt" (chỉ sống trong phiên): chỉ còn các đơn KHÔNG được tạo phiếu xuất — việc đóng gói các đơn
 * khác đã có ở thẻ đơn bên cột phải và dòng "Đã nhặt xong".
 */
export function KetQuaBoQua({ ketQua, onDaHieu }) {
  const { boQua, daTao } = ketQua;
  return (
    <DongThongBao
      tone="warn"
      actions={
        <Button type="button" variant="outline" size="sm" onClick={onDaHieu} className={NUT_VIEN}>
          Đã hiểu
        </Button>
      }
    >
      <b className="font-semibold">
        {daTao.length
          ? `Không tạo phiếu xuất cho ${boQua.length} đơn đã hủy hoặc đã xuất trước đó: ${boQua.join(", ")}.`
          : `Không tạo phiếu xuất kho nào vì mọi đơn đã hủy hoặc đã xuất trước đó: ${boQua.join(", ")}.`}
      </b>{" "}
      Hàng đã nhặt cho các đơn này cần trả về kệ.
    </DongThongBao>
  );
}

/**
 * Phiếu chưa có người nhặt. Nhân viên kho: "Nhận việc" một chạm (giao cho chính mình). Quản lý: "Nhận việc cho tôi"
 * một chạm và "Phân công" (mở hộp chọn người).
 */
export function DongChuaGiao({ laQuanLy, dangNhan, onNhanViec, onPhanCong, khoaNhan = false }) {
  return (
    <DongThongBao
      tone="warn"
      actions={
        laQuanLy ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={dangNhan || khoaNhan}
              aria-busy={dangNhan || undefined}
              onClick={onNhanViec}
              className={NUT_VIEN}
            >
              {dangNhan ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <UserCheck className="size-3.5" aria-hidden="true" />}
              Nhận việc cho tôi
            </Button>
            <Button type="button" size="sm" disabled={dangNhan} onClick={onPhanCong} className={NUT_CHINH}>
              Phân công
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={dangNhan || khoaNhan}
            aria-busy={dangNhan || undefined}
            onClick={onNhanViec}
            className={NUT_CHINH}
          >
            {dangNhan ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <UserCheck className="size-3.5" aria-hidden="true" />}
            Nhận việc
          </Button>
        )
      }
    >
      <b className="font-semibold">Phiếu chưa có người nhặt.</b>{" "}
      {laQuanLy ? "Phân công người nhặt, hoặc tự nhận việc để bắt đầu quét." : "Nhận việc để bắt đầu quét mã."}
    </DongThongBao>
  );
}

/** Phiếu đang giao người khác (tên ở cột phải). Quản lý có "Phân công lại". */
export function DongGiaoKhac({ laQuanLy, onPhanCong }) {
  return (
    <DongThongBao
      tone="neutral"
      actions={laQuanLy ? <NutChu onClick={onPhanCong}>Phân công lại</NutChu> : null}
    >
      Chỉ người được phân công mới quét được phiếu này.
    </DongThongBao>
  );
}

/**
 * Phiếu đã nhặt xong (hoặc dữ liệu cũ đã xuất). `xongHet`: mọi đơn còn hiệu lực đã xuất kho. `donHuy`: mã các đơn đã
 * hủy (nhắc không tạo phiếu xuất, khi chưa có dòng kết quả hoàn tất nói việc này). `coLienKet`: liên kết danh sách
 * phiếu xuất (chỉ phiếu "Đã nhặt").
 */
export function DongDaNhat({ xongHet, donHuy = [], dataCu = false, coLienKet = true, onMoDsXuat }) {
  let cau;
  if (dataCu) cau = "Phiếu nhặt hàng đã xuất kho.";
  else if (xongHet) cau = "Đã nhặt, đóng gói và xuất kho xong mọi đơn trong phiếu.";
  else cau = "Đã nhặt xong. Đóng gói từng đơn ở mục Đơn trong phiếu, sau đó xác nhận xuất kho ở phiếu xuất.";
  return (
    <DongThongBao
      tone="ok"
      actions={coLienKet ? <NutChu onClick={onMoDsXuat}>Mở danh sách phiếu xuất</NutChu> : null}
    >
      {cau}
      {donHuy.length ? ` ${donHuy.length > 1 ? "Các đơn" : "Đơn"} ${donHuy.join(", ")} đã hủy nên không tạo phiếu xuất.` : ""}
    </DongThongBao>
  );
}

/** Phiếu đã hủy (backend tự hủy khi mọi đơn trong phiếu đã hủy). */
export function DongDaHuy() {
  return <DongThongBao tone="neutral">Phiếu nhặt hàng đã hủy vì mọi đơn trong phiếu đã hủy.</DongThongBao>;
}
