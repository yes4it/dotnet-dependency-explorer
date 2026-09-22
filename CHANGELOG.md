# Changelog

## 0.4.0

- Click the pasta index, in the header or in the side panel, to open the **scale**: every shape, the rule behind it, and what your graph measures against that rule.
- Price the next move. Breaking a cycle or dropping redundant references is scored by replaying the index on the graph the change would leave, so the figure is a result rather than a projection.
- Collapse the details panel from its chevron, like the toolbars. The choice is kept with the rest of the view.
- Speed up the Cytoscape wheel, which was running at a quarter of the normal rate, and add the missing zoom buttons to the canvas toolbar.

## 0.3.0

- Add the **pasta index**: a 0-100 coupling score and a shape, shown in the header and explained in the side panel.
- Grade the workspace on four measures computed from the reference graph: propagation cost, cycle mass, redundant references and modularity against the declared domains.
- Name the shape the graph actually has — spaghetti, fusilli, gnocchi, ravioli, penne, lasagne or macaroni — with the next step it calls for.
- Exclude test projects from the grade, so a test suite cannot move the score.

## 0.2.0

- Add a **Cytoscape graph** view: the same filtered graph rendered on canvas, with levels, force-directed, breadth-first, concentric, circle and grid layouts.
- Highlight a project's neighbourhood on hover and show its full name, domain, level, path and reference counts.
- Select a project inside the view to filter around it without leaving it; **Open focus view** switches to the three-column layout.
- Export the current graph as PNG through the VS Code save dialog.
- Collapse the three toolbars with the chevron in the header, giving their height back to the graph. The choice is kept with the rest of the view.
- Explain every Cytoscape layout and canvas button through tooltips.
- Wrap long project names over several lines at dots and camel-case boundaries instead of cutting them.
- Bundle Cytoscape 3.34.3 (MIT) in `media/vendor`; the extension still runs fully offline.

## 0.1.4

- Keep panning inside a dedicated graph viewport, below the legend and status text.
- Prevent graph content from overlapping toolbars or the details panel.

## 0.1.3

- Add a .NET Dependencies Activity Bar icon and sidebar.
- Open the graph or refresh project references directly from the sidebar.

## 0.1.2

- Pan graphs by dragging the background or using the middle mouse button.
- Preserve panning across refresh and view restoration; Fit resets the offset.
- Keep exported SVGs independent of the viewport offset.

## 0.1.1

- Add a compact refresh button at the start of the toolbar in every view.
- Preserve the current project, filters and zoom when manually refreshing.

## 0.1.0

- Initial community release preparation.
- English UI, project graph, domain overview and dependency matrix.
- Project focus, redundant-reference coloring, cycle detection and card-aware routing.
- Repaired zoom controls, saved workspace view state, project navigation and SVG export.
- Automatic refresh after project-file changes.

- Configurable domain rules and label prefixes without application-specific defaults.
- MIT license, public documentation and synthetic screenshots.
