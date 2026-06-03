import { navHeight } from '@organigram/react'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'

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

  return (
    <Grid
      container
      item
      flexDirection='column'
      sx={{
        position: 'sticky',
        top: navHeight,
        overflowX: 'hidden',
        maxWidth: [tocWidthSm.toString() + 'px', tocWidthMd.toString() + 'px'],
        borderLeft: '1px solid #E5E5E5',
        mt: navHeight.toString() + 'px',
        pb: 4
      }}
    >
      <Grid>
        {headings.map(heading => (
          <Grid
            item
            sx={{
              pl: heading.type * 2,
              py: 0.5,
              width: [
                tocWidthSm.toString() + 'px',
                tocWidthMd.toString() + 'px'
              ]
            }}
            key={heading.text}
          >
            <Link
              href={heading.link}
              color={currentIndex === heading.link ? 'primary' : 'text.primary'}
              sx={{
                fontSize: '14px',
                fontWeight: '500',
                textDecoration: 'none',
                transition: 'color 0.1s',
                '&:hover': {
                  color: 'primary.main'
                }
              }}
            >
              {t(heading.text)}
            </Link>
          </Grid>
        ))}
      </Grid>
    </Grid>
  )
}

export default TableOfContents
