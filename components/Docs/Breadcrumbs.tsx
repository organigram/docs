import MuiBreadcrumbs from '@mui/material/Breadcrumbs'
import Typography from '@mui/material/Typography'

import Link from '../Link'
import { t } from '../../lib/i18n'
import { findTreeTrail, getDocsSlug, getTreeLabel } from '../../lib/mdx'
import { type FileTree } from '../../types'

type Crumb = { label: string, href?: string }

const docsHomePath = '/introduction/index.mdx'

const isIndexPage = (tree: FileTree): boolean =>
  tree.children == null && tree.path?.endsWith('/index.mdx') === true

// The folders leading to the current page, each linked to its index page. A
// folder's index page is the folder itself: it does not repeat it.
const getCrumbs = (trees: FileTree[], current: FileTree): Crumb[] => {
  const trail = findTreeTrail(trees, current) ?? []
  const pages =
    trail.length > 1 && isIndexPage(current) ? trail.slice(0, -1) : trail
  return pages.map((tree, index) => {
    const indexPage = tree.children?.find(isIndexPage)
    return {
      label: t(getTreeLabel(tree) ?? ''),
      href:
        index === pages.length - 1 || indexPage?.path == null
          ? undefined
          : `/docs/${getDocsSlug(indexPage.path)}`
    }
  })
}

const DocsBreadcrumbs: React.FC<{ trees: FileTree[], current?: FileTree }> = ({
  trees,
  current
}) => {
  const crumbs: Crumb[] = [
    {
      label: t('Documentation'),
      href: current?.path === docsHomePath ? undefined : `/docs/${getDocsSlug(docsHomePath)}`
    },
    ...(current == null ? [] : getCrumbs(trees, current))
  ]

  return (
    <MuiBreadcrumbs
      aria-label={t('Breadcrumb')}
      separator='›'
      sx={{
        mb: 1,
        fontSize: '14px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        '& .MuiBreadcrumbs-separator': { color: 'grey.main', mx: 0.75 }
      }}
    >
      {crumbs.map(({ label, href }, index) =>
        href == null || index === crumbs.length - 1 ? (
          <Typography
            key={label}
            component='span'
            fontSize='inherit'
            fontWeight='inherit'
            color='grey.main'
            aria-current={index === crumbs.length - 1 ? 'page' : undefined}
          >
            {label}
          </Typography>
        ) : (
          <Link key={label} href={href}>
            <Typography
              component='span'
              fontSize='inherit'
              fontWeight='inherit'
              color='primary.main'
            >
              {label}
            </Typography>
          </Link>
        )
      )}
    </MuiBreadcrumbs>
  )
}

export default DocsBreadcrumbs
