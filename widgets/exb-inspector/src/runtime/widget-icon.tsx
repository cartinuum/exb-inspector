/** @jsx jsx */
/** @jsxFrag React.Fragment */
import { React, jsx } from 'jimu-core'

/**
 * Renders author icon from widget JSON when possible; otherwise a letter fallback.
 */
export function WidgetIcon (props: {
  icon: any
  manifestName: string
}): React.ReactElement {
  const { icon, manifestName } = props
  const letter = (manifestName?.charAt(0) ?? '?').toUpperCase()

  if (typeof icon === 'string' && icon.trim().length > 0) {
    return <img src={icon} alt='' className='layer-id-inspector-wicon-img' />
  }
  if (icon && typeof icon === 'object') {
    const svg = (icon as any).svg
    if (typeof svg === 'string' && svg.trim().length > 0) {
      return (
        <span
          className='layer-id-inspector-wicon-svg'
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )
    }
  }

  return (
    <div className='layer-id-inspector-wicon-fallback' aria-hidden title={manifestName}>
      {letter}
    </div>
  )
}
