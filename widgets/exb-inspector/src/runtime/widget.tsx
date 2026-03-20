/** @jsx jsx */
/** @jsxFrag React.Fragment */
import { React, jsx, type AllWidgetProps, type IMState } from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { Alert, Button, Label, Option, Paper, Select, Typography, Nav, NavItem, NavLink } from 'jimu-ui'
import { CopyOutlined } from 'jimu-icons/outlined/editor/copy'
import { LaunchOutlined } from 'jimu-icons/outlined/editor/launch'
import type { IMConfig, InspectorExtraProps, LayerTableRow } from '../types'
import { buildOperationalLayerRows } from './operational-layers'
import {
  collectWidgetIdsOnPage,
  getMapWidgetIdsOnPage,
  getWidgetMeta,
  sortWidgetIdsByLabel
} from './page-widgets'
import { WidgetIcon } from './widget-icon'
import './widget.css'

type MainTab = 'layers' | 'widgets'

async function copyToClipboard (text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

function isBuilderEnvironment (): boolean {
  if (typeof window === 'undefined') return false
  return (window as any).jimuConfig?.isInBuilder === true
}

function resolvePageId (props: AllWidgetProps<IMConfig> & InspectorExtraProps): string {
  const fromProps = (props as any).pageId as string | undefined
  const fromExtra = props.inspectorPageId
  return (fromProps || fromExtra || '') as string
}

function Widget (props: AllWidgetProps<IMConfig> & InspectorExtraProps) {
  const pageId = resolvePageId(props)
  const appConfig = props.inspectorAppConfig

  const [mainTab, setMainTab] = React.useState<MainTab>('layers')
  const [mapWidgetId, setMapWidgetId] = React.useState<string>('')
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView | null>(null)
  const [layerRows, setLayerRows] = React.useState<LayerTableRow[]>([])
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  const mapIdsOnPage = React.useMemo(() => {
    if (!pageId || !appConfig) return [] as string[]
    const ids = getMapWidgetIdsOnPage(appConfig, pageId)
    return sortWidgetIdsByLabel(appConfig, ids)
  }, [appConfig, pageId])

  const widgetIdsOnPage = React.useMemo(() => {
    if (!pageId || !appConfig) return [] as string[]
    const ids = collectWidgetIdsOnPage(appConfig, pageId)
    return sortWidgetIdsByLabel(appConfig, ids)
  }, [appConfig, pageId])

  /** Session-only: default to first map (alphabetically by label) when valid maps exist */
  React.useEffect(() => {
    if (mainTab !== 'layers') return
    if (mapIdsOnPage.length === 0) {
      setMapWidgetId('')
      return
    }
    if (!mapWidgetId || !mapIdsOnPage.includes(mapWidgetId)) {
      setMapWidgetId(mapIdsOnPage[0])
    }
  }, [mainTab, mapIdsOnPage, mapWidgetId])

  React.useEffect(() => {
    if (mainTab !== 'layers') {
      return
    }
    if (!mapWidgetId) {
      setLayerRows([])
      return
    }
    const map = jimuMapView?.view?.map as any
    if (!map || !jimuMapView) {
      setLayerRows([])
      return
    }
    const refresh = () => {
      setLayerRows(buildOperationalLayerRows(map, jimuMapView))
    }
    refresh()
    let cancelled = false
    const loaded = jimuMapView.whenAllJimuLayerViewLoaded?.()
    if (loaded?.then) {
      loaded
        .then(() => {
          if (!cancelled) refresh()
        })
        .catch(() => {})
    }
    const allLayers = map.allLayers
    const handle = allLayers?.on?.('change', refresh)
    return () => {
      cancelled = true
      handle?.remove?.()
    }
  }, [jimuMapView, mapWidgetId, mainTab])

  const markCopied = (key: string) => {
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 1500)
  }

  const onCopyText = (key: string, text: string) => {
    if (!text) return
    void copyToClipboard(text).then((ok) => {
      if (ok) markCopied(key)
    })
  }

  const inBuilder = isBuilderEnvironment()

  if (!inBuilder) {
    return (
      <div className='widget-layer-id-inspector jimu-widget p-2'>
        <Alert type='info' withIcon>
          Experience ID Inspector is intended for use in Experience Builder only (Design mode).
        </Alert>
      </div>
    )
  }

  return (
    <div className='widget-layer-id-inspector jimu-widget p-2'>
      <Nav tabs className='layer-id-inspector-nav-tabs mb-2' role='tablist'>
        <NavItem>
          <NavLink
            active={mainTab === 'layers'}
            onClick={() => setMainTab('layers')}
            role='tab'
            aria-selected={mainTab === 'layers'}
          >
            Layers
          </NavLink>
        </NavItem>
        <NavItem>
          <NavLink
            active={mainTab === 'widgets'}
            onClick={() => setMainTab('widgets')}
            role='tab'
            aria-selected={mainTab === 'widgets'}
          >
            Widgets
          </NavLink>
        </NavItem>
      </Nav>

      {mainTab === 'layers' && (
        <div className='layer-id-inspector-tab-panel' role='tabpanel'>
          {mapIdsOnPage.length === 0 ? (
            <>
              <Alert type='warning' withIcon className='mb-2'>
                No map widgets on this page. Add a map to inspect operational layer IDs.
              </Alert>
              <Typography variant='body2' color='paperHint' className='layer-id-inspector-empty'>
                No layers to show.
              </Typography>
            </>
          ) : (
            <>
              <div className='layer-id-inspector-map-select mb-2'>
                <Label className='layer-id-inspector-map-label mb-1'>
                  Map
                </Label>
                <Select
                  size='sm'
                  value={mapWidgetId}
                  onChange={(e) => {
                    setMapWidgetId(e.target.value)
                  }}
                  aria-label='Select map widget'
                >
                  {mapIdsOnPage.map((wid) => {
                    const meta = appConfig ? getWidgetMeta(appConfig, wid) : getWidgetMeta({}, wid)
                    return (
                      <Option key={wid} value={wid} title={wid}>
                        {meta.label} ({wid})
                      </Option>
                    )
                  })}
                </Select>
              </div>

              {mapWidgetId ? (
                <div className='layer-id-inspector-map-bridge' aria-hidden>
                  <JimuMapViewComponent
                    useMapWidgetId={mapWidgetId}
                    onActiveViewChange={(jmv) => {
                      setJimuMapView(jmv)
                    }}
                  />
                </div>
              ) : null}

              <Typography variant='h6' component='h2' className='layer-id-inspector-heading'>
                Operational layers
              </Typography>

              <div className='layer-id-inspector-scroll'>
                {layerRows.length > 0 ? (
                  <div className='layer-id-inspector-list' role='list'>
                    {layerRows.map((row, i) => {
                      const copyKey = `layer:${i}:${row.id}`
                      return (
                        <Paper
                          key={`${row.id}-${i}`}
                          variant='outlined'
                          className='layer-id-inspector-card'
                          role='listitem'
                        >
                          <div
                            className='layer-id-inspector-card-block'
                            style={{ paddingLeft: 14 + row.depth * 10 }}
                          >
                            <div className='layer-id-inspector-row-top'>
                              <Typography
                                variant='body1'
                                component='div'
                                className='layer-id-inspector-title'
                                title={row.title}
                              >
                                {row.title}
                              </Typography>
                              <div className='layer-id-inspector-trailing'>
                                <span className='layer-id-inspector-type-chip'>{row.layerType}</span>
                                {row.url ? (
                                  <Button
                                    tag='a'
                                    href={row.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    icon
                                    type='secondary'
                                    size='sm'
                                    className='layer-id-inspector-open-btn'
                                    aria-label='Open layer service in new tab'
                                    title='Open in new tab'
                                  >
                                    <LaunchOutlined />
                                  </Button>
                                ) : null}
                              </div>
                            </div>

                            <div className='layer-id-inspector-code-wrap'>
                              <div className='layer-id-inspector-code-inner'>
                                <Typography
                                  variant='body2'
                                  component='div'
                                  className='layer-id-inspector-code-text'
                                  noWrap
                                  title={row.id || undefined}
                                >
                                  {row.id || '—'}
                                </Typography>
                                <Button
                                  icon
                                  type='secondary'
                                  size='sm'
                                  className='layer-id-inspector-copy-btn'
                                  aria-label='Copy layer ID'
                                  title='Copy layer ID'
                                  disabled={!row.id}
                                  onClick={() => onCopyText(copyKey, row.id)}
                                >
                                  <CopyOutlined />
                                </Button>
                              </div>
                              {copiedKey === copyKey && row.id ? (
                                <Typography variant='caption' component='div' color='paperHint' className='layer-id-inspector-copied-hint'>
                                  Copied to clipboard
                                </Typography>
                              ) : null}
                            </div>
                          </div>
                        </Paper>
                      )
                    })}
                  </div>
                ) : (
                  <Typography variant='body2' color='paperHint' className='layer-id-inspector-empty'>
                    Waiting for map layers…
                  </Typography>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {mainTab === 'widgets' && (
        <div className='layer-id-inspector-tab-panel layer-id-inspector-widgets-panel' role='tabpanel'>
          <Typography variant='h6' component='h2' className='layer-id-inspector-heading'>
            Widgets on this page
          </Typography>
          <div className='layer-id-inspector-scroll'>
            {widgetIdsOnPage.length > 0 ? (
              <div className='layer-id-inspector-list' role='list'>
                {widgetIdsOnPage.map((wid, i) => {
                  const meta = appConfig ? getWidgetMeta(appConfig, wid) : getWidgetMeta({}, wid)
                  const copyKey = `widget:${i}:${wid}`
                  return (
                    <Paper
                      key={`${wid}-${i}`}
                      variant='outlined'
                      className='layer-id-inspector-card layer-id-inspector-widget-card'
                      role='listitem'
                    >
                      <div className='layer-id-inspector-card-block layer-id-inspector-widget-row'>
                        <div className='layer-id-inspector-wicon'>
                          <WidgetIcon icon={meta.icon} manifestName={meta.manifestName} />
                        </div>
                        <div className='layer-id-inspector-widget-text'>
                          <div className='layer-id-inspector-row-top layer-id-inspector-widget-title-row'>
                            <Typography
                              variant='body1'
                              component='div'
                              className='layer-id-inspector-title'
                              title={meta.label}
                            >
                              {meta.label}
                            </Typography>
                            <span className='layer-id-inspector-type-chip'>{meta.manifestName}</span>
                          </div>
                          <div className='layer-id-inspector-code-wrap'>
                            <div className='layer-id-inspector-code-inner'>
                              <Typography
                                variant='body2'
                                component='div'
                                className='layer-id-inspector-code-text'
                                noWrap
                                title={meta.widgetId}
                              >
                                {meta.widgetId}
                              </Typography>
                              <Button
                                icon
                                type='secondary'
                                size='sm'
                                className='layer-id-inspector-copy-btn'
                                aria-label='Copy widget ID'
                                title='Copy widget ID'
                                onClick={() => onCopyText(copyKey, meta.widgetId)}
                              >
                                <CopyOutlined />
                              </Button>
                            </div>
                            {copiedKey === copyKey ? (
                              <Typography variant='caption' component='div' color='paperHint' className='layer-id-inspector-copied-hint'>
                                Copied to clipboard
                              </Typography>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </Paper>
                  )
                })}
              </div>
            ) : (
              <Typography variant='body2' color='paperHint' className='layer-id-inspector-empty'>
                No widgets found for this page.
              </Typography>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

;(Widget as any).mapExtraStateProps = (state: IMState) => {
  const ar = state?.appRuntimeInfo as any
  const q = state?.queryObject as any
  return {
    inspectorAppConfig: state?.appConfig,
    inspectorPageId: ar?.currentPageId ?? ar?.pageId ?? q?.page
  }
}

export default Widget
