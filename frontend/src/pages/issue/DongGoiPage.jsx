import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import { ArrowRight, FileText, PackageCheck, PackageX, Printer, Truck, Warehouse } from "lucide-react";
import PageContainer from "@/components/backoffice/PageContainer";
import KhungChungTu from "@/components/chung-tu/KhungChungTu";
import DauChungTu from "@/components/chung-tu/DauChungTu";
import TienTrinhChungTu from "@/components/chung-tu/TienTrinhChungTu";
import DongThongBao, { NutChu } from "@/components/chung-tu/DongThongBao";
import HopXacNhanChungTu from "@/components/chung-tu/HopXacNhanChungTu";
import { KhungDangTai, KhungKhongThay, KhungLoiChungTu } from "@/components/chung-tu/KhungTaiChungTu";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { GHI_CHU_HOP } from "@/components/chung-tu/kieuHopThoai";
import {
  CAU_HET_THOI_HAN,
  MO_TA_HET_THOI_HAN,
  chayCoThoiHan,
  khiGocKetThuc,
  khoaKhiChoGoc,
  laLoiHetThoiHan,
} from "@/components/chung-tu/thoiHanThaoTac";
import PackingProofSection from "@/components/outbound/PackingProofSection";
import BangDongGoi from "@/components/outbound/dong-goi/BangDongGoi";
import ThuocTinhDongGoi from "@/components/outbound/dong-goi/ThuocTinhDongGoi";
import TramQuet from "@/components/outbound/dong-goi/TramQuet";
import {
  bangChungHetHan,
  buocDongGoi,
  cauDaQuet,
  cauPhuPhanHoi,
  chuSoBangChung,
  donCungPhieuNhat,
  dongDongGoi,
  lyDoKhoaHoanTat,
  oBangChung,
  thongBaoDongGoi,
  tienDoDongGoi,
  tinhHuongPhien,
  xepDongDongGoi,
} from "@/components/outbound/dong-goi/tinhDongGoi";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import useScanQueue from "@/hooks/useScanQueue";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import useTaiLaiKhiQuayLai from "@/hooks/useTaiLaiKhiQuayLai";
import { toast } from "@/lib/thongBaoNhanh";
import { donBanHangService } from "@/services/donBanHangService";
import { dongGoiService } from "@/services/dongGoiService";
import { nhatHangService } from "@/services/nhatHangService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { KHO_LAM_VIEC_EVENT, getKhoLamViecId, laKhoLamViecHopLe, setKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";
import { playScanBeep } from "@/utils/scanBeep";

// Phiếu xuất thuộc kho khác kho đang làm việc (DongGoiServiceImpl.kiemTraKho)
const MAU_KHO_KHAC = /thuộc kho khác/i;

/** Phiên đóng gói gửi kèm lỗi 409 khi đơn / phiếu xuất đã bị hủy (khóa đóng gói). */
function phienTuLoi(error) {
  const data = error?.response?.data?.data;
  return data && data.phieuXuatKhoId ? data : null;
}

/**
 * Đóng gói đơn hàng (Scan-to-Pack) · bản "một khối" (21/10/2026, artboard DongGoi của canvas "Màn bán hàng & kho cấp 2–3"):
 * 3 bước Quét đủ hàng → Bằng chứng → Hoàn tất; trạm quét có hàng đợi; bảng dòng có tiến độ; bằng chứng theo yêu cầu
 * của máy chủ; cột phải (khách, tổng cộng, kho, chứng từ, đơn cùng phiếu nhặt). Xong thì phiếu xuất sang Chờ xuất.
 * Quyền: quản trị viên, quản lý kho, nhân viên kho (route). Mở đơn của kho khác: tự chuyển nơi làm việc nếu kho đó có trong
 * token, không thì màn "Đơn thuộc kho khác"; quản trị viên không bị chặn theo kho (máy chủ bỏ qua).
 */
export default function DongGoiPage() {
  const { donId } = useParams();
  return <ManDongGoi key={donId} donId={donId} />;
}

function ManDongGoi({ donId }) {
  const navigate = useNavigate();
  const laQtv = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  // Rời màn qua lớp chặn: đang quay / đang tải bằng chứng thì PackingProofSection hỏi trước (useHoiKhiRoiTrang)
  const veDon = useCallback(() => xinRoiTrang(() => navigate(`/sales-orders/${donId}`)), [navigate, donId]);

  // ── Phiên đóng gói (tự chuyển nơi làm việc khi đơn thuộc kho khác) ──────────
  const taiPhien = useCallback(async () => {
    try {
      return { phien: await dongGoiService.layPhien(donId), doiKho: null };
    } catch (error) {
      // Mọi 403 (phiếu thuộc kho khác; nơi làm việc đang chọn đã cũ hoặc trống) với người không phải quản trị viên:
      // thử chuyển nơi làm việc sang kho của đơn nếu kho đó có trong token
      if (getApiErrorStatus(error) !== 403 || laQtv) throw error;
      const ct = await donBanHangService.getDetail(donId).catch(() => null);
      const kho = ct?.data?.donBanHang?.khoXuat ?? null;
      if (kho?.id && kho.id !== getKhoLamViecId() && laKhoLamViecHopLe(kho)) {
        setKhoLamViecId(kho.id);
        return { phien: await dongGoiService.layPhien(donId), doiKho: kho.tenKho || "kho của đơn" };
      }
      error.khoCuaDon = kho;
      throw error;
    }
  }, [donId, laQtv]);
  const q = useTaiDuLieu(taiPhien, `dong-goi-${donId}`, { enabled: Boolean(donId) });
  const phien = q.data?.phien ?? null;
  const doiKho = q.data?.doiKho ?? null;
  const pxId = phien?.phieuXuatKhoId ?? null;

  // ── Yêu cầu bằng chứng của máy chủ (huongDan, soLuongYeuCau) ─────────────
  const taiBangChung = useCallback(() => dongGoiService.layBangChung(donId), [donId]);
  const qBc = useTaiDuLieu(taiBangChung, `bang-chung-${donId}`, { enabled: Boolean(phien) });

  // ── Đơn cùng phiếu nhặt: phiên chỉ có maPickList → id phiếu nhặt lấy ở chi tiết đơn ──
  const coPhieuNhat = Boolean(phien?.maPickList);
  const taiPhieuNhat = useCallback(async () => {
    const ct = await donBanHangService.getDetail(donId);
    const idPl = ct?.data?.phieuNhatHangId;
    if (!idPl) return [];
    const pl = await nhatHangService.getPickList(idPl);
    return Array.isArray(pl?.danhSachDonHang) ? pl.danhSachDonHang : [];
  }, [donId]);
  const qPl = useTaiDuLieu(taiPhieuNhat, `phieu-nhat-dong-goi-${donId}`, { enabled: coPhieuNhat });

  const [phanHoi, setPhanHoi] = useState(null);
  const [dongSang, setDongSang] = useState(null);
  const [lanQuet, setLanQuet] = useState(0);
  // Ô quét mã: sau thao tác bằng chứng / hộp thoại trả tiêu điểm về đây để máy quét gõ tiếp (Enter không bấm nhầm nút)
  const oQuetRef = useRef(null);
  const [hop, setHop] = useState(false);
  const [dangChay, setDangChay] = useState(false);
  const [loiHop, setLoiHop] = useState(null);
  const [choGoc, setChoGoc] = useState(false);
  const huyChoGocRef = useRef(null);
  const daGoRef = useRef(false);
  useEffect(() => {
    daGoRef.current = false;
    return () => {
      daGoRef.current = true;
      huyChoGocRef.current?.();
    };
  }, []);

  const datPhien = q.setData;
  const taiLaiTatCa = useCallback(() => {
    q.reload();
    qBc.reload();
    if (coPhieuNhat) qPl.reload();
  }, [q, qBc, qPl, coPhieuNhat]);

  // Đổi nơi làm việc (thanh bên, tab khác) thì tải lại phiên: header kho_id đã đổi
  const taiLaiRef = useRef(taiLaiTatCa);
  useEffect(() => {
    taiLaiRef.current = taiLaiTatCa;
  });
  useEffect(() => {
    const nghe = () => taiLaiRef.current?.();
    window.addEventListener(KHO_LAM_VIEC_EVENT, nghe);
    return () => window.removeEventListener(KHO_LAM_VIEC_EVENT, nghe);
  }, []);

  // ── Quét: gửi lần lượt từng mã (máy chủ khóa phiếu xuất khi quét) ─────────
  const xuLyQuet = useCallback(async ({ ma, soLuong }) => {
    if (!pxId) return;
    try {
      const res = await dongGoiService.quet(pxId, { barcode: ma, soLuong });
      if (daGoRef.current) return;
      datPhien((cu) => (cu ? { ...cu, phien: res } : cu));
      const dongVua = (res?.items ?? []).find((x) => String(x.chiTietId) === String(res?.chiTietVuaQuetId));
      const duDong = dongVua && Number(dongVua.soLuongDaQuet) >= Number(dongVua.soLuongCan);
      setDongSang(res?.chiTietVuaQuetId ?? null);
      setLanQuet((n) => n + 1);
      setPhanHoi({ ok: true, chu: res?.thongBao || cauDaQuet(soLuong, dongVua, ma), phu: duDong ? "Đủ dòng này" : "" });
    } catch (error) {
      if (daGoRef.current) return;
      const phienHuy = phienTuLoi(error);
      if (phienHuy) datPhien((cu) => (cu ? { ...cu, phien: phienHuy } : cu));
      const cau = getApiErrorMessage(error, `Không ghi nhận được mã ${ma}`);
      setPhanHoi({ ok: false, chu: cau, phu: cauPhuPhanHoi(cau) });
      // Chỉ kêu khi KHÔNG cộng được: máy quét đã tự kêu khi đọc được mã
      playScanBeep(false);
      if (getApiErrorStatus(error) === 409) {
        // Phiên đã khóa (đơn / phiếu bị hủy, đã đóng gói ở nơi khác): bỏ các mã còn chờ, không gửi tiếp
        boHangDoiRef.current?.();
        if (!phienHuy) q.reload();
      }
    }
  }, [pxId, datPhien, q]);
  const { enqueue, pending, clear } = useScanQueue(xuLyQuet);
  const boHangDoiRef = useRef(clear);
  useEffect(() => {
    boHangDoiRef.current = clear;
  });

  useTaiLaiKhiQuayLai(taiLaiTatCa, { bat: Boolean(phien) && !q.loading && !dangChay && !hop && pending === 0, lanCuoi: q.capNhatLuc });

  // ── Tính toán ───────────────────────────────────────────────────────────
  const th = useMemo(() => tinhHuongPhien(phien), [phien]);
  const dong = useMemo(() => xepDongDongGoi(dongDongGoi(phien?.items)), [phien]);

  // ── Đang tải / lỗi ─────────────────────────────────────────────────────
  if (!phien) {
    if (q.loading || (!q.error && q.data === undefined)) {
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungDangTai nhan="Đang tải phiên đóng gói" />
        </PageContainer>
      );
    }
    const loi = q.error;
    const trangThaiLoi = getApiErrorStatus(loi);
    // Kho của đơn không có trong nơi làm việc được phân (đã thử tự chuyển mà không được)
    const khoKhac = trangThaiLoi === 403 && (MAU_KHO_KHAC.test(getApiErrorMessage(loi, "")) || Boolean(loi?.khoCuaDon));
    if (khoKhac) {
      const tenKho = loi?.khoCuaDon?.tenKho;
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungKhongThay
            icon={Warehouse}
            tieuDe="Đơn thuộc kho khác"
            moTa={
              tenKho
                ? `Phiếu xuất của đơn này thuộc ${tenKho}, bạn không làm việc ở kho đó. Nhờ nhân viên ${tenKho.replace(/^Kho\s/, "kho ")} đóng gói, hoặc nhờ quản lý thêm kho này vào nơi làm việc của bạn.`
                : "Phiếu xuất của đơn này thuộc kho bạn không làm việc. Nhờ nhân viên kho đó đóng gói, hoặc nhờ quản lý thêm kho này vào nơi làm việc của bạn."
            }
            nhanNut="Về đơn bán hàng"
            onNut={veDon}
          />
        </PageContainer>
      );
    }
    if (trangThaiLoi === 409) {
      // Đơn chưa nhặt xong nên chưa có phiếu xuất để đóng gói: câu máy chủ nguyên văn
      return (
        <PageContainer className="flex min-h-full flex-col">
          <KhungKhongThay
            icon={PackageX}
            tieuDe="Chưa đóng gói được đơn này"
            moTa={getApiErrorMessage(loi, "Đơn chưa có phiếu xuất kho để đóng gói.")}
            nhanNut="Về đơn bán hàng"
            onNut={veDon}
          />
        </PageContainer>
      );
    }
    return (
      <PageContainer className="flex min-h-full flex-col">
        <KhungLoiChungTu
          loi={loi}
          tenChungTu="đơn bán hàng"
          onVeDanhSach={() => navigate("/sales-orders")}
          onThuLai={q.reload}
        />
      </PageContainer>
    );
  }

  const so = phien.soDonHang || `#${phien.donBanHangId}`;
  const px = phien.soPhieuXuat || "";
  const tienDo = tienDoDongGoi(dong, { xong: th.xong });
  const yeuCauVideo = qBc.data?.yeuCauVideo ?? Boolean(phien.yeuCauVideo);
  const dsBangChung = qBc.data?.danhSachBangChung ?? phien.danhSachBangChung ?? [];
  const duBangChung = qBc.data?.daDuBangChung ?? Boolean(phien.daDuBangChung);
  const oBc = oBangChung({ yeuCauVideo, danhSach: dsBangChung });
  const hetHan = bangChungHetHan(th, dsBangChung, phien.items);
  const chuBc = chuSoBangChung(oBc, { yeuCauVideo, soLuongYeuCau: qBc.data?.soLuongYeuCau });
  const lyDoKhoa = th.suaDuoc
    ? lyDoKhoaHoanTat({
      conLai: tienDo.conLai,
      duBangChung,
      yeuCauVideo,
      soThieu: oBc.filter((o) => !o.bangChung).length,
      dangCho: pending,
    })
    : "";
  const cung = donCungPhieuNhat(qPl.data, phien.donBanHangId);

  // ── Thao tác ────────────────────────────────────────────────────────────
  const quet = (ma, soLuong) => {
    if (!ma) {
      setPhanHoi({ ok: false, chu: "Chưa có mã để ghi nhận", phu: "Quét mã vạch trên tem sản phẩm hoặc gõ SKU." });
      return;
    }
    enqueue({ ma, soLuong });
  };

  const khoaToiKhiGocXong = (loi) => {
    huyChoGocRef.current?.();
    setChoGoc(true);
    huyChoGocRef.current = khiGocKetThuc(loi, () => {
      huyChoGocRef.current = null;
      setChoGoc(false);
      taiLaiTatCa();
    });
  };

  const hoanTat = async () => {
    if (!pxId) return;
    setLoiHop(null);
    setDangChay(true);
    try {
      const res = await chayCoThoiHan(() => dongGoiService.hoanTat(pxId));
      setHop(false);
      datPhien((cu) => (cu ? { ...cu, phien: res } : cu));
      setPhanHoi(null);
      toast.success(`Đã đóng gói xong đơn ${so}`, { description: `Phiếu xuất ${px} chờ xác nhận xuất kho` });
      qPl.reload();
    } catch (error) {
      if (laLoiHetThoiHan(error)) {
        if (daGoRef.current) return;
        setHop(false);
        toast.error(CAU_HET_THOI_HAN, { description: MO_TA_HET_THOI_HAN });
        taiLaiTatCa();
        khoaToiKhiGocXong(error);
        return;
      }
      const phienHuy = phienTuLoi(error);
      const cau = getApiErrorMessage(error, "Không hoàn tất được đóng gói");
      if (phienHuy || getApiErrorStatus(error) === 409) {
        // Đơn / phiếu xuất vừa bị hủy hoặc đổi ở nơi khác: đóng hộp, hiện tình huống mới
        if (phienHuy) datPhien((cu) => (cu ? { ...cu, phien: phienHuy } : cu));
        setHop(false);
        toast.error(cau);
      } else {
        setLoiHop(cau);
      }
      taiLaiTatCa();
    } finally {
      setDangChay(false);
    }
  };

  // ── Đầu khối ────────────────────────────────────────────────────────────
  const moPx = () => pxId && xinRoiTrang(() => navigate(`/goods-issues/${pxId}`));
  const nutChinh = khoaKhiChoGoc(
    [
      th.suaDuoc
        ? {
          ma: "hoanTat",
          nhan: "Hoàn tất đóng gói",
          icon: PackageCheck,
          khoa: Boolean(lyDoKhoa) || dangChay,
          lyDo: lyDoKhoa ? `Chưa hoàn tất được: ${lyDoKhoa}` : undefined,
          onClick: () => {
            setLoiHop(null);
            setHop(true);
          },
        }
        : null,
      th.xong && cung.tiep
        ? {
          ma: "tiep",
          nhan: "Đơn tiếp theo",
          kieu: "vien",
          icon: ArrowRight,
          dieuHuong: true,
          onClick: () => xinRoiTrang(() => navigate(`/goods-issues/packing/${cung.tiep.id}`)),
        }
        : null,
      th.xong && !th.daXuat
        ? { ma: "xuat", nhan: "Mở phiếu xuất để xuất kho", icon: Truck, dieuHuong: true, onClick: moPx }
        : null,
    ].filter(Boolean),
    choGoc,
  );

  const thongBao = [
    ...thongBaoDongGoi(phien, {
      tinhHuong: th,
      hetHan,
      doiKho,
      nhanTrangThaiDon: getDonBanHangStatus(phien.trangThaiDon).label,
    }).map((n) => (
      <DongThongBao key={n.ma} tone={n.tone} actions={n.moDon ? <NutChu onClick={veDon}>Mở đơn bán hàng</NutChu> : null}>
        {n.chu}
      </DongThongBao>
    )),
    q.loiTaiLai ? (
      <DongThongBao key="loi-tai-lai" tone="bad" actions={<NutChu onClick={taiLaiTatCa}>Thử lại</NutChu>}>
        Không tải lại được phiên đóng gói: {getApiErrorMessage(q.error, "lỗi kết nối")}. Thông tin đang hiện có thể đã cũ.
      </DongThongBao>
    ) : null,
  ].filter(Boolean);

  const buoc = buocDongGoi({ tinhHuong: th, tienDo, duBangChung, chuBangChung: chuBc, hetHan });
  const lyDoKhoaXoa = th.xong
    ? "Phiếu xuất đã hoàn tất đóng gói, không thể xóa bằng chứng"
    : th.donHuy
      ? "Đơn đã hủy, không thể xóa bằng chứng"
      : th.pxHuy
        ? "Phiếu xuất đã hủy, không thể xóa bằng chứng"
        : "";

  return (
    <PageContainer className="flex min-h-full flex-col">
      <KhungChungTu
        dau={
          <DauChungTu
            ma={so}
            trangThai={{ label: getDonBanHangStatus(phien.trangThaiDon).label, quyTrinh: "donBan" }}
            dongPhu={[
              "Đóng gói",
              px ? <span key="px">phiếu xuất <span className="tabular-nums">{px}</span></span> : null,
              <b key="dong" className="font-semibold text-bo-foreground">{soVN(dong.length)} dòng</b>,
              <b key="sl" className="font-semibold text-bo-foreground">tổng số lượng {soVN(tienDo.can)}</b>,
            ]}
            onQuayLai={veDon}
            nhanQuayLai="Về đơn bán hàng"
            menu={
              pxId
                ? [
                  { ma: "moPx", nhan: `Mở phiếu xuất ${px}`, icon: FileText, onSelect: moPx },
                  { ma: "inPx", nhan: "In phiếu xuất", icon: Printer, onSelect: () => xinRoiTrang(() => navigate(`/goods-issues/${pxId}/print`)) },
                ]
                : []
            }
            nutChinh={nutChinh}
          />
        }
        tienTrinh={<TienTrinhChungTu buoc={buoc} nhan="Các bước đóng gói" />}
        thongBao={thongBao.length ? thongBao : null}
        chinh={
          <>
            {th.suaDuoc ? <TramQuet ref={oQuetRef} onQuet={quet} dangCho={pending} phanHoi={phanHoi} /> : null}
            <BangDongGoi
              dong={dong}
              tienDo={tienDo}
              lyDoKhoa={lyDoKhoa}
              dongSang={dongSang}
              lanQuet={lanQuet}
              xong={th.xong}
              hoanKe={th.donHuy}
            />
            <PackingProofSection
              donId={phien.donBanHangId}
              yeuCauVideo={yeuCauVideo}
              huongDan={qBc.data?.huongDan}
              thoiLuongVideoToiThieu={qBc.data?.thoiLuongVideoToiThieu ?? phien.thoiLuongVideoToiThieu}
              thoiLuongVideoToiDa={qBc.data?.thoiLuongVideoToiDa ?? phien.thoiLuongVideoToiDa}
              danhSachBangChung={dsBangChung}
              daDuBangChung={duBangChung}
              readOnly={!th.suaDuoc}
              lyDoKhoaXoa={lyDoKhoaXoa}
              hetHan={hetHan}
              onRefresh={taiLaiTatCa}
              loiYeuCau={qBc.error && !qBc.loading ? getApiErrorMessage(qBc.error, "lỗi kết nối") : null}
              onThuLaiYeuCau={qBc.reload}
              traTieuDiem={() => oQuetRef.current?.focus()}
              traTieuDiemVe={oQuetRef}
              className="mt-2"
            />
          </>
        }
        cotPhai={
          <ThuocTinhDongGoi
            phien={phien}
            phieuNhat={{ dang: qPl.loading && qPl.data === undefined, loi: Boolean(qPl.error), ds: qPl.data }}
          />
        }
      />

      <HopXacNhanChungTu
        mo={hop}
        onDoiMo={(mo) => !mo && setHop(false)}
        tieuDe={`Hoàn tất đóng gói ${so}?`}
        moTa={`Phiếu xuất ${px} chuyển sang Chờ xuất. Sau bước này không quét thêm và không xóa bằng chứng được nữa.`}
        nhanXacNhan="Hoàn tất đóng gói"
        iconXacNhan={PackageCheck}
        dangChay={dangChay}
        // Máy quét gửi Enter sau mỗi mã: tiêu điểm ở "Quay lại" để không bấm nhầm Hoàn tất; đóng hộp thì về ô quét
        tieuDiemQuayLai
        traTieuDiemVe={oQuetRef}
        loi={loiHop}
        onXacNhan={hoanTat}
      >
        <div className={GHI_CHU_HOP}>
          Đã quét {soVN(tienDo.da)}/{soVN(tienDo.can)} sản phẩm · {chuBc}
        </div>
      </HopXacNhanChungTu>
    </PageContainer>
  );
}
