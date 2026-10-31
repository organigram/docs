import Card from '@mui/material/Card'
import { Diagram, type DiagramProps } from '@organigram/react'
import { Organigram, type OrganigramJson } from '@organigram/js'

import { t } from '../lib/i18n'

const Minimap: React.FC<{
  organigram?: OrganigramJson | Organigram
  direction?: string
  height?: number | string
  diagramProps?: Partial<DiagramProps>
}> = ({ organigram, direction, height = 360, diagramProps }) => {
  if (organigram == null) return null
  const parsed =
    organigram instanceof Organigram ? organigram : new Organigram(organigram)
  const {
    style: diagramStyle,
    options: diagramOptions,
    ...restDiagramProps
  } = diagramProps ?? {}
  const zoomOnScroll = diagramOptions?.zoomOnScroll ?? false
  const fitViewOptions = diagramOptions?.fitViewOptions ?? {}

  return (
    <Card
      sx={{
        mt: 2,
        width: '100%',
        maxWidth: '100%',
        height,
        minHeight: height,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        '& .react-flow': {
          maxWidth: '100%'
        }
      }}
    >
      <Diagram
        direction={direction ?? 'TB'}
        organigram={parsed}
        style={{
          height: '100%',
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          ...diagramStyle
        }}
        options={{
          ...diagramOptions,
          zoomOnScroll,
          preventScrolling: zoomOnScroll,
          fitViewOptions: {
            padding: 0.2,
            ...fitViewOptions
          }
        }}
        onClickAsset={() => {}}
        onClickOrgan={() => {}}
        onClickProcedure={() => {}}
        translateLabel={t}
        {...restDiagramProps}
      />
    </Card>
  )
}

export default Minimap
