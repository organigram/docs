import React, {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode
} from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { mobileNavHeight, navHeight } from '@organigram/react'
import i18next from 'i18next'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { type SxProps } from '@mui/material/styles'

import Sidebar, { docsSidebarWidth } from './Sidebar'
import Toc, {
  type Heading as HeadingType,
  tocWidthMd
} from './TableOfContents'
import DocsNavigation from './Navigation'
import DocsBreadcrumbs from './Breadcrumbs'
import { findPostByPath, MDXComponents } from '../../lib/mdx'
import { getDocsImporter } from '../../lib/modules'
import { useBreakpoint } from '../../lib/client'
import { type FileTree } from '../../types'

const Loader: React.FC = () => (
  <Grid
    container
    justifyContent='center'
    alignItems='center'
    height={`calc(100vh - ${navHeight}px)`}
  >
    <CircularProgress sx={{ color: 'text.primary' }} />
  </Grid>
)

const DefaultSidebarButton: React.FC<{
  isOpen: boolean
  onClick: () => void
  sx?: SxProps
}> = ({ isOpen, onClick, sx }) => (
  <Button
    variant='outlined'
    sx={{
      '&:hover': {
        backgroundColor: 'background.default'
      },
      backgroundColor: isOpen ? 'white' : 'background.default',
      borderColor: 'grey.light3',
      transition: 'left 0.2s',
      position: 'fixed',
      minWidth: 0,
      width: 28,
      height: 28,
      px: 0,
      bottom: 'calc(50% - 15px)',
      left: isOpen ? docsSidebarWidth.sm : '-10px',
      zIndex: 1400,
      ...sx
    }}
    onClick={onClick}
  >
    <ChevronRightIcon
      style={{
        width: '20px',
        transform: isOpen ? 'rotate(180deg)' : '',
        transition: 'transform 0.2s'
      }}
    />
  </Button>
)

export interface DocsIntegrations {
  Footer?: ComponentType
  SidebarButton?: ComponentType<{
    isOpen: boolean
    onClick: () => void
    sx?: SxProps
  }>
  loading?: ReactNode
}

const Docs: React.FC<{
  trees: FileTree[]
  url: string
  headings: HeadingType[] | null
  integrations?: DocsIntegrations
}> = ({ trees, url, headings, integrations }) => {
  const { query, push } = useRouter()
  const isTabletOrAbove = useBreakpoint('sm')
  const isNotebookOrAbove = useBreakpoint('md')
  const [sidebarOpen, setSidebarOpen] = useState(isNotebookOrAbove)
  const docUrl = url === '/index.mdx' ? '/introduction/index.mdx' : url
  const currentTree = findPostByPath(trees, docUrl)
  const docsImporter =
    getDocsImporter(docUrl) ?? getDocsImporter('/introduction/index.mdx')
  const Loading = integrations?.loading ?? <Loader />
  const SidebarButton = integrations?.SidebarButton ?? DefaultSidebarButton
  const Footer = integrations?.Footer
  const Mdx = dynamic<{
    components: Record<string, React.FC<unknown>>
  }>(docsImporter as () => Promise<{ default: React.FC<unknown> }>, {
    ssr: false,
    loading: () => <>{Loading}</>
  })

  useEffect(() => {
    setSidebarOpen(isNotebookOrAbove)
  }, [isNotebookOrAbove])

  useEffect(() => {
    if (query.path == null) push(`/${i18next.language}/docs/introduction`)
  }, [push, query.path])

  const sidebarWidth = sidebarOpen
    ? isTabletOrAbove
      ? docsSidebarWidth.sm
      : docsSidebarWidth.xs
    : '0px'

  const hasHeadings = headings != null && headings.length > 0
  // Only reserve the table of contents' column when it is rendered, so the
  // page stays centered between the sidebar and the right edge. The column
  // is tocWidthMd wide from sm up and brings its own spacing, so the 16px
  // right gutter is only needed when there is no table of contents.
  const tocMd = hasHeadings ? tocWidthMd : 0
  const rightGutterSm = hasHeadings ? 0 : 16

  return (
    <Grid
      container
      flexDirection='column'
      sx={{
        backgroundColor: 'background.default'
      }}
    >
      <Grid
        item
        container
        minHeight='100vh'
        sx={{
          pt: [mobileNavHeight.toString() + 'px', navHeight.toString() + 'px'],
          mb: [sidebarOpen ? 0 : '-100vh', navHeight.toString() + 'px'],
          overflow: 'hidden',
          backgroundColor: 'background.default',
          display: [sidebarOpen ? 'none' : 'flex', 'flex']
        }}
        // 16px left gutter on sm, matching the right one (see rightGutterSm).
        ml={[
          sidebarWidth,
          `calc(${sidebarOpen ? docsSidebarWidth.sm : '0px'} + 16px)`,
          sidebarWidth
        ]}
        justifyContent='space-between'
        flexDirection='column'
        width={[
          '100vw',
          `calc(100vw - ${16 + rightGutterSm}px - ${
            sidebarOpen ? docsSidebarWidth.sm : '0px'
          } - ${tocMd}px)`,
          `calc(100vw - ${sidebarWidth} - ${tocMd}px)`
        ]}
      >
        <Grid
          width='100%'
          item
          zIndex={1300}
          display='flex'
          justifyContent='center'
        >
          <Grid sx={{ pb: 6, px: [2, 4], maxWidth: '1080px', minWidth: 0 }}>
            <Box
              sx={{
                '& > h1 + p': {
                  mt: 0,
                  mb: 4,
                  pb: 3,
                  color: 'grey.main',
                  fontSize: ['18px', '20px'],
                  lineHeight: 1.5,
                  borderBottom: ({ palette }) =>
                    `2px solid ${palette.primary.main as string}`
                }
              }}
            >
              <DocsBreadcrumbs trees={trees} current={currentTree} />
              <Mdx
                components={MDXComponents as Record<string, React.FC<unknown>>}
              />
            </Box>
            <DocsNavigation trees={trees} current={currentTree} />
          </Grid>
        </Grid>
      </Grid>
      <Grid
        container
        sx={{
          position: 'sticky',
          bottom: 0,
          height: '100vh',
          mt: [0, 'calc(-100vh - 100px)'],
          // Above the page so that the sidebar button is not covered by it,
          // but clicks only land on the sidebar, its button and the TOC.
          zIndex: 1301,
          pointerEvents: 'none'
        }}
        justifyContent='space-between'
      >
        <Grid
          item
          pt={[0, '50px']}
          width={docsSidebarWidth}
          container
          height='100%'
          sx={{ pointerEvents: sidebarOpen ? 'auto' : 'none' }}
        >
          <Sidebar trees={trees} open={sidebarOpen} setOpen={setSidebarOpen} />
          <SidebarButton
            isOpen={sidebarOpen}
            onClick={() => {
              setSidebarOpen(!sidebarOpen)
            }}
            sx={{
              position: 'absolute',
              pointerEvents: 'auto',
              top: '50%',
              right: [sidebarOpen ? '10px' : '', '10px'],
              left: [
                sidebarOpen ? '' : '-10px',
                sidebarOpen ? `calc(${docsSidebarWidth.sm} - 10px)` : '-10px'
              ]
            }}
          />
        </Grid>
        <Grid
          item
          height={[`calc(100vh - ${mobileNavHeight}px)`, '100%']}
          sx={{
            zIndex: 1400,
            pointerEvents: 'auto'
          }}
          display={['none', 'flex']}
        >
          {hasHeadings && <Toc headings={headings} />}
        </Grid>
      </Grid>
      {Footer != null &&
        (isTabletOrAbove || (!isTabletOrAbove && !sidebarOpen)) && <Footer />}
    </Grid>
  )
}

export default Docs
