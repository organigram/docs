import { navHeight } from '@organigram/react'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'

import { useCurrentTocIndex } from '../../lib/mdx'
import { t } from '../../lib/i18n'

export interface Heading {
  text: string
  link: string
  type: number
}

export const tocWidthMd = 250
export const tocWidthSm = 200

const TableOfContents: React.FC<{ headings: Heading[] }> = ({ headings }) => {
  const currentIndex = useCurrentTocIndex(headings, navHeight)
  const isLongReference = headings.length > 20
  const referenceHeadings = headings.filter(heading => heading.type === 2)
  const pageHeadings = isLongReference ? referenceHeadings : headings

  const renderHeadings = (items: Heading[]) =>
    items.map(heading => {
      const selected = currentIndex === heading.link
      const indent = Math.max(heading.type - 2, 0) * 1.5
      const isReferenceEntry = heading.text.startsWith('function ')

      return (
        <Grid
          item
          sx={{
            pl: 3 + indent,
            pr: 2,
            py: isLongReference ? 0.25 : 0.5
          }}
          key={heading.text}
        >
          <Box
            sx={{
              ml: -1,
              px: 1,
              py: isLongReference ? 0.25 : 0.5,
              borderLeft: ({ palette }) =>
                `3px solid ${
                  selected ? (palette.primary.main as string) : 'transparent'
                }`,
              borderRadius: '0 4px 4px 0',
              backgroundColor: selected ? 'primary.light4' : 'transparent'
            }}
          >
            <Link
              href={heading.link}
              title={t(heading.text)}
              color={selected ? 'primary' : 'text.primary'}
              sx={{
                display: 'block',
                fontSize: isLongReference ? '13px' : '14px',
                fontWeight:
                  selected || (heading.type === 2 && !isReferenceEntry)
                    ? 700
                    : 500,
                lineHeight: 1.5,
                whiteSpace: isLongReference ? 'nowrap' : 'normal',
                overflow: isLongReference ? 'hidden' : 'visible',
                textOverflow: isLongReference ? 'ellipsis' : 'clip',
                textDecoration: 'none',
                transition: 'color 0.1s',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {t(heading.text)}
            </Link>
          </Box>
        </Grid>
      )
    })

  return (
    <Grid
      container
      item
      flexDirection='column'
      sx={{
        position: 'sticky',
        top: navHeight,
        height: `calc(100vh - ${navHeight}px)`,
        overflowX: 'hidden',
        maxWidth: [tocWidthSm.toString() + 'px', tocWidthMd.toString() + 'px'],
        borderLeft: '1px solid #E5E5E5',
        mt: navHeight.toString() + 'px',
        pt: 1.5,
        pb: 1
      }}
    >
      <Typography
        fontSize='14px'
        fontWeight={700}
        px={3}
        mb={1}
        sx={{ textDecoration: 'underline' }}
      >
        {t('On this page:')}
      </Typography>
      <Grid
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          pb: 2,
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: 3,
            backgroundColor: 'grey.light2'
          }
        }}
      >
        <Grid>{renderHeadings(pageHeadings)}</Grid>
      </Grid>
    </Grid>
  )
}

export default TableOfContents
