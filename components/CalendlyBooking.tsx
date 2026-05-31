import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'

const defaultCalendlyUrl = 'https://calendly.com/organigram/30mn'

const CalendlyBooking: React.FC<{
  url?: string
  minHeight?: string | number
}> = ({ url = defaultCalendlyUrl, minHeight = '860px' }) => {
  const widgetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scriptId = 'calendly-widget-script'
    const scriptSrc = 'https://assets.calendly.com/assets/external/widget.js'
    const widgetElement = widgetRef.current
    if (widgetElement == null) return

    const init = (): void => {
      const calendly = (window as Window & { Calendly?: { initInlineWidget: (options: { url: string; parentElement: HTMLElement; resize?: boolean }) => void } }).Calendly
      if (calendly == null) return
      widgetElement.innerHTML = ''
      calendly.initInlineWidget({
        url,
        parentElement: widgetElement,
        resize: true
      })
    }

    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (script == null) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = scriptSrc
      script.async = true
      document.body.appendChild(script)
    }
    if ((window as Window & { Calendly?: unknown }).Calendly != null) init()
    else script.addEventListener('load', init, { once: true })

    return () => {
      script?.removeEventListener('load', init)
      widgetElement.innerHTML = ''
    }
  }, [url])

  return <Box ref={widgetRef} sx={{ width: '100%', minHeight }} />
}

export default CalendlyBooking
