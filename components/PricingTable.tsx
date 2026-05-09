import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import { t } from '../lib/i18n'
import type { PublicPricingResponse } from '../lib/pricing'
import generatedPublicPricing from '../lib/generatedPricing.json' with { type: 'json' }

const PricingTable: React.FC = () => {
  const pricing = generatedPublicPricing as PublicPricingResponse | null

  if (pricing == null) {
    return (
      <Alert severity='warning' sx={{ my: 3 }}>
        {t('Unable to load build-time pricing for this documentation page.')}
      </Alert>
    )
  }

  return (
    <Table sx={{ my: 3 }}>
      <TableHead>
        <TableRow>
          <TableCell>{t('Service')}</TableCell>
          <TableCell>{t('Current price')}</TableCell>
          <TableCell>{t('Notes')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {pricing.items.map(item => (
          <TableRow key={item.key}>
            <TableCell>{t(item.label)}</TableCell>
            <TableCell>{item.price}</TableCell>
            <TableCell>{item.details != null ? t(item.details) : ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default PricingTable
