import { type CSSProperties, type PropsWithChildren, type SyntheticEvent } from 'react'
import NextLink, { type LinkProps as NextLinkProps } from 'next/link'
import i18next from 'i18next'

const isExternal = (href: string): boolean =>
  href.slice(0, 7) === 'http://' ||
  href.slice(0, 8) === 'https://' ||
  href.slice(0, 7) === 'mailto:'

const isPublic = (href: string): boolean => href.slice(0, 8) === '/images/'

type LinkProps = PropsWithChildren<
  Omit<NextLinkProps, 'href'> & {
  href: string
  target?: string
  rel?: string
  onClick?: (event: SyntheticEvent) => void
  style?: CSSProperties
  }
>

const Link: React.FC<LinkProps> = ({
  href,
  onClick,
  shallow,
  target,
  rel,
  style,
  children,
  ...props
}) => {
  const localizedHref =
    isPublic(href) || isExternal(href)
      ? href
      : `/${i18next.language?.slice(0, 2) ?? 'en'}${href}`

  return isExternal(href) || target === '_blank' ? (
    <a
      {...props}
      href={localizedHref}
      onClick={onClick}
      target={target}
      rel={rel ?? 'noopener noreferrer'}
      style={{
        width: 'auto',
        textDecoration: 'inherit',
        color: 'inherit',
        ...style
      }}
    >
      {children}
    </a>
  ) : (
    <NextLink
      {...props}
      href={localizedHref}
      onClick={onClick}
      target={target}
      rel={rel}
      shallow={shallow !== false}
      passHref
      style={{
        textDecoration: 'none',
        color: 'inherit',
        width: 'auto',
        ...style
      }}
    >
      {children}
    </NextLink>
  )
}

export default Link
