// src/pages/stock-take/StockTakeCreate.jsx
import { useCallback, useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import { GOI_Y_O, NHAN_O, O_NHAP_NHIEU_DONG } from "@/components/chung-tu/kieuHopThoai";
import { TT_DOT_KIEM_KE } from "@/components/kiem-ke/tinhKiemKe";
import { GHI_CHU_KIEM_KE_TOI_DA } from "@/config/bangChungTu";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { toast } from "@/lib/thongBaoNhanh";
import { cn } from "@/lib/utils";
import { getKhoList } from "@/services/khoService";
import { createStockTake, getStockTakes } from "@/services/stockTakeService";
import { getApiErrorMessage } from "@/utils/apiError";
import { laKhoGiaoDich } from "@/utils/kho";
import { KHO_LAM_VIEC_EVENT, dsKhoLamViecTrongToken, getKhoLamViecId, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

/**
 * Tạo đợt kiểm kê (/stock-take/new). Q11 (tạo bằng hộp thoại ở danh sách) chưa chốt nên vẫn là trang riêng như cũ, chỉ
 * còn bước tạo; chi tiết / đếm ở /stock-take/:id (StockTakeDetail).
 * - Kho chọn được: quản trị viên mọi kho đang hoạt động (bỏ kho trung chuyển); quản lý kho các kho được phân; nhân viên kho
 *   chỉ kho đang làm việc (Nơi làm việc).
 * - Kho đã có đợt đang kiểm kê → cảnh báo (máy chủ không chặn hai đợt cùng kho). Nhắc tạm dừng giao dịch ở kho: máy chủ
 *   chưa tự khóa kho khi kiểm kê.
 * - POST /phieu-kiem-ke { khoId, ghiChu } chỉ trả id → chuyển thẳng /stock-take/{id}. Kho không có hàng: câu máy chủ
 *   "Kho không có hàng tồn để kiểm kê".
 */
export default function StockTakeCreate() {
  const navigate = useNavigate();
  const idForm = useId();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const laQlk = !laQtv && hasAnyRole([ROLES.QUAN_LY_KHO]);
  const laNvk = !laQtv && !laQlk && hasAnyRole([ROLES.NHAN_VIEN_KHO]);

  // Kho đang làm việc (nhân viên kho): đổi ở thanh bên thì cập nhật theo
  const [khoLamViec, setKhoLamViec] = useState(getKhoLamViecId);
  useEffect(() => {
    const nghe = (suKien) => setKhoLamViec(suKien.detail ?? getKhoLamViecId());
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);

  const taiKho = useCallback(async () => {
    if (laQtv) return (await getKhoList()).filter(laKhoGiaoDich);
    return dsKhoLamViecTrongToken();
  }, [laQtv]);
  const qKho = useTaiDuLieu(taiKho, "kho-kiem-ke");
  const qDot = useTaiDuLieu(getStockTakes, "dot-kiem-ke-dang-mo");

  const tatCaKho = qKho.data ?? [];
  const dsKho = laNvk ? tatCaKho.filter((k) => Number(k.id) === Number(khoLamViec)) : tatCaKho;
  const [khoChon, setKhoChon] = useState(null);
  // Chưa chọn: mặc định nơi đang làm việc (nếu có trong danh sách), không thì kho đầu tiên
  const khoMacDinh = dsKho.find((k) => Number(k.id) === Number(khoLamViec)) ?? dsKho[0] ?? null;
  const khoId = dsKho.some((k) => Number(k.id) === Number(khoChon)) ? Number(khoChon) : khoMacDinh?.id ?? null;
  const kho = dsKho.find((k) => Number(k.id) === Number(khoId)) ?? null;
  const dotDangMo = khoId == null
    ? null
    : (qDot.data ?? []).find((d) => Number(d?.trangThai) === TT_DOT_KIEM_KE.DANG_KIEM_KE && Number(d?.kho?.id) === Number(khoId)) ?? null;
  // Chưa biết kho đã có đợt đang mở hay chưa (đang tải lần đầu / lỗi): không để tạo trùng mà không hay
  const dangTaiDot = qDot.loading && qDot.data === undefined;
  const loiDot = qDot.error && !qDot.loading ? getApiErrorMessage(qDot.error, "lỗi kết nối") : null;

  const [ghiChu, setGhiChu] = useState("");
  const [dangTao, setDangTao] = useState(false);
  const [loi, setLoi] = useState(null);

  const tao = async () => {
    if (khoId == null || dangTao) return;
    setLoi(null);
    setDangTao(true);
    try {
      // Máy chủ kiểm header kho_id là kho của người dùng: làm việc luôn ở kho sẽ kiểm kê
      if (!laQtv && getKhoLamViecId() !== Number(khoId)) setKhoLamViecId(khoId);
      const id = await createStockTake({ khoId, ghiChu: ghiChu.trim() || undefined });
      toast.success("Đã tạo đợt kiểm kê", { description: `Bắt đầu đếm hàng ở ${kho?.tenKho || "kho đã chọn"}` });
      navigate(`/stock-take/${id}`, { replace: true });
    } catch (error) {
      setLoi(getApiErrorMessage(error, "Không tạo được đợt kiểm kê"));
      setDangTao(false);
    }
  };

  const dangTaiKho = qKho.loading && qKho.data === undefined;
  const loiKho = qKho.error && !qKho.loading && qKho.data === undefined;
  const lyDoKhoa = dangTaiKho
    ? "Đang tải danh sách kho"
    : loiKho
      ? "Chưa tải được danh sách kho"
      : !dsKho.length
        ? laNvk
          ? "Chưa có nơi làm việc"
          : "Không có kho nào để kiểm kê"
        : dangTaiDot
          ? "Đang kiểm tra kho đã có đợt đang kiểm kê chưa"
          : "";

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma="Tạo đợt kiểm kê"
            dongPhu="Hệ thống chụp tồn của mọi lô trong kho ngay lúc tạo đợt"
            onQuayLai={() => navigate("/stock-take")}
            nhanQuayLai="Về danh sách kiểm kê"
            nutChinh={{
              ma: "tao",
              nhan: "Tạo và bắt đầu đếm",
              icon: PackageSearch,
              khoa: Boolean(lyDoKhoa) || dangTao,
              lyDo: lyDoKhoa || undefined,
              dangChay: dangTao,
              onClick: tao,
            }}
          />
        }
        thongBao={[
          <DongThongBao key="tam-dung" tone="warn">
            Tạm dừng nhập, xuất, chuyển kho và bán tại quầy ở kho sẽ kiểm kê, từ trước khi tạo đợt tới khi hoàn thành: hệ thống
            chưa tự khóa kho khi kiểm kê.
          </DongThongBao>,
          qKho.error && !qKho.loading ? (
            <DongThongBao key="loi-kho" tone="bad" actions={<NutChu onClick={qKho.reload}>Thử lại</NutChu>}>
              Không tải được danh sách kho: {getApiErrorMessage(qKho.error, "lỗi kết nối")}.
            </DongThongBao>
          ) : null,
          loiDot ? (
            <DongThongBao key="loi-dot" tone="warn" actions={<NutChu onClick={qDot.reload}>Thử lại</NutChu>}>
              Chưa kiểm tra được kho đã có đợt đang kiểm kê hay chưa: {loiDot}. Xem danh sách kiểm kê trước khi tạo để không tạo
              hai đợt cùng kho.
            </DongThongBao>
          ) : null,
        ].filter(Boolean)}
        chinh={
          <form
            id={idForm}
            className="grid max-w-2xl gap-5 px-4 py-5 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              tao();
            }}
          >
            <fieldset className="grid gap-2">
              <legend className={cn(NHAN_O, "mb-2")}>
                Kho kiểm kê <span className="text-bo-danger">*</span>
              </legend>
              {dangTaiKho ? (
                <p role="status" className="text-sm text-bo-muted">Đang tải danh sách kho…</p>
              ) : loiKho ? (
                <p className="text-sm text-bo-muted">Chưa tải được danh sách kho. Bấm Thử lại ở dòng báo lỗi phía trên.</p>
              ) : dsKho.length > 1 ? (
                // Chia cột theo bề rộng khối chứng từ (không theo khổ màn hình): 768px có thanh bên vẫn một cột
                <div className="grid gap-2 @2xl/khoi:grid-cols-2">
                  {dsKho.map((k) => {
                    const chon = Number(k.id) === Number(khoId);
                    return (
                      <label
                        key={k.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm",
                          chon ? "border-bo-primary bg-bo-primary-soft text-bo-foreground" : "border-bo-border bg-white text-slate-700 hover:bg-bo-surface-subtle",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${idForm}-kho`}
                          value={k.id}
                          checked={chon}
                          onChange={() => {
                            setKhoChon(k.id);
                            setLoi(null);
                          }}
                          className="size-4 accent-bo-primary"
                        />
                        <span className="min-w-0 truncate font-medium" title={k.tenKho}>{k.tenKho}</span>
                      </label>
                    );
                  })}
                </div>
              ) : dsKho.length === 1 ? (
                <>
                  <p className="rounded-md border border-bo-border bg-bo-surface-subtle px-3 py-2.5 text-sm font-medium text-bo-foreground">
                    {dsKho[0].tenKho}
                  </p>
                  {laNvk || laQlk ? (
                    <p className="text-xs text-bo-muted">
                      {laNvk ? "Nhân viên kho chỉ kiểm kê được kho đang làm việc." : "Bạn chỉ được phân một kho."}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-bo-muted">
                  {laNvk
                    ? "Chưa chọn nơi làm việc. Chọn kho ở ô Nơi làm việc trên thanh bên rồi tạo đợt."
                    : "Không có kho nào đang hoạt động để kiểm kê."}
                </p>
              )}
            </fieldset>

            {dotDangMo ? (
              <DongThongBao
                tone="warn"
                actions={<NutChu onClick={() => navigate(`/stock-take/${dotDangMo.id}`)}>Mở đợt {dotDangMo.maDotKiemKe}</NutChu>}
              >
                Kho này đang có đợt {dotDangMo.maDotKiemKe} chưa hoàn thành. Tạo thêm đợt sẽ chụp lại tồn, hai đợt ghi đè lẫn nhau
                khi hoàn thành.
              </DongThongBao>
            ) : null}

            <label className="grid gap-1.5">
              <span className={NHAN_O}>Ghi chú</span>
              <textarea
                value={ghiChu}
                maxLength={GHI_CHU_KIEM_KE_TOI_DA}
                onChange={(e) => setGhiChu(e.target.value.slice(0, GHI_CHU_KIEM_KE_TOI_DA))}
                placeholder="Ví dụ: Kiểm kê cuối tháng, tạm dừng nhập xuất 08:30–12:00"
                className={O_NHAP_NHIEU_DONG}
              />
              <span className={GOI_Y_O}>
                <span>Không bắt buộc</span>
                <span>
                  {ghiChu.length}/{GHI_CHU_KIEM_KE_TOI_DA}
                </span>
              </span>
            </label>

            {loi ? (
              <DongThongBao tone="bad">
                {loi}
              </DongThongBao>
            ) : null}
          </form>
        }
      />
    </PageContainer>
  );
}
