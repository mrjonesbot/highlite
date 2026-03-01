# Highlite

A Rails engine that wraps PDF.js to provide a drop-in PDF viewer with text and area highlighting. Powered by Stimulus controllers and importmap-rails.

## Features

- Full PDF rendering via PDF.js (CDN-served, zero npm dependencies)
- Text highlighting -- select text to highlight it
- Area highlighting -- draw rectangles over any region
- Four default highlight colors (yellow, green, blue, pink)
- Three-panel layout: outline/thumbnails sidebar, PDF viewer, highlights panel
- Highlight persistence via localStorage
- Keyboard shortcuts for zoom (Ctrl +/-, Ctrl 0)
- Outline (table of contents) extracted from PDF metadata
- Page thumbnails with lazy loading
- Overridable right sidebar for custom integrations
- Fully configurable via Ruby initializer

## Requirements

- Ruby >= 3.1
- Rails >= 7.1
- importmap-rails

## Installation

Add to your Gemfile:

```ruby
gem "highlite"
```

Run the install generator:

```bash
bin/rails generate highlite:install
```

This creates `config/initializers/highlite.rb` with default configuration.

To also copy the right sidebar partial for customization:

```bash
bin/rails generate highlite:install --sidebar
```

## Quick Start

In any view:

```erb
<%= highlite_viewer(url: url_for(@document.file), document_id: @document.id) %>
```

That's it -- a full PDF viewer with highlighting is rendered.

## Configuration

Configure in `config/initializers/highlite.rb`:

```ruby
Highlite.configure do |config|
  config.pdf_js_version = "5.4.624"

  config.default_colors = [
    "rgba(255, 226, 143, 0.5)", # yellow
    "rgba(166, 227, 161, 0.5)", # green
    "rgba(137, 180, 250, 0.5)", # blue
    "rgba(245, 194, 231, 0.5)"  # pink
  ]

  config.toolbar_tools = [:text, :area]

  config.right_sidebar_partial = "my_app/custom_sidebar"
end
```

| Option | Default | Description |
|---|---|---|
| `pdf_js_version` | `"5.4.624"` | PDF.js version loaded from jsDelivr CDN |
| `default_colors` | Yellow, green, blue, pink (rgba) | Array of highlight color strings |
| `toolbar_tools` | `[:text, :area]` | Enabled tool types in the floating toolbar |
| `right_sidebar_partial` | `nil` | Custom partial path for the right sidebar |

## Helper Options

The `highlite_viewer` helper accepts:

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | String | *required* | URL of the PDF to display |
| `document_id` | String | *required* | Unique ID for highlight storage |
| `scale` | Number | `1.5` | Initial zoom scale |
| `show_toolbar` | Boolean | `true` | Show the top toolbar with zoom controls |
| `show_left_sidebar` | Boolean | `true` | Show the outline/thumbnails sidebar |
| `show_right_sidebar` | Boolean | `true` | Show the highlights panel |
| `right_sidebar_partial` | String | `nil` | Override the right sidebar partial for this instance |

## Stimulus Controllers

Highlite registers four Stimulus controllers with the `highlite--` prefix:

| Controller | Identifier | Purpose |
|---|---|---|
| ViewerController | `highlite--viewer` | PDF rendering, zoom, page navigation |
| HighlightController | `highlite--highlight` | Drawing and managing highlights |
| SidebarController | `highlite--sidebar` | Left sidebar (outline + thumbnails) |
| HighlightsPanelController | `highlite--highlights-panel` | Right sidebar highlights list |

## Custom Events

All events are dispatched with the `highlite:` prefix and bubble up the DOM:

| Event | Detail | Description |
|---|---|---|
| `highlite:document-loaded` | `{ pageCount, title, outline }` | PDF document loaded |
| `highlite:page-changed` | `{ page, totalPages }` | Visible page changed |
| `highlite:highlight-created` | `{ id, page, type, color, text, rects }` | New highlight added |
| `highlite:highlight-removed` | `{ id }` | Highlight deleted |
| `highlite:highlight-selected` | `{ id, page }` | Highlight clicked |
| `highlite:highlights-cleared` | `{ page }` | Highlights cleared (`page` is null for all) |

## Manual Controller Registration

If you need to register controllers manually (e.g., you have your own Stimulus application):

```javascript
import { registerControllers } from "highlite"
import { Application } from "@hotwired/stimulus"

const application = Application.start()
registerControllers(application)
```

## Customizing the Right Sidebar

Run the generator with `--sidebar` to copy the default partial:

```bash
bin/rails generate highlite:install --sidebar
```

This creates `app/views/highlite/_right_sidebar.html.erb` in your app, which takes precedence over the gem's default. Or set `config.right_sidebar_partial` to point to any partial in your app.

## Development

Clone the repo and install dependencies:

```bash
bin/setup
```

Run the test suite:

```bash
bundle exec rake spec
```

Run the linter:

```bash
bundle exec rubocop
```

Launch the dummy app for manual testing:

```bash
cd test/dummy
bin/rails server
```

Then open http://localhost:3000.

## License

The gem is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
