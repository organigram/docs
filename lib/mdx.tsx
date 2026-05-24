import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode
} from 'react'
import throttle from 'lodash/throttle'
import { type SxProps } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'
import TableContainer from '@mui/material/TableContainer'

import Link from '../components/Link'
import { type Heading } from '../components/Docs/TableOfContents'
import { type FileTree } from '../types'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { t } from './i18n'

export const findPostByOrder: (
  trees: FileTree[],
  order: number
) => FileTree | undefined = (trees, order) => {
  let post
  trees.forEach(tree => {
    if (tree.metadata?.order === order) {
      post = tree
    } else if (tree.children != null) {
      const _post = findPostByOrder(tree.children, order)
      if (_post != null) post = _post
    }
  })
  return post
}

export const slugify: (text: string) => string = text =>
  text
    ?.replace?.(/\+\+dnt\+\+/g, '')
    ?.replace?.(/<[^>]+>/g, '')
    ?.replace?.(/[^\w\s-]/g, '')
    ?.trim?.()
    ?.replace?.(/\s+/g, '_')

export const getHeadingsFromHtml: (
  stringifiedHtml: string
) => Heading[] = stringifiedHtml => {
  const regex = /<h([2-6])(?:\s[^>]*)?>(.*?)<\/h\1>/g
  return [...stringifiedHtml.matchAll(regex)].map(match => {
    const type = parseInt(match[1])
    const headingText = match[2].replace(/<[^>]+>/g, '')
    const link = `#${slugify(headingText)}`
    return { text: headingText, link, type }
  })
}

const getMarkdownHeaderComponent: (
  headingLevel: number
) => React.FC<{ children: ReactNode }> =
  headingLevel =>
  ({ children }): ReactNode => {
    const HeadingComponent: React.FC = () => (
      <Typography
        variant={`h${headingLevel}` as 'h1'}
        textTransform='none'
        sx={{
          mt: headingLevel === 1 ? 0 : 4,
          mb: headingLevel >= 4 ? 1.5 : 2,
          lineHeight: headingLevel === 1 ? 1.1 : headingLevel === 2 ? 1.2 : 1.3,
          fontSize:
            headingLevel === 1
              ? '40px'
              : headingLevel === 2
                ? '32px'
                : headingLevel === 3
                  ? '24px'
                  : headingLevel === 4
                    ? '20px'
                    : headingLevel === 5
                      ? '16px'
                      : '14px'
        }}
        id={slugify(children as string)}
      >
        {t(children as string)}
      </Typography>
    )
    return HeadingComponent({})
  }

export const useCurrentTocIndex: (
  headings: Heading[],
  navHeight: number
) => string = (headings, navHeight) => {
  const [currentIndex, setCurrentIndex] = useState('')
  const delay = 166

  const scrollToHash = useCallback(() => {
    if (typeof window === 'undefined') return () => {}

    const hash = window.location.hash
    if (hash === '') return () => {}

    const targetId = decodeURIComponent(hash.slice(1))
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const scroll = () => {
      const node = document.getElementById(targetId)
      if (node == null) {
        attempts += 1
        if (attempts <= 10) {
          timeoutId = setTimeout(scroll, 100)
        }
        return
      }

      const top =
        window.scrollY + node.getBoundingClientRect().top - navHeight

      window.scrollTo({
        top: Math.max(top, 0)
      })
    }

    scroll()

    return () => {
      if (timeoutId != null) clearTimeout(timeoutId)
    }
  }, [navHeight])

  const findActiveIndex = useCallback(() => {
    let active
    for (let i = headings.length - 1; i >= 0; i -= 1) {
      const item = headings[parseInt(i.toString())]
      const node = document.getElementById(item.link.slice(1))
      if (
        node != null &&
        node.offsetTop - navHeight <
          document.documentElement.scrollTop + node.clientHeight
      ) {
        active = item
        break
      }
    }
    if (active != null) setCurrentIndex(active.link)
  }, [headings, navHeight])

  const scrollListener = useMemo(
    () => throttle(findActiveIndex, delay),
    [findActiveIndex, delay]
  )

  useEffect(() => {
    let cleanupScroll: (() => void) | undefined

    const handleHashChange = () => {
      cleanupScroll?.()
      cleanupScroll = scrollToHash()
    }

    handleHashChange()
    window.addEventListener('scroll', scrollListener)
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      cleanupScroll?.()
      window.removeEventListener('scroll', scrollListener)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [scrollListener, scrollToHash])

  return currentIndex
}

export const CustomLink: React.FC<{
  href: string
  sx?: SxProps
  children: ReactNode
  target?: string
}> = ({ children, href, sx, ...props }) => (
  <Link href={href} shallow={false}>
    <MuiLink
      component='span'
      fontWeight='700'
      sx={{
        color: 'primary.main',
        textDecoration: 'underline',
        textDecorationColor: 'rgba(46, 91, 255, 0.25)',
        textUnderlineOffset: '0.18em',
        ':hover': {
          cursor: 'pointer',
          textDecorationColor: 'currentColor'
        },
        ...sx
      }}
      {...props}
    >
      {t(children as string)}
    </MuiLink>
  </Link>
)

const translateNode = (node: ReactNode): ReactNode => {
  if (Array.isArray(node)) {
    return node.map(child => translateNode(child))
  }
  return typeof node === 'string' ? t(node) : node
}

export const CustomStrong: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <Box component='strong' sx={{ fontWeight: 700 }}>
    {translateNode(children)}
  </Box>
)

export const CustomParagraph: React.FC<{
  children: ReactNode
  isLi?: boolean
}> = ({ children, isLi }) => (
  <Typography
    component={isLi === true ? 'span' : 'p'}
    variant='body1'
    sx={{
      my: isLi === true ? 0 : 2,
      color: 'text.primary',
      lineHeight: 1.9
      // fontSize: ['16px', '17px']
    }}
  >
    {translateNode(children)}
  </Typography>
)

export const CustomLi: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <Box component='li' sx={{ pl: 0.5 }}>
    <CustomParagraph isLi>{children}</CustomParagraph>
  </Box>
)

export const CustomUl: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Box
    component='ul'
    sx={{
      pl: 3,
      display: 'grid',
      gap: 0.75
    }}
  >
    {children}
  </Box>
)

export const CustomOl: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Box
    component='ol'
    sx={{
      pl: 3,
      display: 'grid',
      gap: 0.75
    }}
  >
    {children}
  </Box>
)

export const CustomCode: React.FC<{
  children: ReactNode
  className?: string
}> = ({ children, className }) =>
  className != null ? (
    <code className={className}>{children}</code>
  ) : (
    <Typography
      variant='body1'
      component='code'
      sx={{
        backgroundColor: 'grey.light4',
        px: 0.75,
        py: 0.25,
        borderRadius: '8px',
        fontFamily: 'monospace',
        // fontSize: '0.92em',
        lineHeight: 1.7,
        border: ({ palette }) => `1px solid ${palette.grey.light2 as string}`
      }}
    >
      {children}
    </Typography>
  )

export const CustomPre: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <Box
    component='pre'
    sx={{
      my: 3,
      p: 2.5,
      overflowX: 'auto',
      borderRadius: '20px',
      backgroundColor: 'grey.light4',
      border: ({ palette }) => `1px solid ${palette.grey.light2 as string}`,
      '& code': {
        backgroundColor: 'transparent',
        border: 'none',
        p: 0,
        fontSize: '0.92rem',
        lineHeight: 1.75
      }
    }}
  >
    {children}
  </Box>
)

export const CustomBlockquote: React.FC<{ children: ReactNode }> = ({
  children
}) => (
  <Box
    component='blockquote'
    sx={{
      my: 3,
      mx: 0,
      px: 2.5,
      py: 1.5,
      borderLeft: ({ palette }) => `4px solid ${palette.primary.main}`,
      backgroundColor: 'background.secondary',
      borderRadius: '0 16px 16px 0',
      '& p': {
        color: 'text.disabled',
        my: 0
      },
      '& code': {
        color: 'text.primary'
      }
    }}
  >
    {children}
  </Box>
)

export const CustomTable: React.FC<{ children: ReactNode }> = ({
  children
}) => (
  <TableContainer
    sx={{
      my: 3,
      borderRadius: '20px',
      border: ({ palette }) => `1px solid ${palette.grey.light2 as string}`,
      overflow: 'hidden'
    }}
  >
    <Table>{children}</Table>
  </TableContainer>
)

export const CustomTableHead: React.FC<{ children: ReactNode }> = ({
  children
}) => <TableHead sx={{ backgroundColor: 'grey.light4' }}>{children}</TableHead>

export const CustomTableRow: React.FC<{ children: ReactNode }> = ({
  children
}) => <TableRow>{children}</TableRow>

export const CustomTableCell: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <TableCell
    sx={{
      py: 1.5,
      fontSize: '0.95rem',
      verticalAlign: 'top',
      borderColor: 'grey.light2'
    }}
  >
    {translateNode(children)}
  </TableCell>
)

export const CustomTableHeadCell: React.FC<{
  children: ReactNode
}> = ({ children }) => (
  <TableCell
    component='th'
    sx={{
      py: 1.5,
      fontSize: '0.82rem',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'text.disabled',
      borderColor: 'grey.light2'
    }}
  >
    {translateNode(children)}
  </TableCell>
)

export const MDXComponents = {
  p: CustomParagraph,
  li: CustomLi,
  ul: CustomUl,
  ol: CustomOl,
  a: CustomLink,
  strong: CustomStrong,
  code: CustomCode,
  pre: CustomPre,
  blockquote: CustomBlockquote,
  h1: getMarkdownHeaderComponent(1),
  h2: getMarkdownHeaderComponent(2),
  h3: getMarkdownHeaderComponent(3),
  h4: getMarkdownHeaderComponent(4),
  h5: getMarkdownHeaderComponent(5),
  h6: getMarkdownHeaderComponent(6),
  table: CustomTable,
  thead: CustomTableHead,
  tbody: TableBody,
  tr: CustomTableRow,
  td: CustomTableCell,
  th: CustomTableHeadCell
}
