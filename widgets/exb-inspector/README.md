# Experience Builder ID Inspector

**Authoring tool for ArcGIS Experience Builder** to quickly inspect **data source IDs** and **widget instance IDs** during app design.

---

## What it does

`exb-inspector` is an **admin-only utility widget** for ArcGIS Experience Builder that helps authors and support teams identify internal IDs used in configuration and custom development.

It runs **only in Experience Builder (Design mode)** and is not intended for end users of published apps.

---

## Key features

- **Layers tab**  
  Select a map on the current page and view all **operational layers** with their Experience Builder **data source IDs** (copy to clipboard)

- **Widgets tab**  
  View all **widget instance IDs** on the current page (`widget_3`, etc.), including body, header/footer, sections, and controllers (copy to clipboard)

- **Designer-only tool**  
  Only active in Experience Builder Design mode. Displays a short notice in deployed apps

- **Zero configuration**  
  No settings required. Everything reflects the live app state

---

## Usage

1.	Open your app in Experience Builder (Design mode)
1.	Add the exb-inspector widget to the page

Use:
* **Layers tab** → find data source IDs for layers
* **Widgets tab** → find widget instance IDs

Click to copy values directly to your clipboard.

---

## Compatibility

* ArcGIS Enterprise: 11.3+
* Built with Experience Builder Developer Edition 1.14