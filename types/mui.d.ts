import { type theme } from '@organigram/react'

declare module '@mui/material/styles' {
  interface Theme {
    palette: typeof theme.palette
    components: typeof theme.components
    shape: typeof theme.shape
    typography: typeof theme.typography
  }
}
