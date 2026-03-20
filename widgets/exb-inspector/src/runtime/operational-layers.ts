import type { JimuMapView } from 'jimu-arcgis'
import type { LayerTableRow } from '../types'

function getLayerServiceUrl (layer: any): string | null {
  const u = layer?.url
  if (typeof u === 'string' && u.trim().length > 0) return u
  return null
}

/**
 * Experience Builder identifies layers with a data source prefix (e.g. `dataSource_1-Layer_Name`).
 * The JS API `layer.id` is often only the suffix. Prefer JimuMapView when available.
 */
function getDisplayLayerId (jimuMapView: JimuMapView | null, layer: any): string {
  const fallback = layer?.id != null ? String(layer.id) : ''
  if (!jimuMapView || !layer) return fallback
  try {
    const dsId = jimuMapView.getDataSourceIdByAPILayer(layer)
    if (typeof dsId === 'string' && dsId.trim().length > 0) {
      return dsId
    }
  } catch {
    // Group or unsupported layer types may throw; use API id
  }
  return fallback
}

/**
 * Lists operational layers from map.layers only (not basemap), preserving order and group nesting.
 * @param jimuMapView Used to resolve ExB data source IDs; pass null to use API layer.id only.
 */
export function buildOperationalLayerRows (map: any, jimuMapView: JimuMapView | null): LayerTableRow[] {
  const rows: LayerTableRow[] = []
  const layers = map?.layers
  if (!layers?.forEach) return rows

  const walk = (collection: any, depth: number) => {
    collection.forEach((layer: any) => {
      const title = (layer?.title ?? '(untitled)') as string
      const layerType = (layer?.type ?? 'layer') as string
      const id = getDisplayLayerId(jimuMapView, layer)
      const url = getLayerServiceUrl(layer)
      rows.push({ depth, title, layerType, id, url })

      const nested =
        layer?.layers?.forEach &&
        (layer.type === 'group' || layer.type === 'subtype-group')
      if (nested) {
        walk(layer.layers, depth + 1)
      }
    })
  }

  walk(layers, 0)
  return rows
}
