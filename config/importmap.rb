# frozen_string_literal: true

version = Highlite.configuration.pdf_js_version

pin "pdfjs-dist", to: "https://cdn.jsdelivr.net/npm/pdfjs-dist@#{version}/build/pdf.min.mjs", preload: true
pin "pdfjs-dist/build/pdf.worker.min.mjs",
    to: "https://cdn.jsdelivr.net/npm/pdfjs-dist@#{version}/build/pdf.worker.min.mjs"

# Gem JS entry point and internal modules
pin "highlite", to: "highlite/index.js"
pin "highlite/lib/pdf_renderer", to: "highlite/lib/pdf_renderer.js"
pin "highlite/lib/highlight_store", to: "highlite/lib/highlight_store.js"
pin "highlite/controllers/viewer_controller", to: "highlite/controllers/viewer_controller.js"
pin "highlite/controllers/highlight_controller", to: "highlite/controllers/highlight_controller.js"
pin "highlite/controllers/sidebar_controller", to: "highlite/controllers/sidebar_controller.js"
pin "highlite/controllers/highlights_panel_controller",
    to: "highlite/controllers/highlights_panel_controller.js"
