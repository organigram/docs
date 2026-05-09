import i18next, { type TFunction as I18nextTFunction } from 'i18next'

export type TFunction = (
  key: string,
  interpolation?: Record<string, string>
) => string

export const t: TFunction = (key, interpolation) =>
  (i18next.t as I18nextTFunction)(key, interpolation ?? {})?.replace?.(
    '++dnt++',
    ''
  ) ?? key?.replace?.('++dnt++', '')
