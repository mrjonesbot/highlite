import { Controller } from "@hotwired/stimulus"
import { PdfRenderer } from "highlite/lib/pdf_renderer"

/**
 * ViewerController — Main Stimulus controller for the PDF viewer center panel.
 *
 * Renders all PDF pages in a scrollable container, tracks the current visible
 * page via IntersectionObserver, and provides zoom controls and keyboard navigation.
 *
 * Targets:
 *   pagesContainer - Scrollable div that holds all page wrappers
 *   pageTemplate   - A <template> element cloned for each page
 *   zoomLevel      - Element displaying the current zoom percentage
 *   pageInfo       - Element displaying "Page X of Y"
 *   loader         - Loading overlay shown while PDF is loading
 *
 * Values:
 *   url        (String)  - URL of the PDF to load
 *   documentId (String)  - Unique document ID for highlight storage
 *   scale      (Number)  - Current zoom scale (default 1.5)
 *
 * Actions:
 *   zoomIn, zoomOut, zoomFit, zoomAuto, scrollToPage
 *
 * Events dispatched on this.element:
 *   highlite:document-loaded  { pageCount, title, outline }
 *   highlite:page-changed     { page, totalPages }
 */
export default class extends Controller {
  static targets = [
    "pagesContainer",
    "pageTemplate",
    "zoomLevel",
    "pageInfo",
    "loader",
  ]

  static values = {
    url: String,
    documentId: String,
    scale: { type: Number, default: 2.25 },
  }

  connect() {
    this.renderer = null
    this.pageCount = 0
    this.currentPage = 1
    this._observer = null
    this._pageElements = []
    this._rendering = false

    this._handleKeydown = this._onKeydown.bind(this)
    document.addEventListener("keydown", this._handleKeydown)

    if (this.urlValue) {
      this._loadDocument()
    }
  }

  disconnect() {
    document.removeEventListener("keydown", this._handleKeydown)

    if (this._observer) {
      this._observer.disconnect()
      this._observer = null
    }

    if (this.renderer) {
      this.renderer.destroy()
      this.renderer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Value change callbacks
  // ---------------------------------------------------------------------------

  scaleValueChanged() {
    this._updateZoomDisplay()
    if (this.renderer && this.pageCount > 0) {
      this._rerenderAllPages()
    }
  }

  // ---------------------------------------------------------------------------
  // Document loading
  // ---------------------------------------------------------------------------

  async _loadDocument() {
    this._showLoader()

    try {
      this.renderer = new PdfRenderer(this.urlValue)
      const { pageCount, title } = await this.renderer.load()
      this.pageCount = pageCount

      const outline = await this.renderer.getOutline()

      this._createPageContainers()
      await this._renderAllPages()
      this._setupIntersectionObserver()
      this._updatePageInfo(1)
      this._updateZoomDisplay()

      this.dispatch("document-loaded", {
        detail: { pageCount, title, outline },
        prefix: "highlite",
      })
    } catch (error) {
      console.error("[highlite] Failed to load PDF:", error)
      this._showError(error.message)
    } finally {
      this._hideLoader()
    }
  }

  // ---------------------------------------------------------------------------
  // Page container setup
  // ---------------------------------------------------------------------------

  /**
   * Create a wrapper div for each page in the PDF.
   * Each wrapper contains: canvas + textLayer div + highlightLayer div.
   */
  _createPageContainers() {
    const container = this.pagesContainerTarget
    container.innerHTML = ""
    this._pageElements = []

    for (let i = 1; i <= this.pageCount; i++) {
      const wrapper = document.createElement("div")
      wrapper.className = "highlite-page"
      wrapper.dataset.pageNumber = i

      const canvas = document.createElement("canvas")
      canvas.className = "highlite-page-canvas"

      const textLayer = document.createElement("div")
      textLayer.className = "highlite-text-layer"

      const highlightLayer = document.createElement("div")
      highlightLayer.className = "highlite-highlight-layer"

      wrapper.appendChild(canvas)
      wrapper.appendChild(textLayer)
      wrapper.appendChild(highlightLayer)
      container.appendChild(wrapper)

      this._pageElements.push({ wrapper, canvas, textLayer, highlightLayer })
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  async _renderAllPages() {
    if (this._rendering) return
    this._rendering = true

    try {
      for (let i = 0; i < this._pageElements.length; i++) {
        const pageNum = i + 1
        const { canvas, textLayer } = this._pageElements[i]

        await this.renderer.renderPage(pageNum, canvas, this.scaleValue)

        const viewport = await this.renderer.getViewport(
          pageNum,
          this.scaleValue
        )

        // Size text layer to match canvas
        textLayer.style.width = `${Math.floor(viewport.width)}px`
        textLayer.style.height = `${Math.floor(viewport.height)}px`

        await this.renderer.renderTextLayer(pageNum, textLayer, viewport)
      }
    } finally {
      this._rendering = false
    }
  }

  async _rerenderAllPages() {
    // Remember scroll position relative to current page
    const scrollRatio = this._getScrollRatio()

    await this._renderAllPages()

    // Restore approximate scroll position
    this._restoreScrollRatio(scrollRatio)
  }

  _getScrollRatio() {
    const container = this.pagesContainerTarget
    if (!container.scrollHeight) return 0
    return container.scrollTop / container.scrollHeight
  }

  _restoreScrollRatio(ratio) {
    const container = this.pagesContainerTarget
    container.scrollTop = ratio * container.scrollHeight
  }

  // ---------------------------------------------------------------------------
  // Scroll tracking with IntersectionObserver
  // ---------------------------------------------------------------------------

  _setupIntersectionObserver() {
    if (this._observer) {
      this._observer.disconnect()
    }

    this._observer = new IntersectionObserver(
      (entries) => {
        // Find the most visible page
        let maxRatio = 0
        let visiblePage = this.currentPage

        for (const entry of entries) {
          if (entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            visiblePage = parseInt(entry.target.dataset.pageNumber, 10)
          }
        }

        if (visiblePage !== this.currentPage) {
          this.currentPage = visiblePage
          this._updatePageInfo(visiblePage)

          this.dispatch("page-changed", {
            detail: { page: visiblePage, totalPages: this.pageCount },
            prefix: "highlite",
          })
        }
      },
      {
        root: this.pagesContainerTarget,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    )

    for (const { wrapper } of this._pageElements) {
      this._observer.observe(wrapper)
    }
  }

  // ---------------------------------------------------------------------------
  // Zoom controls (actions)
  // ---------------------------------------------------------------------------

  zoomIn() {
    this.scaleValue = Math.min(this.scaleValue + 0.25, 5.0)
  }

  zoomOut() {
    this.scaleValue = Math.max(this.scaleValue - 0.25, 0.5)
  }

  /**
   * Fit the PDF page width to the container width.
   */
  async zoomFit() {
    if (!this.renderer || this.pageCount === 0) return

    const viewport = await this.renderer.getViewport(1, 1.0)
    const containerWidth = this.pagesContainerTarget.clientWidth - 32 // account for padding
    this.scaleValue = containerWidth / viewport.width
  }

  zoomAuto() {
    this.scaleValue = 1.5
  }

  // ---------------------------------------------------------------------------
  // Page navigation (action)
  // ---------------------------------------------------------------------------

  /**
   * Scroll to a specific page. Can be called as an action with params
   * or directly with a page number argument.
   * @param {Event|number} eventOrPage
   */
  scrollToPage(eventOrPage) {
    let pageNum

    if (typeof eventOrPage === "number") {
      pageNum = eventOrPage
    } else if (eventOrPage?.params?.page) {
      pageNum = eventOrPage.params.page
    } else {
      return
    }

    const index = pageNum - 1
    if (index < 0 || index >= this._pageElements.length) return

    this._pageElements[index].wrapper.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  _onKeydown(event) {
    // Only handle if viewer is visible / focused area
    if (!this.element.contains(document.activeElement) && document.activeElement !== document.body) {
      return
    }

    const ctrl = event.ctrlKey || event.metaKey

    if (ctrl && (event.key === "=" || event.key === "+")) {
      event.preventDefault()
      this.zoomIn()
    } else if (ctrl && event.key === "-") {
      event.preventDefault()
      this.zoomOut()
    } else if (ctrl && event.key === "0") {
      event.preventDefault()
      this.zoomAuto()
    }
  }

  // ---------------------------------------------------------------------------
  // UI updates
  // ---------------------------------------------------------------------------

  _updatePageInfo(page) {
    if (this.hasPageInfoTarget) {
      this.pageInfoTarget.textContent = `Page ${page} of ${this.pageCount}`
    }
  }

  _updateZoomDisplay() {
    if (this.hasZoomLevelTarget) {
      this.zoomLevelTarget.textContent = `${Math.round(this.scaleValue * 100)}%`
    }
  }

  _showLoader() {
    if (this.hasLoaderTarget) {
      this.loaderTarget.classList.remove("hidden")
    }
  }

  _hideLoader() {
    if (this.hasLoaderTarget) {
      this.loaderTarget.classList.add("hidden")
    }
  }

  _showError(message) {
    const container = this.pagesContainerTarget
    container.innerHTML = `
      <div class="highlite-error">
        <p>Failed to load PDF</p>
        <p class="highlite-error-detail">${this._escapeHtml(message)}</p>
      </div>
    `
  }

  _escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
