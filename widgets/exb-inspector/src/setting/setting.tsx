/** @jsx jsx */
/** @jsxFrag React.Fragment */
import { React, jsx, type AllWidgetSettingProps } from 'jimu-core'
import { SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import { Typography } from 'jimu-ui'
import type { IMConfig } from '../types'

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  void props
  return (
    <div className='widget-setting-layer-id-inspector p-2'>
      <SettingSection title='Experience ID Inspector'>
        <SettingRow>
          <Typography variant='body2'>
            No settings. Use the widget on the canvas: choose <strong>Layers</strong> or <strong>Widgets</strong>, and pick a map when inspecting layer IDs.
          </Typography>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
