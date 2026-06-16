import Card from '@mui/material/Card'
import { Diagram, type DiagramProps } from '@organigram/react'
import { Organigram, type OrganigramJson } from '@organigram/js'

const Minimap: React.FC<{
  organigram?: OrganigramJson | Organigram
  direction?: string
  diagramProps?: Partial<DiagramProps>
}> = ({ organigram, direction, diagramProps }) => {
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
        height: '100%',
        minHeight: 360,
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
        {...restDiagramProps}
      />
    </Card>
  )
}

export default Minimap
