import useMediaQuery from '@mui/material/useMediaQuery'
import { type Breakpoint, useTheme } from '@mui/material/styles'

export const useBreakpoint = (breakpoint: Breakpoint): boolean => {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.up(breakpoint))
}
