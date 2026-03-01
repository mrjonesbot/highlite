# PDF Highlighter Gem — Build Plan

## Overview

A Ruby gem (Rails engine) that provides a full-featured PDF viewer with highlighting, modeled after [react-pdf-highlighter-plus](https://react-pdf-highlighter-plus-demo.vercel.app/pdf-demo). Built for Rails 8 + Hotwire (Stimulus) + Tailwind CSS + Import Maps.

## Architecture

### Three-panel layout
- **Left sidebar** (gem-owned): Outline tab (TOC from PDF metadata) + Pages tab (thumbnails)
- **Center** (gem-owned): PDF.js canvas rendering + text layer + highlight overlay
- **Right sidebar** (default + overridable): Highlights list with search, grouped by page. Users can replace with their own partial.

### Key design decisions
- **Stimulus controllers** dispatch custom events (`pdf-highlighter:highlight-created`, etc.) so host apps can react
- **Right sidebar override** — ships a default highlights panel, but host apps can provide their own partial at `app/views/pdf_highlighter/_right_sidebar.html.erb` which takes precedence (Rails engine view override convention)
- **PDF.js via CDN** (jsdelivr) — pinned in engine's importmap config, no npm required
- **localStorage by default** for highlight persistence, with an optional `Highlightable` model concern for server-side storage
- **tailwindcss-ruby** (`flavorjones/tailwindcss-ruby`) — compiles Tailwind CSS within the gem so the host app doesn't need Tailwind installed (but works great if they do)
- **CSS strategy** — gem ships a pre-compiled CSS file built with tailwindcss-ruby during development; the host app includes it via `stylesheet_link_tag "pdf_highlighter/viewer"`

### Stimulus event API (dispatched on the viewer element)
```
pdf-highlighter:document-loaded   { detail: { pageCount, title, outline } }
pdf-highlighter:page-changed      { detail: { page, totalPages } }
pdf-highlighter:highlight-created  { detail: { id, page, type, color, text, rects } }
pdf-highlighter:highlight-removed  { detail: { id } }
pdf-highlighter:highlight-selected { detail: { id, page } }
pdf-highlighter:highlights-cleared { detail: { page } }  // null page = all
```

## Directory structure

```
pdf_highlighter/
├── pdf_highlighter.gemspec
├── Gemfile
├── Rakefile
├── README.md
├── lib/
│   ├── pdf_highlighter.rb                        # Main entry + autoload
│   ├── pdf_highlighter/
│   │   ├── version.rb
│   │   ├── engine.rb                             # Rails engine config + importmap
│   │   └── configuration.rb                      # Config DSL (pdf.js version, colors, etc.)
│   └── generators/
│       └── pdf_highlighter/
│           └── install/
│               ├── install_generator.rb           # rails g pdf_highlighter:install
│               └── templates/
│                   ├── initializer.rb.tt
│                   └── _right_sidebar.html.erb.tt # Override template
├── app/
│   ├── assets/
│   │   └── stylesheets/
│   │       └── pdf_highlighter/
│   │           └── viewer.css                     # Minimal required styles (text layer, etc.)
│   ├── javascript/
│   │   └── pdf_highlighter/
│   │       ├── index.js                           # Registers all controllers with Stimulus
│   │       ├── controllers/
│   │       │   ├── viewer_controller.js           # PDF.js rendering, zoom, scroll
│   │       │   ├── highlight_controller.js        # Drawing + managing highlights
│   │       │   ├── sidebar_controller.js          # Left sidebar (outline + pages tabs)
│   │       │   └── highlights_panel_controller.js # Right sidebar (default highlight list)
│   │       └── lib/
│   │           ├── pdf_renderer.js                # PDF.js wrapper (load, render, text layer)
│   │           └── highlight_store.js             # State management + localStorage
│   ├── helpers/
│   │   └── pdf_highlighter/
│   │       └── application_helper.rb              # pdf_highlighter_viewer helper method
│   └── views/
│       └── pdf_highlighter/
│           ├── _viewer.html.erb                   # Main 3-panel layout
│           ├── _toolbar.html.erb                  # Top bar (zoom, export, change PDF)
│           ├── _left_sidebar.html.erb             # Outline + Pages tabs
│           ├── _right_sidebar.html.erb            # Default highlights panel
│           └── _floating_toolbar.html.erb         # Annotation tool buttons
└── spec/
    ├── spec_helper.rb
    └── lib/
        └── pdf_highlighter_spec.rb
```

## Build tasks

### Phase 1: Foundation
- [ ] 1.1 Set up gemspec with correct dependencies (rails >= 7.1, importmap-rails)
- [ ] 1.2 Create Rails engine (PdfHighlighter::Engine) with importmap config
- [ ] 1.3 Create Configuration class (pdf_js_version, default_colors, toolbar_tools, right_sidebar_partial)
- [ ] 1.4 Create install generator (initializer + optional sidebar override template)
- [ ] 1.5 Create viewer helper method: `pdf_highlighter_viewer(url:, document_id:, **options)`

### Phase 2: Core JavaScript — PDF Viewer
- [ ] 2.1 Build pdf_renderer.js — PDF.js wrapper (load document, render page to canvas, text layer, get outline, render thumbnail)
- [ ] 2.2 Build viewer_controller.js — Stimulus controller (renders PDF, handles zoom [Auto/fit/%, +, -], page scroll tracking, keyboard nav)
- [ ] 2.3 Build highlight_store.js — State manager (add/remove/update/query highlights, localStorage read/write, event dispatch)

### Phase 3: Highlighting
- [ ] 3.1 Build highlight_controller.js — Text selection highlighting (capture Selection API ranges → rects, apply color)
- [ ] 3.2 Add area/rectangle highlighting mode (mousedown→drag→mouseup drawing)
- [ ] 3.3 Highlight rendering (colored overlay divs with mix-blend-mode: multiply)
- [ ] 3.4 Highlight interaction (click to select, right-click to remove, hover effect)
- [ ] 3.5 Multiple highlight colors (toolbar color picker)

### Phase 4: Left Sidebar
- [ ] 4.1 Build sidebar_controller.js — Tab switching (Outline / Pages)
- [ ] 4.2 Outline tab — Extract TOC from PDF metadata, render hierarchical tree, click-to-navigate, blue dots for pages with highlights
- [ ] 4.3 Pages tab — Render page thumbnails (small canvas), active page border, click-to-navigate, page counter

### Phase 5: Right Sidebar (Default + Override)
- [ ] 5.1 Build highlights_panel_controller.js — Lists highlights grouped by page, search/filter, clear all
- [ ] 5.2 Build _right_sidebar.html.erb — Default partial with highlight cards (type badge, quoted text, page link)
- [ ] 5.3 Implement override mechanism — check for app/views/pdf_highlighter/_right_sidebar.html.erb in host app, fall back to gem default

### Phase 6: Toolbar & Polish
- [ ] 6.1 Build _toolbar.html.erb — Top bar (zoom controls, page info)
- [ ] 6.2 Build _floating_toolbar.html.erb — Vertical tool buttons (select, text highlight, area highlight, colors)
- [ ] 6.3 Keyboard shortcuts (Ctrl+Z undo, Escape deselect, arrow keys for pages)

### Phase 7: Views & Integration
- [ ] 7.1 Build _viewer.html.erb — Main layout composing all panels
- [ ] 7.2 Build viewer.css — Required styles (text layer positioning, highlight blending, sidebar transitions)
- [ ] 7.3 Wire helper method to render the viewer partial with all options
- [ ] 7.4 Write README with usage examples, configuration, and override instructions

### Phase 8: Testing
- [ ] 8.1 RSpec tests for engine loading, configuration, helper output
- [ ] 8.2 Generator tests (install generator creates expected files)
