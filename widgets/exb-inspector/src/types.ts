import type { ImmutableObject } from 'jimu-core'

/** No persisted settings; map selection is session-only in the runtime widget */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Config {}

export type IMConfig = ImmutableObject<Config>

export interface LayerTableRow {
  depth: number
  title: string
  layerType: string
  id: string
  url: string | null
}

/** Injected via `mapExtraStateProps` on the widget (Redux `IMState`) */
export interface InspectorExtraProps {
  inspectorAppConfig?: any
  inspectorPageId?: string
}
