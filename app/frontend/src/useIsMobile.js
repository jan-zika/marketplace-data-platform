import { useEffect, useState } from 'react'

// Below 1024 px the app switches to its single-column phone and tablet layout; at 1024 px and up the desktop
// layout is unchanged. The same breakpoint is used in theme.css.
export const MOBILE_QUERY = '(max-width: 1023.98px)'

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return mobile
}
