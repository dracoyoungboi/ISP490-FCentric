import { cloneElement, useLayoutEffect, useRef, useState } from "react";
import { sidebarDangChuyen, theoDoiSidebarChuyenDong } from "@/lib/sidebarChuyenDong";

/**
 * Khung co giãn cho biểu đồ Recharts, dùng thay ResponsiveContainer: đo khung chứa rồi
 * truyền width / height cho biểu đồ con. Khác ResponsiveContainer ở một điểm: trong lúc
 * sidebar đang thu / mở thì không vẽ lại (vẽ lại ở từng khung hình làm chuyển động giật),
 * và vẽ lại đúng một lần ngay khi sidebar dừng. Trong 250ms đó, khung hẹp lại thì biểu đồ
 * cũ co đều theo khung (svg rộng 100% kèm viewBox, không tràn sang thẻ bên cạnh), khung
 * rộng ra thì biểu đồ cũ giữ cỡ và chừa trống bên phải.
 *
 * - height: chiều cao khung (số px hoặc chuỗi CSS), mặc định "100%" của khối cha.
 * - children: đúng một biểu đồ Recharts (BarChart, ComposedChart, AreaChart...).
 */
export default function KhungBieuDo({ height = "100%", className, children }) {
  const khungRef = useRef(null);
  const [kichThuoc, setKichThuoc] = useState(null);

  useLayoutEffect(() => {
    const khung = khungRef.current;
    if (!khung) return undefined;
    // clientWidth / clientHeight: số nguyên, không tính transform của khối cha.
    const doNgay = () => {
      const rong = khung.clientWidth;
      const cao = khung.clientHeight;
      setKichThuoc((cu) => (cu && cu.rong === rong && cu.cao === cao ? cu : { rong, cao }));
    };
    const doKhung = () => {
      if (!sidebarDangChuyen()) doNgay();
    };
    // Lần đầu luôn đo, kể cả khi biểu đồ hiện ra giữa lúc sidebar đang thu / mở.
    doNgay();
    const quanSat = new ResizeObserver(doKhung);
    quanSat.observe(khung);
    const boTheoDoi = theoDoiSidebarChuyenDong(doKhung);
    return () => {
      quanSat.disconnect();
      boTheoDoi();
    };
  }, []);

  const coCo = kichThuoc && kichThuoc.rong > 0 && kichThuoc.cao > 0;
  return (
    <div ref={khungRef} className={className} style={{ width: "100%", height }}>
      {coCo
        ? cloneElement(children, {
            width: kichThuoc.rong,
            height: kichThuoc.cao,
            // Như ResponsiveContainer: khung bao biểu đồ giãn theo khung chứa nhưng không
            // vượt cỡ đã vẽ, nên khi khung hẹp lại biểu đồ cũ co theo thay vì tràn ra ngoài.
            style: {
              width: "100%",
              height: "100%",
              maxWidth: kichThuoc.rong,
              maxHeight: kichThuoc.cao,
              ...children.props.style,
            },
          })
        : null}
    </div>
  );
}
