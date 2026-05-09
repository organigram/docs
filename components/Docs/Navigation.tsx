import { useRouter } from 'next/router'
import i18next from 'i18next'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import EditIcon from '@mui/icons-material/Edit'

import Link from '../Link'
import { useBreakpoint } from '../../lib/client'
import { t } from '../../lib/i18n'
import { type FileTree } from '../../types'

const DocsNavigation: React.FC<{ trees: FileTree[]; current?: FileTree }> = ({
  trees,
  current
}) => {
  const { push } = useRouter()
  const orderedTrees = orderTrees(trees)
  const currentIndex = current == null ? -1 : orderedTrees.indexOf(current)
  const previous = currentIndex < 0 ? undefined : orderedTrees[currentIndex - 1]
  const next = currentIndex < 0 ? undefined : orderedTrees[currentIndex + 1]
  const isTabletOrAbove = useBreakpoint('sm')

  return (
    <>
      {current?.path != null && (
        <Link
          href={`https://github.com/organigram/docs/edit/master/mdx${current.path}`}
          target='_blank'
          rel='noreferrer'
        >
          <Grid container mt={5} mb={4}>
            <EditIcon style={{ marginRight: '8px' }} />
            <Typography>{t('Edit this page')}</Typography>
          </Grid>
        </Link>
      )}
      <Grid
        container
        justifyContent='space-between'
        flexDirection={isTabletOrAbove ? 'row' : 'column-reverse'}
        mt={3}
        mb={[3, 8]}
      >
        <Grid item xs={12} sm={5.9} mt={isTabletOrAbove ? 0 : 1}>
          {previous != null && (
            <Button
              onClick={() => {
                push(
                  `/${i18next.language}/docs/${
                    (previous?.path?.endsWith('index.mdx') === true
                      ? previous?.path?.slice(1, -9)
                      : previous?.path?.slice(1, -4)) as string
                  }`
                )
              }}
              variant='outlined'
              fullWidth
              sx={{ borderRadius: '8px', textTransform: 'none' }}
            >
              <Grid container flexDirection='column' alignItems='flex-start'>
                <Grid item>{t('Previous')}</Grid>
                <Grid item sx={{ textAlign: 'left' }}>
                  {'<<'} {t(previous?.metadata?.title as string)}
                </Grid>
              </Grid>
            </Button>
          )}
        </Grid>
        <Grid item xs={12} sm={5.9}>
          {next != null && (
            <Button
              onClick={() => {
                push(
                  `/${i18next.language}/docs/${
                    (next?.path?.endsWith('index.mdx') === true
                      ? next?.path?.slice(1, -9)
                      : next?.path?.slice(1, -4)) as string
                  }`
                )
              }}
              variant='outlined'
              fullWidth
              sx={{ borderRadius: '8px', textTransform: 'none' }}
            >
              <Grid container flexDirection='column' alignItems='flex-end'>
                <Grid item>{t('Next')}</Grid>
                <Grid item sx={{ textAlign: 'right' }}>
                  {t(next?.metadata?.title as string)} {'>>'}
                </Grid>
              </Grid>
            </Button>
          )}
        </Grid>
      </Grid>
    </>
  )
}

export default DocsNavigation

const orderTrees: (trees: FileTree[]) => FileTree[] = trees => {
  const orderedList: FileTree[] = []
  trees
    .sort((a, b) =>
      (a.metadata?.order ?? 0) < (b.metadata?.order ?? 0) ? -1 : 1
    )
    .forEach(tree => {
      if (tree.metadata != null && tree.metadata.title !== '') {
        orderedList.push(tree)
        if (tree.children != null) {
          orderedList.push(...orderTrees(tree.children))
        }
      }
    })
  return orderedList.filter((tree, i, arr) => arr[i - 1]?.path !== tree.path)
}
