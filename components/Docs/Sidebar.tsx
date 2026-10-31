import { forwardRef, type HTMLAttributes } from 'react'
import { mobileNavHeight, navHeight } from '@organigram/react'
import { useRouter } from 'next/router'
import i18next from 'i18next'
import Drawer from '@mui/material/Drawer'
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView'
import {
  TreeItem,
  useTreeItemState,
  type TreeItemContentProps
} from '@mui/x-tree-view/TreeItem'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import { type FileTree } from '../../types'
import { t } from '../../lib/i18n'
import { compareTrees, getDocsSlug, getTreeLabel } from '../../lib/mdx'
import { useBreakpoint } from '../../lib/client'

export type SetOpen = (value: boolean) => void

export const docsSidebarWidth = { xs: '100%', sm: '280px' }

const DocsSidebar: React.FC<{
  trees: FileTree[]
  open: boolean
  setOpen: SetOpen
}> = ({ trees, open, setOpen }) => {
  return (
    <Grid
      sx={{
        overflowY: 'auto',
        overflowX: 'hidden',
        height: 'calc(100% - 50px)'
      }}
      width={docsSidebarWidth}
      mt={[
        mobileNavHeight.toString() + 'px',
        (navHeight / 2).toString() + 'px'
      ]}
      pb={[0, 4]}
      borderRight={open ? 'solid 1px #E5E5E5' : 'none'}
    >
      <Drawer
        open={open}
        variant='persistent'
        anchor='left'
        sx={{
          '& .MuiDrawer-paper': {
            position: 'sticky',
            bottom: 0,
            width: docsSidebarWidth,
            zIndex: 999,
            border: 'none',
            backgroundColor: 'background.default'
          }
        }}
      >
        <SimpleTreeView
          sx={{
            py: 1,
            pb: 3
          }}
          slots={{
            expandIcon: ChevronRightIcon,
            collapseIcon: ExpandMoreIcon
          }}
          defaultExpandedItems={getTreeIds(trees)}
        >
          {trees
            .sort(compareTrees)
            .map(tree => (
              <FileTreeItem
                key={
                  (tree.path as string) + (tree.children != null ? '' : '-node')
                }
                setOpen={setOpen}
                tree={tree}
              />
            ))}
        </SimpleTreeView>
      </Drawer>
    </Grid>
  )
}

export default DocsSidebar

const FileTreeItem: React.FC<{
  tree: FileTree
  setOpen: SetOpen
}> = ({ tree, setOpen }) => (
  <TreeItem
    ContentComponent={CustomContent}
    ContentProps={{ setOpen } as HTMLAttributes<HTMLElement>}
    sx={{
      mt: 1,
      '& > .MuiTreeItem-groupTransition': {
        mt: 0.5
      },
      '.MuiTreeItem-label': {
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        overflow: 'hidden'
      }
    }}
    itemId={(tree.path as string) + (tree.children != null ? '' : '-node')}
    label={getTreeLabel(tree)}
  >
    {tree.children
      ?.sort(compareTrees)
      ?.filter(
        child =>
          !(
            child.path?.endsWith('index.mdx') === true && child.children == null
          )
      )
      ?.map(child => (
        <FileTreeItem
          key={(child.path as string) + (child.children != null ? '' : '-node')}
          setOpen={setOpen}
          tree={child}
        />
      ))}
  </TreeItem>
)

const getTreeIds: (trees: FileTree[]) => string[] = trees => {
  const arr: string[] = []
  trees.forEach(tree => {
    const decimals = tree.metadata?.order?.toString()?.replace('.', '')?.length
    if (decimals != null && decimals < 3) {
      arr.push(tree.path as string)
      if (tree.children != null) {
        arr.push(...getTreeIds(tree.children))
      }
    }
  })
  return arr
}

const CustomContent = forwardRef(function CustomContent(
  props: TreeItemContentProps,
  ref
) {
  const {
    label,
    itemId,
    icon: iconProp,
    expansionIcon,
    displayIcon,
    setOpen
  } = props as TreeItemContentProps & { setOpen: SetOpen }
  const { handleExpansion, handleSelection } = useTreeItemState(itemId)
  const { asPath, push } = useRouter()
  const selected = asPath.slice(8) === itemId.slice(0, -9)
  const path = itemId.replace('-node', '')
  const icon = iconProp ?? expansionIcon ?? displayIcon
  const isSection = icon != null
  const isTabletOrAbove = useBreakpoint('sm')

  return (
    <div ref={ref as React.Ref<HTMLDivElement>}>
      <Grid container alignItems='center' justifyContent='space-between' px={3}>
        <Button
          component='div'
          aria-current={selected ? 'page' : undefined}
          onClick={e => {
            handleSelection(e)
            if (!isTabletOrAbove) setOpen(false)
            push(
              `/${i18next.language}/docs/${getDocsSlug(path)}`
            )
          }}
          sx={{
            px: 1,
            py: isSection ? 0.75 : 0.5,
            minHeight: 0,
            width: isSection ? 'calc(100% - 28px)' : '100%',
            justifyContent: 'flex-start',
            borderRadius: '6px',
            borderLeft: ({ palette }) =>
              `3px solid ${
                selected ? (palette.primary.main as string) : 'transparent'
              }`,
            backgroundColor: selected ? 'primary.light4' : 'transparent',
            '&:hover': {
              backgroundColor: selected ? 'primary.light4' : 'grey.light4'
            }
          }}
        >
          <Typography
            color={selected ? 'primary' : 'inherit'}
            fontWeight={isSection ? 700 : selected ? 700 : 500}
            fontSize={isSection ? ['12px', '11px'] : ['17px', '14px']}
            letterSpacing={isSection ? '0.08em' : 'normal'}
            textTransform={isSection ? 'uppercase' : 'none'}
          >
            {t(label as string)}
          </Typography>
        </Button>
        {isSection && (
          <Button
            component='div'
            aria-label={t('Toggle documentation section')}
            onClick={e => {
              handleExpansion(e)
            }}
            sx={{ minWidth: 28, width: 28, height: 28, p: 0 }}
          >
            {icon}
          </Button>
        )}
      </Grid>
    </div>
  )
})
