import { Controller } from "@hotwired/stimulus"
import { PdfRenderer } from "highlite/lib/pdf_renderer"

/**
 * SidebarController — Stimulus controller for the left sidebar.
 *
 * Provides two tabbed views:
 *   - **Outline** — Hierarchical TOC extracted from PDF metadata
 *   - **Pages** — Thumbnail previews for each page
 *
 * Targets:
 *   outlineTab         - Outline tab button
 *   pagesTab           - Pages tab button
 *   outlinePanel       - Outline content container
 *   pagesPanel         - Pages/thumbnails content container
 *   thumbnailsContainer - Container for thumbnail canvases
 *   pageCounter        - "Page X of Y" display
 *
 * Listens for:
 *   highlite:document-loaded — receive outline + page count
 *   highlite:page-changed    — update active thumbnail
 *   highlite:highlight-created/removed/cleared — update outline dots
 */
export default class extends Controller {
  static targets = [
    "outlineTab",
    "pagesTab",
    "outlinePanel",
    "pagesPanel",
    "thumbnailsContainer",
    "pageCounter",
  ]

  connect() {
    this._pageCount = 0
    this._outline = []
    this._activePage = 1
    this._renderer = null
    this._thumbnailObserver = null
    this._renderedThumbnails = new Set()

    // Bind event handlers
    this._onDocumentLoaded = this._handleDocumentLoaded.bind(this)
    this._onPageChanged = this._handlePageChanged.bind(this)
    this._onHighlightChanged = this._handleHighlightChanged.bind(this)

    // Listen on the parent viewer element
    const viewer = this._getViewerElement()
    if (viewer) {
      viewer.addEventListener(
        "highlite:document-loaded",
        this._onDocumentLoaded
      )
      viewer.addEventListener(
        "highlite:page-changed",
        this._onPageChanged
      )
      viewer.addEventListener(
        "highlite:highlight-created",
        this._onHighlightChanged
      )
      viewer.addEventListener(
        "highlite:highlight-removed",
        this._onHighlightChanged
      )
      viewer.addEventListener(
        "highlite:highlights-cleared",
        this._onHighlightChanged
      )
    }
  }

  disconnect() {
    const viewer = this._getViewerElement()
    if (viewer) {
      viewer.removeEventListener(
        "highlite:document-loaded",
        this._onDocumentLoaded
      )
      viewer.removeEventListener(
        "highlite:page-changed",
        this._onPageChanged
      )
      viewer.removeEventListener(
        "highlite:highlight-created",
        this._onHighlightChanged
      )
      viewer.removeEventListener(
        "highlite:highlight-removed",
        this._onHighlightChanged
      )
      viewer.removeEventListener(
        "highlite:highlights-cleared",
        this._onHighlightChanged
      )
    }

    if (this._thumbnailObserver) {
      this._thumbnailObserver.disconnect()
    }
  }

  // ---------------------------------------------------------------------------
  // Actions — Tab switching
  // ---------------------------------------------------------------------------

  /**
   * Show the Outline tab.
   */
  showOutline() {
    this._setActiveTab("outline")
  }

  /**
   * Show the Pages tab.
   */
  showPages() {
    this._setActiveTab("pages")
  }

  _setActiveTab(tab) {
    const isOutline = tab === "outline"

    if (this.hasOutlineTabTarget) {
      this.outlineTabTarget.classList.toggle(
        "highlite-tab-active",
        isOutline
      )
    }
    if (this.hasPagesTabTarget) {
      this.pagesTabTarget.classList.toggle(
        "highlite-tab-active",
        !isOutline
      )
    }
    if (this.hasOutlinePanelTarget) {
      this.outlinePanelTarget.classList.toggle("hidden", !isOutline)
    }
    if (this.hasPagesPanelTarget) {
      this.pagesPanelTarget.classList.toggle("hidden", isOutline)
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle document loaded event — build outline and thumbnails.
   * @param {CustomEvent} event
   */
  _handleDocumentLoaded(event) {
    const { pageCount, outline } = event.detail
    this._pageCount = pageCount
    this._outline = outline || []

    this._renderOutline()
    this._createThumbnails()
    this._updatePageCounter(1)
  }

  /**
   * Handle page changed event — update active thumbnail.
   * @param {CustomEvent} event
   */
  _handlePageChanged(event) {
    const { page } = event.detail
    this._activePage = page
    this._updateActiveThumbnail(page)
    this._updatePageCounter(page)
  }

  /**
   * Handle highlight changes — update outline dots.
   */
  _handleHighlightChanged() {
    this._updateOutlineDots()
  }

  // ---------------------------------------------------------------------------
  // Outline rendering
  // ---------------------------------------------------------------------------

  _renderOutline() {
    if (!this.hasOutlinePanelTarget) return

    if (this._outline.length === 0) {
      this.outlinePanelTarget.innerHTML =
        '<p class="highlite-sidebar-empty">No outline available</p>'
      return
    }

    const list = this._buildOutlineList(this._outline)
    this.outlinePanelTarget.innerHTML = ""
    this.outlinePanelTarget.appendChild(list)
  }

  /**
   * Recursively build the outline tree as nested lists.
   * @param {Array} items
   * @param {number} [depth=0]
   * @returns {HTMLElement}
   */
  _buildOutlineList(items, depth = 0) {
    const ul = document.createElement("ul")
    ul.className = "highlite-outline-list"
    if (depth > 0) ul.style.paddingLeft = "1rem"

    for (const item of items) {
      const li = document.createElement("li")
      li.className = "highlite-outline-item"

      const link = document.createElement("button")
      link.className = "highlite-outline-link"
      link.type = "button"

      // Title
      const titleSpan = document.createElement("span")
      titleSpan.className = "highlite-outline-title"
      titleSpan.textContent = item.title

      // Highlight dot (hidden by default)
      const dot = document.createElement("span")
      dot.className = "highlite-outline-dot"
      dot.style.display = "none"
      if (item.pageNum) dot.dataset.outlinePage = item.pageNum

      // Page number
      const pageSpan = document.createElement("span")
      pageSpan.className = "highlite-outline-page"
      pageSpan.textContent = item.pageNum || ""

      link.appendChild(dot)
      link.appendChild(titleSpan)
      link.appendChild(pageSpan)

      if (item.pageNum) {
        link.addEventListener("click", () => {
          this._navigateToPage(item.pageNum)
        })
      }

      li.appendChild(link)

      // Render children
      if (item.items && item.items.length > 0) {
        const details = document.createElement("details")
        details.open = depth < 1 // Auto-expand first level
        const summary = document.createElement("summary")
        summary.appendChild(link)
        details.appendChild(summary)
        details.appendChild(this._buildOutlineList(item.items, depth + 1))
        li.innerHTML = ""
        li.appendChild(details)
      }

      ul.appendChild(li)
    }

    return ul
  }

  /**
   * Update blue dots on outline items that have highlights on their page.
   */
  _updateOutlineDots() {
    const dots = this.element.querySelectorAll(
      ".highlite-outline-dot[data-outline-page]"
    )
    // Get highlight store from viewer element
    const viewer = this._getViewerElement()
    if (!viewer) return

    for (const dot of dots) {
      const page = parseInt(dot.dataset.outlinePage, 10)
      const highlights = viewer.querySelectorAll(
        `.highlite-page[data-page-number="${page}"] .highlite-highlight`
      )
      dot.style.display = highlights.length > 0 ? "inline-block" : "none"
    }
  }

  // ---------------------------------------------------------------------------
  // Thumbnail rendering
  // ---------------------------------------------------------------------------

  _createThumbnails() {
    if (!this.hasThumbnailsContainerTarget) return

    const container = this.thumbnailsContainerTarget
    container.innerHTML = ""
    this._renderedThumbnails.clear()

    for (let i = 1; i <= this._pageCount; i++) {
      const wrapper = document.createElement("button")
      wrapper.type = "button"
      wrapper.className = "highlite-thumbnail"
      wrapper.dataset.pageNumber = i
      if (i === 1) wrapper.classList.add("highlite-thumbnail-active")

      const canvas = document.createElement("canvas")
      canvas.className = "highlite-thumbnail-canvas"
      canvas.width = 1
      canvas.height = 1

      const label = document.createElement("span")
      label.className = "highlite-thumbnail-label"
      label.textContent = i

      wrapper.appendChild(canvas)
      wrapper.appendChild(label)

      wrapper.addEventListener("click", () => {
        this._navigateToPage(i)
      })

      container.appendChild(wrapper)
    }

    // Lazy-load thumbnails with IntersectionObserver
    this._setupThumbnailObserver()
  }

  _setupThumbnailObserver() {
    if (this._thumbnailObserver) {
      this._thumbnailObserver.disconnect()
    }

    this._thumbnailObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue

          const pageNum = parseInt(entry.target.dataset.pageNumber, 10)
          if (this._renderedThumbnails.has(pageNum)) continue

          this._renderedThumbnails.add(pageNum)
          this._renderThumbnail(pageNum, entry.target)
        }
      },
      { root: this.hasThumbnailsContainerTarget ? this.thumbnailsContainerTarget : null }
    )

    const thumbnails = this.thumbnailsContainerTarget.querySelectorAll(
      ".highlite-thumbnail"
    )
    for (const thumb of thumbnails) {
      this._thumbnailObserver.observe(thumb)
    }
  }

  /**
   * Render a single thumbnail by finding the viewer's PdfRenderer.
   * @param {number} pageNum
   * @param {HTMLElement} wrapper
   */
  async _renderThumbnail(pageNum, wrapper) {
    const canvas = wrapper.querySelector("canvas")
    if (!canvas) return

    // Get the renderer from the viewer controller
    const viewer = this._getViewerElement()
    if (!viewer) return

    // Access the Stimulus controller instance to use its renderer
    const app = window.Stimulus || this.application
    const viewerController = app?.getControllerForElementAndIdentifier?.(
      viewer,
      "highlite--viewer"
    )

    if (viewerController?.renderer) {
      try {
        // Calculate scale to fill sidebar width
        const containerWidth = this.thumbnailsContainerTarget.clientWidth - 8 // account for border/padding
        const viewport = await viewerController.renderer.getViewport(pageNum, 1.0)
        const scale = containerWidth / viewport.width
        await viewerController.renderer.renderThumbnail(pageNum, canvas, scale)
        // Clear inline dimensions set by renderPage so CSS width:100% takes effect
        canvas.style.width = ""
        canvas.style.height = ""
      } catch {
        // Thumbnail rendering may fail for some pages; degrade gracefully
      }
    }
  }

  /**
   * Update which thumbnail has the active border.
   * @param {number} page
   */
  _updateActiveThumbnail(page) {
    if (!this.hasThumbnailsContainerTarget) return

    const thumbnails = this.thumbnailsContainerTarget.querySelectorAll(
      ".highlite-thumbnail"
    )

    for (const thumb of thumbnails) {
      const num = parseInt(thumb.dataset.pageNumber, 10)
      thumb.classList.toggle("highlite-thumbnail-active", num === page)
    }

    // Scroll active thumbnail into view
    const active = this.thumbnailsContainerTarget.querySelector(
      ".highlite-thumbnail-active"
    )
    if (active) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /**
   * Navigate to a page by dispatching to the viewer controller.
   * @param {number} pageNum
   */
  _navigateToPage(pageNum) {
    const viewer = this._getViewerElement()
    if (!viewer) return

    // Access the viewer controller to call scrollToPage
    const app = window.Stimulus || this.application
    const viewerController = app?.getControllerForElementAndIdentifier?.(
      viewer,
      "highlite--viewer"
    )

    if (viewerController) {
      viewerController.scrollToPage(pageNum)
    }
  }

  // ---------------------------------------------------------------------------
  // UI updates
  // ---------------------------------------------------------------------------

  _updatePageCounter(page) {
    if (this.hasPageCounterTarget) {
      this.pageCounterTarget.textContent = `Page ${page} of ${this._pageCount}`
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Find the viewer element in the DOM.
   * @returns {HTMLElement|null}
   */
  _getViewerElement() {
    return (
      this.element.closest(
        "[data-controller*='highlite--viewer']"
      ) ||
      document.querySelector(
        "[data-controller*='highlite--viewer']"
      )
    )
  }
}
