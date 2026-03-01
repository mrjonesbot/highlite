import { Controller } from "@hotwired/stimulus"
import { HighlightStore } from "../lib/highlight_store"

/**
 * HighlightController — Stimulus controller for drawing and managing highlights.
 *
 * Handles text selection highlighting (via Selection API), area/rectangle
 * highlighting (mousedown→drag→mouseup), and rendering highlight overlays
 * on PDF pages.
 *
 * Values:
 *   documentId  (String) - Document ID for highlight persistence
 *   activeColor (String) - Current highlight color (default "#ffd54f")
 *   activeTool  (String) - Current tool: "select" | "text" | "area"
 *
 * Actions:
 *   setColor, setTool, clearPage, clearAll
 *
 * Listens for:
 *   highlite:document-loaded  — initialize highlights for all pages
 *   highlite:page-changed     — page-specific updates
 */
export default class extends Controller {
  static values = {
    documentId: String,
    activeColor: { type: String, default: "#ffd54f" },
    activeTool: { type: String, default: "select" },
  }

  connect() {
    this.store = new HighlightStore(this.documentIdValue)
    this.store.setEventTarget(this.element)
    this.store.load()

    // Area drawing state
    this._drawing = false
    this._drawStart = null
    this._drawPreview = null
    this._drawPage = null

    // Bind event handlers
    this._onDocumentLoaded = this._handleDocumentLoaded.bind(this)
    this._onMouseUp = this._handleMouseUp.bind(this)
    this._onMouseDown = this._handleMouseDown.bind(this)
    this._onMouseMove = this._handleMouseMove.bind(this)
    this._onTouchStart = this._handleTouchStart.bind(this)
    this._onTouchMove = this._handleTouchMove.bind(this)
    this._onTouchEnd = this._handleTouchEnd.bind(this)

    // External store sync handlers (e.g. when highlights_panel clears all)
    this._onExternalClear = this._handleExternalClear.bind(this)
    this._onExternalRemove = this._handleExternalRemove.bind(this)

    this.element.addEventListener(
      "highlite:document-loaded",
      this._onDocumentLoaded
    )
    this.element.addEventListener(
      "highlite:highlights-cleared",
      this._onExternalClear
    )
    this.element.addEventListener(
      "highlite:highlight-removed",
      this._onExternalRemove
    )
    this.element.addEventListener("mouseup", this._onMouseUp)
    this.element.addEventListener("mousedown", this._onMouseDown)
    this.element.addEventListener("mousemove", this._onMouseMove)
    this.element.addEventListener("touchstart", this._onTouchStart, {
      passive: false,
    })
    this.element.addEventListener("touchmove", this._onTouchMove, {
      passive: false,
    })
    this.element.addEventListener("touchend", this._onTouchEnd)
  }

  disconnect() {
    this.element.removeEventListener(
      "highlite:document-loaded",
      this._onDocumentLoaded
    )
    this.element.removeEventListener(
      "highlite:highlights-cleared",
      this._onExternalClear
    )
    this.element.removeEventListener(
      "highlite:highlight-removed",
      this._onExternalRemove
    )
    this.element.removeEventListener("mouseup", this._onMouseUp)
    this.element.removeEventListener("mousedown", this._onMouseDown)
    this.element.removeEventListener("mousemove", this._onMouseMove)
    this.element.removeEventListener("touchstart", this._onTouchStart)
    this.element.removeEventListener("touchmove", this._onTouchMove)
    this.element.removeEventListener("touchend", this._onTouchEnd)

    this._cleanupDrawPreview()
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Set the active highlight color.
   * @param {Event} event - Event with params.color
   */
  setColor(event) {
    const color = event.params?.color || event.detail?.color
    if (color) this.activeColorValue = color
  }

  /**
   * Set the active tool: "select", "text", or "area".
   * @param {Event} event - Event with params.tool
   */
  setTool(event) {
    const tool = event.params?.tool || event.detail?.tool
    if (tool) {
      this.activeToolValue = tool
      this._updateCursor()
    }
  }

  /**
   * Clear highlights for the currently visible page.
   */
  clearPage() {
    const page = this._getCurrentPage()
    if (page) {
      this.store.clear(page)
      this._renderPageHighlights(page)
    }
  }

  /**
   * Clear all highlights for this document.
   */
  clearAll() {
    this.store.clear()
    this._renderAllHighlights()
  }

  // ---------------------------------------------------------------------------
  // Document loaded handler
  // ---------------------------------------------------------------------------

  _handleDocumentLoaded() {
    // Render existing highlights on all pages
    this._renderAllHighlights()
  }

  /**
   * Handle external highlights-cleared events (e.g. from highlights_panel clearAll).
   * Reloads store from localStorage and re-renders all pages.
   */
  _handleExternalClear() {
    this.store.load()
    this._renderAllHighlights()
  }

  /**
   * Handle external highlight-removed events (e.g. from another controller).
   * Reloads store from localStorage and re-renders affected page.
   */
  _handleExternalRemove() {
    this.store.load()
    this._renderAllHighlights()
  }

  // ---------------------------------------------------------------------------
  // Text highlight — mouseup on text layer
  // ---------------------------------------------------------------------------

  _handleMouseUp(event) {
    if (this._drawing) {
      this._finishAreaDraw(event)
      return
    }

    if (this.activeToolValue !== "text") return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return
    }

    const pageWrapper = this._findPageWrapper(selection.anchorNode)
    if (!pageWrapper) return

    const pageNum = parseInt(pageWrapper.dataset.pageNumber, 10)
    const text = selection.toString().trim()
    const rects = this._getSelectionRects(selection, pageWrapper)

    if (rects.length === 0) return

    this.store.add({
      page: pageNum,
      type: "text",
      color: this.activeColorValue,
      rects,
      text,
    })

    selection.removeAllRanges()
    this._renderPageHighlights(pageNum)
  }

  /**
   * Convert Selection API ranges to rectangles relative to the page wrapper.
   * @param {Selection} selection
   * @param {HTMLElement} pageWrapper
   * @returns {Array<{x: number, y: number, w: number, h: number}>}
   */
  _getSelectionRects(selection, pageWrapper) {
    const rects = []
    const wrapperRect = pageWrapper.getBoundingClientRect()

    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i)
      const clientRects = range.getClientRects()

      for (const rect of clientRects) {
        if (rect.width < 1 || rect.height < 1) continue

        rects.push({
          x: rect.left - wrapperRect.left,
          y: rect.top - wrapperRect.top,
          w: rect.width,
          h: rect.height,
        })
      }
    }

    return this._mergeOverlappingRects(rects)
  }

  /**
   * Merge overlapping or adjacent rectangles to reduce clutter.
   * @param {Array<{x: number, y: number, w: number, h: number}>} rects
   * @returns {Array<{x: number, y: number, w: number, h: number}>}
   */
  _mergeOverlappingRects(rects) {
    if (rects.length <= 1) return rects

    // Sort by y then x
    rects.sort((a, b) => a.y - b.y || a.x - b.x)

    const merged = [rects[0]]
    for (let i = 1; i < rects.length; i++) {
      const last = merged[merged.length - 1]
      const curr = rects[i]

      // Merge if same line (similar y) and overlapping/adjacent horizontally
      if (
        Math.abs(curr.y - last.y) < 3 &&
        curr.x <= last.x + last.w + 2
      ) {
        const right = Math.max(last.x + last.w, curr.x + curr.w)
        last.w = right - last.x
        last.h = Math.max(last.h, curr.h)
      } else {
        merged.push(curr)
      }
    }

    return merged
  }

  // ---------------------------------------------------------------------------
  // Area highlight — mousedown → drag → mouseup
  // ---------------------------------------------------------------------------

  _handleMouseDown(event) {
    if (this.activeToolValue !== "area") return
    if (event.button !== 0) return // Left click only

    const pageWrapper = this._findPageWrapper(event.target)
    if (!pageWrapper) return

    event.preventDefault()
    const wrapperRect = pageWrapper.getBoundingClientRect()

    this._drawing = true
    this._drawPage = pageWrapper
    this._drawStart = {
      x: event.clientX - wrapperRect.left,
      y: event.clientY - wrapperRect.top,
    }

    // Create preview rectangle
    this._drawPreview = document.createElement("div")
    this._drawPreview.className = "highlite-area-preview"
    this._drawPreview.style.cssText = `
      position: absolute;
      border: 2px dashed ${this.activeColorValue};
      background: ${this.activeColorValue}33;
      pointer-events: none;
      z-index: 10;
    `
    const highlightLayer = pageWrapper.querySelector(
      ".highlite-highlight-layer"
    )
    if (highlightLayer) {
      highlightLayer.appendChild(this._drawPreview)
    }
  }

  _handleMouseMove(event) {
    if (!this._drawing || !this._drawPreview || !this._drawPage) return

    const wrapperRect = this._drawPage.getBoundingClientRect()
    const x = event.clientX - wrapperRect.left
    const y = event.clientY - wrapperRect.top

    const left = Math.min(this._drawStart.x, x)
    const top = Math.min(this._drawStart.y, y)
    const width = Math.abs(x - this._drawStart.x)
    const height = Math.abs(y - this._drawStart.y)

    this._drawPreview.style.left = `${left}px`
    this._drawPreview.style.top = `${top}px`
    this._drawPreview.style.width = `${width}px`
    this._drawPreview.style.height = `${height}px`
  }

  _finishAreaDraw(event) {
    if (!this._drawPage || !this._drawStart) {
      this._cleanupDrawPreview()
      return
    }

    const wrapperRect = this._drawPage.getBoundingClientRect()
    const endX = event.clientX - wrapperRect.left
    const endY = event.clientY - wrapperRect.top

    const x = Math.min(this._drawStart.x, endX)
    const y = Math.min(this._drawStart.y, endY)
    const w = Math.abs(endX - this._drawStart.x)
    const h = Math.abs(endY - this._drawStart.y)

    const pageNum = parseInt(this._drawPage.dataset.pageNumber, 10)

    // Only create highlight if area is large enough (> 5px in both dimensions)
    if (w > 5 && h > 5) {
      this.store.add({
        page: pageNum,
        type: "area",
        color: this.activeColorValue,
        rects: [{ x, y, w, h }],
        text: "",
      })
      this._renderPageHighlights(pageNum)
    }

    this._cleanupDrawPreview()
  }

  _cleanupDrawPreview() {
    if (this._drawPreview) {
      this._drawPreview.remove()
      this._drawPreview = null
    }
    this._drawing = false
    this._drawStart = null
    this._drawPage = null
  }

  // ---------------------------------------------------------------------------
  // Touch event support — map to mouse equivalents
  // ---------------------------------------------------------------------------

  _handleTouchStart(event) {
    if (this.activeToolValue !== "area") return
    if (event.touches.length !== 1) return

    const touch = event.touches[0]
    event.preventDefault()

    this._handleMouseDown({
      target: touch.target,
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      preventDefault: () => {},
    })
  }

  _handleTouchMove(event) {
    if (!this._drawing) return
    if (event.touches.length !== 1) return

    const touch = event.touches[0]
    event.preventDefault()

    this._handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
  }

  _handleTouchEnd(event) {
    if (!this._drawing) return

    const touch = event.changedTouches[0]
    this._finishAreaDraw({
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
  }

  // ---------------------------------------------------------------------------
  // Highlight rendering
  // ---------------------------------------------------------------------------

  /**
   * Render highlights on all pages.
   */
  _renderAllHighlights() {
    const pages = this.element.querySelectorAll(".highlite-page")
    for (const page of pages) {
      const pageNum = parseInt(page.dataset.pageNumber, 10)
      this._renderPageHighlights(pageNum)
    }
  }

  /**
   * Render highlight overlays for a specific page.
   * @param {number} pageNum
   */
  _renderPageHighlights(pageNum) {
    const page = this.element.querySelector(
      `.highlite-page[data-page-number="${pageNum}"]`
    )
    if (!page) return

    const layer = page.querySelector(".highlite-highlight-layer")
    if (!layer) return

    // Clear existing highlight divs (but not the draw preview)
    const existing = layer.querySelectorAll(".highlite-highlight")
    existing.forEach((el) => el.remove())

    const highlights = this.store.getByPage(pageNum)

    for (const highlight of highlights) {
      for (const rect of highlight.rects) {
        const div = document.createElement("div")
        div.className = "highlite-highlight"
        div.dataset.highlightId = highlight.id
        div.style.cssText = `
          position: absolute;
          left: ${rect.x}px;
          top: ${rect.y}px;
          width: ${rect.w}px;
          height: ${rect.h}px;
          background-color: ${highlight.color};
          mix-blend-mode: multiply;
          cursor: pointer;
          transition: opacity 0.15s;
          pointer-events: auto;
        `

        // Click to select
        div.addEventListener("click", (e) => {
          e.stopPropagation()
          this.store.select(highlight.id)
        })

        // Right-click to remove
        div.addEventListener("contextmenu", (e) => {
          e.preventDefault()
          e.stopPropagation()
          this.store.remove(highlight.id)
          this._renderPageHighlights(pageNum)
        })

        // Hover effect
        div.addEventListener("mouseenter", () => {
          div.style.opacity = "0.6"
        })
        div.addEventListener("mouseleave", () => {
          div.style.opacity = "1"
        })

        layer.appendChild(div)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Find the closest page wrapper element from a target node.
   * @param {Node} node
   * @returns {HTMLElement|null}
   */
  _findPageWrapper(node) {
    if (node instanceof HTMLElement) {
      return node.closest(".highlite-page")
    }
    // Text node — use parentElement
    return node?.parentElement?.closest(".highlite-page") || null
  }

  /**
   * Get the current page number from the viewer controller's page info.
   * @returns {number|null}
   */
  _getCurrentPage() {
    const pageInfo = this.element.querySelector(
      "[data-highlite--viewer-target='pageInfo']"
    )
    if (!pageInfo) return 1

    const match = pageInfo.textContent.match(/Page (\d+)/)
    return match ? parseInt(match[1], 10) : 1
  }

  /**
   * Update the cursor style based on the active tool.
   */
  _updateCursor() {
    const pages = this.element.querySelectorAll(
      ".highlite-highlight-layer"
    )
    const cursor =
      this.activeToolValue === "area" ? "crosshair" : "default"

    for (const page of pages) {
      page.style.cursor = cursor
    }
  }
}
