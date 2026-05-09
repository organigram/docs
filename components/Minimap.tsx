import Card from '@mui/material/Card'
import { Diagram, type DiagramProps } from '@organigram/react'
import { Organigram, type OrganigramJson } from '@organigram/js'

const Minimap: React.FC<{
  organigram?: OrganigramJson | Organigram
  direction?: string
  diagramProps?: DiagramProps
}> = ({ organigram, direction, diagramProps }) => {
  if (organigram == null) return null
  const parsed = organigram instanceof Organigram ? organigram : new Organigram(organigram)

  return (
    <Card sx={{ mt: 2, width: '100%', height: '600px' }}>
      <Diagram
        direction={direction ?? 'TB'}
        organigram={parsed}
        style={{ height: '100%', width: '100%' }}
        options={{ zoomOnScroll: false }}
        onClickAsset={() => {}}
        onClickOrgan={() => {}}
        onClickProcedure={() => {}}
        {...diagramProps}
      />
    </Card>
  )
}

export default Minimap
