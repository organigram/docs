import i18next, { type TFunction as I18nextTFunction } from 'i18next'

export type TFunction = (
  key: string,
  interpolation?: Record<string, string>
) => string

const stripDoNotTranslateMarker = (value: string): string =>
  value.replaceAll('++dnt++', '')

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim()

const translateRaw = (
  key: string,
  interpolation?: Record<string, string>
): string =>
  (i18next.t as I18nextTFunction)(key, interpolation ?? {}) ?? key

export const t: TFunction = (key, interpolation) => {
  const directTranslation = translateRaw(key, interpolation)
  if (directTranslation !== key) {
    return stripDoNotTranslateMarker(directTranslation)
  }

  const normalizedKey = normalizeWhitespace(key)
  if (normalizedKey !== key && normalizedKey !== '') {
    const normalizedTranslation = translateRaw(normalizedKey, interpolation)
    if (normalizedTranslation !== normalizedKey) {
      const leadingWhitespace = key.match(/^\s+/)?.[0] ?? ''
      const trailingWhitespace = key.match(/\s+$/)?.[0] ?? ''
      return stripDoNotTranslateMarker(
        `${leadingWhitespace}${normalizedTranslation}${trailingWhitespace}`
      )
    }
  }

  return stripDoNotTranslateMarker(key)
}
