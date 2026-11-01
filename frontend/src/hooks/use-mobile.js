import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Đọc cỡ màn ngay lần dựng đầu: điện thoại không dựng bản máy tính một nhịp rồi mới đổi (gắn hai lần, gọi API hai lần)
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < MOBILE_BREAKPOINT)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange);
  }, [])

  return !!isMobile
}
