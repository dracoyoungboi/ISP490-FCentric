import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReactToPrint } from "react-to-print";
import { toast } from "@/lib/thongBaoNhanh";
import PrintTemplateDocument from "@/components/print/PrintTemplateDocument";
import { getPageFooterText, getPaperPageCss, getPaperSheetClasses } from "@/components/print/paperStyles";
import { printTemplateConfigService } from "@/services/printTemplateConfigService";
import { companyProfileService } from "@/services/companyProfileService";
import { getApiErrorMessage } from "@/utils/apiError";
import { t } from "@/i18n";
// Quy tắc in chung của trang in (lặp tiêu đề bảng mỗi trang, không cắt khối chữ ký…): bản in tại chỗ chép theo
import "@/styles/print.css";

const PX_SANG_MM = 25.4 / 96;
// Dư 2mm cho sai số làm tròn giữa màn hình và bản in (như useThermalPageHeight)
const DU_MM = 2;
// Thư viện in có lúc không gọi lại (khung in không dựng được, stylesheet treo): sau chừng này thì mở khóa nút In.
// Lúc hộp in đang mở, trình duyệt dừng hẹn giờ của trang nên không nhả khóa giữa chừng.
const CHO_TOI_DA_MS = 20000;

function cauLoiTai(err) {
  const ma = err?.response?.status;
  if (ma === 401 || ma === 403) return t("Bạn không có quyền in phiếu này.");
  if (ma === 404 || err?.khongThay) return t("Không tìm thấy phiếu để in. Phiếu có thể đã bị xóa.");
  return getApiErrorMessage(err, t("Không tải được bản in. Kiểm tra mạng rồi bấm In lại."));
}

/**
 * In chứng từ ngay trên màn đang làm, không mở trang in hay thẻ mới (như phần mềm bán hàng tại quầy): tải dữ liệu
 * phiếu + mẫu in đang dùng + thông tin cửa hàng, dựng tờ in ngoài màn hình rồi bật hộp in của trình duyệt. Bản in giống
 * hệt trang in (/…/print) vì dùng chung nguồn (nguonIn.js) và PrintTemplateDocument.
 *
 * Trả { inPhieu(nguon, id), dangIn, khungIn }: đặt `khungIn` vào cây của màn (tờ in vẽ qua portal ra body). Lỗi tải
 * dữ liệu báo bằng thông báo nhanh, màn giữ nguyên để bấm In lại.
 */
export default function useInTaiCho() {
  const [ban, setBan] = useState(null); // { nguon, model, config, company, giay, buoc: "dung" | "in" | "dang-in", cssTrang }
  const [dangTai, setDangTai] = useState(false);
  const giayRef = useRef(null);
  const dangChay = useRef(false);
  const conGan = useRef(true);

  useEffect(() => {
    conGan.current = true;
    return () => {
      conGan.current = false;
    };
  }, []);

  const xong = useCallback(() => {
    dangChay.current = false;
    if (conGan.current) setBan(null);
  }, []);

  const inNgay = useReactToPrint({
    contentRef: giayRef,
    // i18n-giu-nguyen: tiêu đề bản in = tên tệp khi chọn Lưu dưới dạng PDF, theo số chứng từ
    documentTitle: ban?.model?.documentNumber ? `Phiếu ${ban.model.documentNumber}` : "Phiếu in",
    // Khổ giấy KHÔNG truyền qua pageStyle: thư viện chèn pageStyle vào head TRƯỚC các stylesheet chép từ trang, nên
    // @page A4 mặc định của print.css sẽ đè khổ của mẫu (A5, K80…). Khổ nằm trong <style> ngay trong tờ in (body), sau
    // mọi stylesheet, như PrintLayout của trang in.
    pageStyle: "",
    // Gọi cả khi người dùng bấm Hủy trong hộp in
    onAfterPrint: xong,
    onPrintError: () => {
      xong();
      toast.error(t("Không mở được hộp in. Bấm In lại."));
    },
  });

  const inPhieu = useCallback(
    async (nguon, id) => {
      if (dangChay.current || !nguon || id == null) return;
      dangChay.current = true;
      setDangTai(true);
      try {
        const [data, config, company] = await Promise.all([
          nguon.fetcher(id),
          printTemplateConfigService.getActiveTemplate(nguon.documentType),
          companyProfileService.get(),
        ]);
        if (data == null) throw Object.assign(new Error("not found"), { khongThay: true });
        const loiDuLieu = nguon.getDataError?.(data) ?? null;
        if (loiDuLieu) {
          toast.error(loiDuLieu.title, { description: loiDuLieu.description });
          xong();
          return;
        }
        if (!config) {
          toast.error(t("Loại chứng từ này chưa có mẫu in được cấu hình."));
          xong();
          return;
        }
        // Như trang in: không in khi chưa có thông tin cửa hàng (đầu phiếu sẽ trống)
        if (!company) {
          toast.error(t("Không thể tải hồ sơ công ty"));
          xong();
          return;
        }
        if (!conGan.current) return;
        setBan({
          nguon,
          model: nguon.adapter(data),
          config,
          company,
          giay: { size: config.paperSize, orientation: config.orientation, margin: config.margin },
          buoc: "dung",
        });
      } catch (err) {
        toast.error(cauLoiTai(err));
        xong();
      } finally {
        if (conGan.current) setDangTai(false);
      }
    },
    [xong],
  );

  // Tờ in đã dựng ngoài màn hình: đo chiều cao (giấy cuộn K80 / K57 cao đúng bằng phiếu) rồi mới mở hộp in
  useLayoutEffect(() => {
    if (ban?.buoc !== "dung") return;
    // Màn không đặt khungIn (đang ở nhánh tải / lỗi): bỏ lần in, mở khóa nút In thay vì kẹt "Đang chuẩn bị bản in…"
    if (!giayRef.current) {
      xong();
      toast.error(t("Không mở được hộp in. Bấm In lại."));
      return;
    }
    const caoMm = Math.ceil(giayRef.current.offsetHeight * PX_SANG_MM + DU_MM);
    const cssTrang = getPaperPageCss(ban.giay, { thermalHeightMm: caoMm, footerText: getPageFooterText(ban.model) });
    setBan((cu) => (cu === ban ? { ...cu, buoc: "in", cssTrang } : cu));
  }, [ban, xong]);

  useEffect(() => {
    if (ban?.buoc !== "in") return undefined;
    setBan((cu) => (cu ? { ...cu, buoc: "dang-in" } : cu));
    try {
      inNgay();
    } catch {
      xong();
      toast.error(t("Không mở được hộp in. Bấm In lại."));
      return undefined;
    }
    return undefined;
    // Chỉ chạy khi tờ in vừa sẵn sàng; inNgay đổi theo mỗi lần vẽ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ban?.buoc]);

  // Lưới an toàn: thư viện không gọi lại thì sau CHO_TOI_DA_MS mở khóa nút In
  const dangMoHop = ban?.buoc === "dang-in";
  useEffect(() => {
    if (!dangMoHop) return undefined;
    const hen = window.setTimeout(() => {
      if (!dangChay.current) return;
      xong();
      toast.error(t("Không mở được hộp in. Bấm In lại."));
    }, CHO_TOI_DA_MS);
    return () => window.clearTimeout(hen);
  }, [dangMoHop, xong]);

  const copies = ban?.nguon?.copies;
  const khungIn = ban
    ? createPortal(
        // Ngoài màn hình nhưng vẫn có bố cục (không display:none) để đo được chiều cao tờ in
        <div aria-hidden="true" className="pointer-events-none fixed top-0 left-[-10000px]">
          {/* print:min-h-0!: bỏ chiều cao tối thiểu khổ A4 / A5 của tờ xem trước khi in (như PrintLayout), không thì phiếu
              ngắn vẫn tràn sang một trang trắng thứ hai */}
          <div ref={giayRef} className={`bg-white print:min-h-0! ${getPaperSheetClasses(ban.giay)}`}>
            {ban.cssTrang ? <style>{ban.cssTrang}</style> : null}
            {copies?.length ? (
              copies.map((copy, i) => (
                <div className={i > 0 ? "pdoc-lien-sau" : undefined} key={copy}>
                  <PrintTemplateDocument
                    documentType={ban.nguon.documentType}
                    config={ban.config}
                    model={{ ...ban.model, copy }}
                    company={ban.company}
                  />
                </div>
              ))
            ) : (
              <PrintTemplateDocument
                documentType={ban.nguon.documentType}
                config={ban.config}
                model={ban.model}
                company={ban.company}
              />
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return { inPhieu, dangIn: dangTai || Boolean(ban), khungIn };
}
