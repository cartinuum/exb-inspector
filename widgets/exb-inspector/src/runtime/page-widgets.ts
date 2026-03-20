/**
 * Walk app config for the current page to collect widget instance ids.
 * Uses deep Immutable→JS conversion, layout BFS, nested config walks, and a regex pass to
 * catch widget refs that nested Immutable structures can hide from plain object walks.
 */

function toPlain (obj: any): any {
  if (obj == null) return obj
  if (typeof obj.toJS === 'function') return obj.toJS()
  return obj
}

/** Fully unwrap Immutable (nested Maps/Lists) so layout/widget walks see plain objects. */
function deepToPlain (obj: any): any {
  if (obj == null) return obj
  if (typeof obj.toJS === 'function') return deepToPlain(obj.toJS())
  if (Array.isArray(obj)) return obj.map(deepToPlain)
  if (typeof obj === 'object') {
    const out: Record<string, any> = {}
    for (const k of Object.keys(obj)) {
      out[k] = deepToPlain(obj[k])
    }
    return out
  }
  return obj
}

function getConfigEntry (collection: any, id: string): any {
  if (collection == null || id == null) return undefined
  return collection.get?.(id) ?? collection[id]
}

/**
 * Widget-embedded layouts (`WidgetJson.layouts`): each entry is a SizeModeLayoutJson map.
 * Those maps were invisible to the old walker because string layout ids are leaf values.
 */
function extractLayoutIdsFromWidgetLayoutsProperty (node: any, out: Set<string>): void {
  const layouts = node?.layouts
  if (layouts == null || typeof layouts !== 'object' || Array.isArray(layouts)) return
  for (const inner of Object.values(layouts)) {
    if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) continue
    for (const v of Object.values(inner as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out.add(v)
    }
  }
}

function appendLayoutsFromSection (appConfig: any, sectionId: string, out: Set<string>): void {
  const section = deepToPlain(getConfigEntry(appConfig?.sections, sectionId))
  const viewIds: string[] = Array.isArray(section?.views) ? section.views : []
  const views = appConfig?.views
  if (!views) return
  for (const viewId of viewIds) {
    const view = deepToPlain(getConfigEntry(views, viewId))
    if (view) extractLayoutIdsFromNode(view, out)
  }
}

function appendLayoutsFromScreenGroup (appConfig: any, groupId: string, out: Set<string>): void {
  const group = deepToPlain(getConfigEntry(appConfig?.screenGroups, groupId))
  const screenIds: string[] = Array.isArray(group?.screens) ? group.screens : []
  const screens = appConfig?.screens
  if (!screens) return
  for (const sid of screenIds) {
    const screen = deepToPlain(getConfigEntry(screens, sid))
    if (!screen) continue
    if (screen.main?.layout) {
      extractLayoutIdsFromNode({ layout: screen.main.layout }, out)
    }
    if (screen.panel?.layout) {
      extractLayoutIdsFromNode({ layout: screen.panel.layout }, out)
    }
  }
}

/** Layout items can reference sections / screen groups instead of embedding a widgetId. */
function appendLayoutIdsFromLayoutContent (appConfig: any, plainLayout: any, out: Set<string>): void {
  const content = plainLayout?.content
  if (content == null || typeof content !== 'object') return
  for (const item of Object.values(content)) {
    if (item == null || typeof item !== 'object') continue
    const sid = (item as any).sectionId
    if (typeof sid === 'string' && sid) appendLayoutsFromSection(appConfig, sid, out)
    const gid = (item as any).screenGroupId
    if (typeof gid === 'string' && gid) appendLayoutsFromScreenGroup(appConfig, gid, out)
  }
}

function extractLayoutIdsFromNode (node: any, out: Set<string>): void {
  if (node == null || typeof node !== 'object') return

  extractLayoutIdsFromWidgetLayoutsProperty(node, out)

  if (typeof node.layoutId === 'string' && node.layoutId) {
    out.add(node.layoutId)
  }
  if (typeof node.layout === 'string' && node.layout) {
    out.add(node.layout)
  }
  if (node.layout && typeof node.layout === 'object' && !Array.isArray(node.layout)) {
    for (const v of Object.values(node.layout)) {
      if (typeof v === 'string' && v) out.add(v)
    }
  }

  if (Array.isArray(node)) {
    node.forEach((n) => extractLayoutIdsFromNode(n, out))
  } else {
    for (const k of Object.keys(node)) {
      extractLayoutIdsFromNode(node[k], out)
    }
  }
}

function collectWidgetIdsDeep (node: any, out: Set<string>): void {
  if (node == null) return
  if (typeof node === 'object') {
    const w = (node as any).widgetId
    if (typeof w === 'string' && w.length > 0) {
      out.add(w)
    }
    if (Array.isArray(node)) {
      node.forEach((n) => collectWidgetIdsDeep(n, out))
    } else {
      for (const k of Object.keys(node)) {
        collectWidgetIdsDeep((node as any)[k], out)
      }
    }
  }
}

const WIDGET_INSTANCE_ID_RE = /^widget_\d+$/i
/** Match instance ids without treating widget_1 as part of widget_10 */
const WIDGET_INSTANCE_GLOBAL_RE = /\bwidget_\d+\b/gi

function forEachWidgetIdInApp (widgets: any, fn: (id: string) => void): void {
  if (!widgets) return
  if (typeof widgets.forEach === 'function') {
    widgets.forEach((_v: any, k: string) => {
      fn(k)
    })
    return
  }
  if (typeof widgets.keySeq === 'function') {
    const seq = widgets.keySeq()
    const arr = seq?.toArray?.() ?? seq?.toJS?.() ?? []
    ;(Array.isArray(arr) ? arr : []).forEach((k: string) => fn(k))
    return
  }
  const plain = deepToPlain(widgets)
  if (plain && typeof plain === 'object' && !Array.isArray(plain)) {
    Object.keys(plain).forEach(fn)
  }
}

export function getWidgetJson (appConfig: any, widgetId: string): any {
  const widgets = appConfig?.widgets
  if (!widgets) return undefined
  const w = widgets.get?.(widgetId) ?? widgets[widgetId]
  return w == null ? undefined : deepToPlain(w)
}

/** All instance ids that exist in `appConfig.widgets`. */
function getRegisteredWidgetIds (appConfig: any): Set<string> {
  const widgets = appConfig?.widgets
  const out = new Set<string>()
  if (!widgets) return out
  forEachWidgetIdInApp(widgets, (k) => out.add(k))
  return out
}

/**
 * Walk a widget's saved JSON and collect references to other widget instance ids.
 */
function collectNestedWidgetIdsFromWidgetJson (widgetJson: any, validIds: Set<string>, out: Set<string>): void {
  const root = deepToPlain(widgetJson)
  if (root == null) return
  if (typeof root === 'string') {
    if (WIDGET_INSTANCE_ID_RE.test(root) && validIds.has(root)) {
      out.add(root)
    }
    return
  }
  if (typeof root !== 'object') return
  if (Array.isArray(root)) {
    root.forEach((n) => collectNestedWidgetIdsFromWidgetJson(n, validIds, out))
    return
  }
  for (const key of Object.keys(root)) {
    const v = (root as any)[key]
    if (typeof v === 'string' && WIDGET_INSTANCE_ID_RE.test(v) && validIds.has(v)) {
      out.add(v)
    }
    if (
      (key === 'widgetId' ||
        key === 'controllerWidgetId' ||
        key === 'useWidgetId' ||
        key === 'useMapWidgetId') &&
      typeof v === 'string' &&
      validIds.has(v)
    ) {
      out.add(v)
    }
    collectNestedWidgetIdsFromWidgetJson(v, validIds, out)
  }
}

/**
 * Fixpoint: any widget id that appears as text inside another known widget's JSON.
 * Catches refs Immutable walks miss (e.g. deeply nested Lists).
 */
function expandWidgetIdsByStringScan (appConfig: any, seed: Set<string>): Set<string> {
  const validIds = getRegisteredWidgetIds(appConfig)
  const out = new Set<string>(seed)
  let changed = true
  while (changed) {
    changed = false
    const chunks: string[] = []
    for (const wid of out) {
      const w = getWidgetJson(appConfig, wid)
      if (w) chunks.push(JSON.stringify(w))
    }
    const text = chunks.join('\n')
    let m: RegExpExecArray | null
    const re = new RegExp(WIDGET_INSTANCE_GLOBAL_RE.source, 'gi')
    re.lastIndex = 0
    while ((m = re.exec(text)) !== null) {
      const id = m[0]
      if (validIds.has(id) && !out.has(id)) {
        out.add(id)
        changed = true
      }
    }
  }
  return out
}

function expandWidgetClosureFromLayouts (appConfig: any, layoutWidgetIds: Set<string>): Set<string> {
  const validIds = getRegisteredWidgetIds(appConfig)
  const out = new Set<string>(layoutWidgetIds)
  const layouts = appConfig?.layouts
  let changed = true
  while (changed) {
    changed = false
    const beforeSize = out.size

    for (const wid of Array.from(out)) {
      const wjson = getWidgetJson(appConfig, wid)
      if (!wjson) continue
      const found = new Set<string>()
      collectNestedWidgetIdsFromWidgetJson(wjson, validIds, found)
      for (const id of found) {
        if (!out.has(id)) {
          out.add(id)
          changed = true
        }
      }
    }

    if (layouts) {
      const visitedLayouts = new Set<string>()
      const layoutQueue: string[] = []
      for (const wid of Array.from(out)) {
        const wjson = getWidgetJson(appConfig, wid)
        if (!wjson) continue
        const lids = new Set<string>()
        extractLayoutIdsFromNode(wjson, lids)
        lids.forEach((lid) => layoutQueue.push(lid))
      }
      while (layoutQueue.length) {
        const lid = layoutQueue.shift()
        if (!lid || visitedLayouts.has(lid)) continue
        visitedLayouts.add(lid)
        const layout = layouts.get?.(lid) ?? layouts[lid]
        if (!layout) continue
        const plainLayout = deepToPlain(layout)
        const foundBefore = out.size
        collectWidgetIdsDeep(plainLayout, out)
        if (out.size > foundBefore) changed = true
        const nested = new Set<string>()
        appendLayoutIdsFromLayoutContent(appConfig, plainLayout, nested)
        extractLayoutIdsFromNode(plainLayout, nested)
        nested.forEach((id) => layoutQueue.push(id))
      }
    }

    if (out.size !== beforeSize) changed = true
  }
  return out
}

/**
 * Widget instance ids for the current page: layout + nested configs + string-scan closure.
 */
export function collectWidgetIdsOnPage (appConfig: any, pageId: string): string[] {
  if (!pageId || !appConfig) return []
  const pages = appConfig.pages
  const page = pages?.get?.(pageId) ?? pages?.[pageId]
  if (!page) return []

  const validIds = getRegisteredWidgetIds(appConfig)
  const plainPage = deepToPlain(page)
  const fromLayout = new Set<string>()
  collectWidgetIdsDeep(plainPage, fromLayout)

  const layoutBlobs: string[] = []
  const layouts = appConfig.layouts
  if (layouts) {
    const visitedLayouts = new Set<string>()
    const queue: string[] = []
    const seed = new Set<string>()
    extractLayoutIdsFromNode(plainPage, seed)
    if (plainPage.header) {
      extractLayoutIdsFromNode(deepToPlain(appConfig.header), seed)
    }
    if (plainPage.footer) {
      extractLayoutIdsFromNode(deepToPlain(appConfig.footer), seed)
    }
    seed.forEach((id) => queue.push(id))

    while (queue.length) {
      const lid = queue.shift()
      if (!lid || visitedLayouts.has(lid)) continue
      visitedLayouts.add(lid)

      const layout = layouts.get?.(lid) ?? layouts[lid]
      if (!layout) continue
      const plainLayout = deepToPlain(layout)
      layoutBlobs.push(JSON.stringify(plainLayout))
      collectWidgetIdsDeep(plainLayout, fromLayout)

      const nested = new Set<string>()
      appendLayoutIdsFromLayoutContent(appConfig, plainLayout, nested)
      extractLayoutIdsFromNode(plainLayout, nested)
      nested.forEach((id) => {
        if (!visitedLayouts.has(id)) queue.push(id)
      })
    }
  }

  /** Regex on page + layout JSON catches widget ids stored in shapes object walks miss */
  const seedText = `${JSON.stringify(plainPage)}\n${layoutBlobs.join('\n')}`
  let rm: RegExpExecArray | null
  const reSeed = /\bwidget_\d+\b/gi
  reSeed.lastIndex = 0
  while ((rm = reSeed.exec(seedText)) !== null) {
    const id = rm[0]
    if (validIds.has(id)) fromLayout.add(id)
  }

  let expanded = expandWidgetClosureFromLayouts(appConfig, fromLayout)
  expanded = expandWidgetIdsByStringScan(appConfig, expanded)
  return Array.from(expanded)
}

export interface WidgetMeta {
  widgetId: string
  /** Author-visible name in the builder */
  label: string
  /** Manifest widget name (e.g. map, list) */
  manifestName: string
  /** Raw icon from config, if any */
  icon: any
}

export function getWidgetLabel (widgetJson: any): string {
  if (widgetJson == null) return '(untitled)'
  const label = widgetJson?.label
  if (typeof label === 'string' && label.trim().length > 0) return label
  const name = widgetJson?.widgetName
  if (typeof name === 'string' && name.trim().length > 0) return name
  return '(untitled)'
}

export function getManifestName (widgetJson: any): string {
  if (widgetJson == null) return 'widget'
  const n = widgetJson?.widgetName
  if (typeof n === 'string' && n.trim().length > 0) return n
  const uri = widgetJson?.uri
  if (typeof uri === 'string') {
    const parts = uri.split('/').filter(Boolean)
    if (parts.length >= 2) return parts[parts.length - 2] ?? 'widget'
  }
  return 'widget'
}

/**
 * Detects the Experience Builder **Map** widget (the one that owns a `JimuMapView`).
 * URIs vary by ExB version; must not match **Map Layers** (`map-layers`), which also lives under `arcgis/`.
 */
export function isMapWidgetEntry (widgetJson: any): boolean {
  if (!widgetJson) return false
  const name = (widgetJson.widgetName ?? '').toString().toLowerCase().trim()
  const uri = (widgetJson.uri ?? '').toString().toLowerCase()

  /** Layer list / TOC widgets — URI contains `arcgis/map` as a substring of `map-layers`. */
  if (name === 'map-layers' || name.startsWith('map-layers') || /(^|\/)map-layers(\/|$)/.test(uri)) {
    return false
  }

  if (name === 'map' || name === 'arcgis-map' || name === 'map-view') return true

  if (!uri) return false

  if (uri.includes('/map/') || uri.endsWith('/map')) return true
  if (/(?:^|\/)map(?:\/|$)/.test(uri)) return true

  /** Require `/map` segment boundary so `.../arcgis/map-layers/...` does not match. */
  if (/\/arcgis\/map(?:\/|$)/.test(uri)) return true

  if (uri.includes('arcgis-map') || uri.includes('map-widget')) return true

  const segments = uri.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  if (last === 'map' || last.endsWith('-map')) return true

  return false
}

/**
 * Map widgets on the current page for the Layers tab.
 * Uses collected page widget ids, then map detection + label fallback for default "Map" name.
 * If multiple maps share the same label, disambiguate by id in the Select.
 */
export function getMapWidgetIdsOnPage (appConfig: any, pageId: string): string[] {
  const ids = collectWidgetIdsOnPage(appConfig, pageId)
  let mapIds = ids.filter((wid) => isMapWidgetEntry(getWidgetJson(appConfig, wid)))

  if (mapIds.length === 0) {
    mapIds = ids.filter((wid) => {
      const w = getWidgetJson(appConfig, wid)
      const label = (w?.label ?? '').toString().trim().toLowerCase()
      return label === 'map'
    })
  }

  return mapIds
}

export function getWidgetMeta (appConfig: any, widgetId: string): WidgetMeta {
  const plain = getWidgetJson(appConfig, widgetId)
  return {
    widgetId,
    label: getWidgetLabel(plain),
    manifestName: getManifestName(plain),
    icon: plain?.icon
  }
}

export function sortWidgetIdsByLabel (appConfig: any, widgetIds: string[]): string[] {
  return [...widgetIds].sort((a, b) => {
    const la = getWidgetLabel(getWidgetJson(appConfig, a))
    const lb = getWidgetLabel(getWidgetJson(appConfig, b))
    return la.localeCompare(lb, undefined, { sensitivity: 'base' })
  })
}
