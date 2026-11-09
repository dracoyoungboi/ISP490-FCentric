import { Loader2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { formatQuantity } from "@/constants/outbound";
import { dongDaNhatChuyenKho } from "./tinhPhieuNhat";
import { t } from "@/i18n";

const NUT_VIEN = "h-8 border-bo-border bg-white px-3 text-[13px] font-medium text-bo-foreground shadow-none hover:bg-bo-surface-subtle";
const NUT_CHINH = "h-8 gap-1.5 bg-bo-primary px-3 text-[13px] font-semibold text-white hover:bg-bo-primary-hover";

/**
 * Các dòng thông báo của màn Thực hiện nhặt hàng (đặt trong vùng `thongBao` của KhungChungTu, dưới tiến trình):
 * cảnh báo hủy tức thời (WebSocket), đơn bị bỏ qua khi hoàn tất, phiếu chưa có người nhặt, đang giao người khác,
 * người được giao không còn nhặt được, đã nhặt xong, đã hủy. Chữ của máy chủ có từ tiếng Anh ("Put-back", "Return-to-stock") nên câu ở đây tự viết lại
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
      {t("Đã hiểu")}
    </Button>
  );

  if (canhBao.loai === "caPhieu") {
    return (
      <DongThongBao tone="bad" actions={nutDaHieu}>
        <b className="font-semibold">{canhBao.message || t("Mọi đơn trong phiếu nhặt hàng đã hủy.")}</b>
      </DongThongBao>
    );
  }

  const so = canhBao.soDonHang || "";
  const nhieu = canhBao.soDon > 1;
  if (canhBao.loai === "donDongGoi") {
    return (
      <DongThongBao tone="warn" actions={nutDaHieu}>
        <b className="font-semibold">
          {nhieu ? t("Các đơn {{so}} đã hủy sau khi nhặt xong.", { so }) : t("Đơn {{so}} đã hủy sau khi nhặt xong.", { so })}
        </b>{" "}
        {nhieu
          ? t("Phiếu xuất nháp của các đơn đã thu hồi. Chuyển hàng của các đơn vào thùng gom hàng trả kệ.")
          : t("Phiếu xuất nháp của đơn đã thu hồi. Chuyển hàng của đơn vào thùng gom hàng trả kệ.")}
      </DongThongBao>
    );
  }

  return (
    <DongThongBao tone="warn" actions={nutDaHieu}>
      <b className="font-semibold">{nhieu ? t("Các đơn {{so}} đã hủy trên sàn.", { so }) : t("Đơn {{so}} đã hủy trên sàn.", { so })}</b>{" "}
      {t("Số cần nhặt đã tự giảm.")}
      {traKe.length ? (
        <>
          <div className="mt-1.5">{t("Hàng cần để vào khay trả kệ:")}</div>
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
          {t("Đã hiểu")}
        </Button>
      }
    >
      <b className="font-semibold">
        {daTao.length
          ? t("Không tạo phiếu xuất cho {{count}} đơn đã hủy hoặc đã xuất trước đó: {{ds}}.", { count: boQua.length, ds: boQua.join(", ") })
          : t("Không tạo phiếu xuất kho nào vì mọi đơn đã hủy hoặc đã xuất trước đó: {{ds}}.", { ds: boQua.join(", ") })}
      </b>{" "}
      {t("Hàng đã nhặt cho các đơn này cần trả về kệ.")}
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
              {t("Nhận việc cho tôi")}
            </Button>
            <Button type="button" size="sm" disabled={dangNhan} onClick={onPhanCong} className={NUT_CHINH}>
              {t("Phân công")}
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
            {t("Nhận việc")}
          </Button>
        )
      }
    >
      <b className="font-semibold">{t("Phiếu chưa có người nhặt.")}</b>{" "}
      {laQuanLy ? t("Phân công người nhặt, hoặc tự nhận việc để bắt đầu quét.") : t("Nhận việc để bắt đầu quét mã.")}
    </DongThongBao>
  );
}

/** Phiếu đang giao người khác (tên ở cột phải). Quản lý có "Phân công lại". */
export function DongGiaoKhac({ laQuanLy, onPhanCong }) {
  return (
    <DongThongBao
      tone="neutral"
      actions={laQuanLy ? <NutChu onClick={onPhanCong}>{t("Phân công lại")}</NutChu> : null}
    >
      {t("Chỉ người được phân công mới quét được phiếu này.")}
    </DongThongBao>
  );
}

/**
 * Người được giao không còn nhặt được phiếu (đổi kho, bị thu hồi phân quyền, không còn là nhân viên kho, tài khoản ngưng).
 * `canhBao`: câu backend gửi (DanhSachNhatHangDto.canhBaoNguoiNhat). Không tự gỡ người nhặt: quản lý phân công lại.
 */
export function DongNguoiNhatKhongHopLe({ canhBao, laQuanLy, onPhanCong }) {
  return (
    <DongThongBao
      tone="warn"
      actions={laQuanLy ? <NutChu onClick={onPhanCong}>{t("Phân công lại")}</NutChu> : null}
    >
      {canhBao}
      {laQuanLy ? "" : t(" Báo quản lý kho phân công lại.")}
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
  if (dataCu) cau = t("Phiếu nhặt hàng đã xuất kho.");
  else if (xongHet) cau = t("Đã nhặt, đóng gói và xuất kho xong mọi đơn trong phiếu.");
  else cau = t("Đã nhặt xong. Đóng gói từng đơn ở mục Đơn trong phiếu, sau đó xác nhận xuất kho ở phiếu xuất.");
  return (
    <DongThongBao
      tone="ok"
      actions={coLienKet ? <NutChu onClick={onMoDsXuat}>{t("Mở danh sách phiếu xuất")}</NutChu> : null}
    >
      {cau}
      {donHuy.length ? (donHuy.length > 1
        ? t(" Các đơn {{ds}} đã hủy nên không tạo phiếu xuất.", { ds: donHuy.join(", ") })
        : t(" Đơn {{ds}} đã hủy nên không tạo phiếu xuất.", { ds: donHuy.join(", ") })) : ""}
    </DongThongBao>
  );
}

/**
 * Phiếu nhặt chuyển kho đã nhặt xong (câu theo dongDaNhatChuyenKho): lô đã giữ cho phiếu xuất PX-CK, kho xuất bấm Xác
 * nhận xuất ở phiếu chuyển; phiếu chuyển đã xuất kho; hoặc phiếu chuyển đã hủy khi hàng đang đi. Có liên kết mở phiếu
 * chuyển.
 */
export function DongDaNhatChuyenKho({ phieu, onMoPhieuChuyen }) {
  const { tone, cau } = dongDaNhatChuyenKho(phieu);
  return (
    <DongThongBao tone={tone} actions={onMoPhieuChuyen ? <NutChu onClick={onMoPhieuChuyen}>{t("Mở phiếu chuyển")}</NutChu> : null}>
      {cau}
    </DongThongBao>
  );
}

/**
 * Phiếu đã hủy: phiếu bán — backend tự hủy khi mọi đơn trong phiếu đã hủy; phiếu chuyển kho (`chuyenKho`) — hủy theo
 * phiếu chuyển (`soPhieuChuyen`, thiếu số vẫn đúng câu), hàng đã nhặt có lệnh trả kệ (HOAN_KE_CHO_CAT) do máy chủ lập.
 */
export function DongDaHuy({ chuyenKho = false, soPhieuChuyen = null }) {
  return (
    <DongThongBao tone="neutral">
      {chuyenKho
        ? t("Phiếu nhặt hàng đã hủy vì phiếu chuyển{{soPhieuChuyen}} đã hủy. Hàng đã nhặt (nếu có) cất lại lên kệ.", { soPhieuChuyen: soPhieuChuyen ? ` ${soPhieuChuyen}` : "" })
        : t("Phiếu nhặt hàng đã hủy vì mọi đơn trong phiếu đã hủy.")}
    </DongThongBao>
  );
}
