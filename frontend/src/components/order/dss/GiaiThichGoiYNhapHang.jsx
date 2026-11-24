import NutGiaiThich from "@/components/shared/NutGiaiThich";
import { t } from "@/i18n";

/**
 * Nút "i" cạnh tiêu đề màn Gợi ý nhập hàng: giải thích số liệu đầu vào, các chỉ số, nhóm ABC và mức độ.
 * Nội dung bám đúng cách máy chủ tính (DssPolicyEngine, DssReplenishmentRepository, DssSyncJob):
 * sức bán lấy từ đơn bán trừ nháp và đã hủy; đang về là phần chưa nhận của đơn mua đang vận chuyển;
 * lead time là bình quân 10 lần nhập gần nhất; tồn chậm là không bán trong 30 ngày hoặc DOI trên 60 ngày;
 * tự tính lại lúc 02:00 hằng ngày. Đổi công thức ở máy chủ thì sửa lại các câu ở đây.
 */
const NHOM = [
  {
    tieuDe: t("Số liệu đầu vào"),
    dong: [
      [t("Bán/ngày"), t("Bình quân N ngày, trừ đơn nháp và đơn đã hủy.")],
      [t("Khả dụng"), t("Tồn bán được ngay, trừ hàng giữ cho đơn.")],
      [t("Đang về"), t("Phần chưa nhận của đơn mua đang vận chuyển.")],
      [t("Lead time"), t("Từ đặt đến nhập kho, bình quân 10 lần gần nhất.")],
    ],
  },
  {
    tieuDe: t("Chỉ số"),
    dong: [
      ["SS", t("Tồn an toàn, phòng bán vượt hoặc giao trễ.")],
      ["ROP", t("Điểm đặt lại: khả dụng chạm mức này là cần đặt.")],
      ["DOI", t("Số ngày tồn khả dụng còn đủ bán.")],
      ["Q", t("Lượng nên đặt, đã trừ khả dụng và hàng đang về.")],
    ],
  },
  {
    tieuDe: t("Nhóm ABC theo doanh thu"),
    dong: [
      [t("Nhóm A"), t("70% doanh thu, kịch bản Cao điểm.")],
      [t("Nhóm B"), t("20% kế tiếp, kịch bản Hoạt động chuẩn.")],
      [t("Nhóm C"), t("Phần còn lại, kịch bản Tiết kiệm vốn.")],
    ],
  },
  {
    tieuDe: t("Mức độ"),
    dong: [
      [t("Nhập gấp"), t("Tồn không đủ bán đến khi hàng về.")],
      [t("Tồn chậm"), t("Không bán 30 ngày, hoặc tồn trên 60 ngày bán.")],
    ],
  },
];

export default function GiaiThichGoiYNhapHang() {
  return (
    <NutGiaiThich
      label={t("Cách hệ thống tính gợi ý")}
      tieuDe={t("Gợi ý nhập hàng")}
      classNameHop="w-[28rem] max-h-[min(80vh,720px)] overflow-y-auto"
    >
      <p className="text-bo-muted">
        {t("Gợi ý khi nào cần đặt và đặt bao nhiêu cho từng mã, tính trên mọi kho đang hoạt động.")}
      </p>

      {NHOM.map((nhom) => (
        <section key={nhom.tieuDe} className="mt-2.5 border-t border-bo-border pt-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-bo-muted">{nhom.tieuDe}</h3>
          <dl className="mt-1.5 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1">
            {nhom.dong.map(([ten, nghia]) => (
              <div key={ten} className="contents">
                <dt className="font-medium text-bo-foreground">{ten}</dt>
                <dd className="text-bo-muted">{nghia}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="mt-2.5 border-t border-bo-border pt-2.5 text-xs text-bo-muted">
        {t("Tự tính lại lúc 02:00 hằng ngày. Đổi tham số chỉ xem trước; bấm Lưu & Tính lại ROP để áp dụng.")}
      </p>
    </NutGiaiThich>
  );
}
