import { Controller } from "@hotwired/stimulus"
import { HighlightStore } from "../lib/highlight_store"

/**
 * HighlightsPanelController — Stimulus controller for the default right sidebar.
 *
 * Displays all highlights grouped by page, with search/filter and clear-all
 * functionality. Updates in real-time as highlights are added/removed.
 *
 * Targets:
 *   list        - Container for the highlight cards
 *   searchInput - Text input for filtering highlights
 *   count       - Element displaying "N annotation(s)"
 *   clearBtn    - Clear all button
 *
 * Values:
 *   documentId (String) - Document ID for highlight store
 */
export default class extends Controller {
  static targets = ["list", "searchInput", "count", "clearBtn"]

  static values = {
    documentId: String,
  }

  connect() {
    this.store = new HighlightStore(this.documentIdValue)
    this.store.setEventTarget(this._getViewerElement() || this.element)
    this.store.load()

    this._searchQuery = ""

    // Bind event handlers
    this._onHighlightCreated = this._handleHighlightChange.bind(this)
    this._onHighlightRemoved = this._handleHighlightChange.bind(this)
    this._onHighlightsCleared = this._handleHighlightChange.bind(this)

    const viewer = this._getViewerElement()
    const target = viewer || this.element

    target.addEventListener(
      "highlite:highlight-created",
      this._onHighlightCreated
    )
    target.addEventListener(
      "highlite:highlight-removed",
      this._onHighlightRemoved
    )
    target.addEventListener(
      "highlite:highlights-cleared",
      this._onHighlightsCleared
    )

    this._renderList()
  }

  disconnect() {
    const viewer = this._getViewerElement()
    const target = viewer || this.element

    target.removeEventListener(
      "highlite:highlight-created",
      this._onHighlightCreated
    )
    target.removeEventListener(
      "highlite:highlight-removed",
      this._onHighlightRemoved
    )
    target.removeEventListener(
      "highlite:highlights-cleared",
      this._onHighlightsCleared
    )
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Filter highlights by search query (called on input event).
   */
  search() {
    this._searchQuery = this.hasSearchInputTarget
      ? this.searchInputTarget.value.trim()
      : ""
    this._renderList()
  }

  /**
   * Clear all highlights.
   */
  clearAll() {
    this.store.clear()
    this._renderList()
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  _handleHighlightChange() {
    // Reload from localStorage to pick up changes from other controllers
    this.store.load()
    this._renderList()
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  _renderList() {
    if (!this.hasListTarget) return

    const highlights = this._searchQuery
      ? this.store.search(this._searchQuery)
      : this._getAllFlat()

    this._updateCount(highlights.length)

    if (highlights.length === 0) {
      this.listTarget.innerHTML = this._emptyStateHtml()
      return
    }

    // Group by page
    const grouped = this._groupByPage(highlights)
    const pages = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b)

    const fragment = document.createDocumentFragment()

    for (const page of pages) {
      // Page header
      const header = document.createElement("div")
      header.className = "highlite-panel-page-header"
      header.textContent = `Page ${page}`
      fragment.appendChild(header)

      // Highlight cards for this page
      for (const highlight of grouped[page]) {
        fragment.appendChild(this._buildHighlightCard(highlight))
      }
    }

    this.listTarget.innerHTML = ""
    this.listTarget.appendChild(fragment)
  }

  /**
   * Build a single highlight card element.
   * @param {Object} highlight
   * @returns {HTMLElement}
   */
  _buildHighlightCard(highlight) {
    const card = document.createElement("button")
    card.type = "button"
    card.className = "highlite-panel-card"
    card.dataset.highlightId = highlight.id

    // Color swatch
    const swatch = document.createElement("span")
    swatch.className = "highlite-panel-swatch"
    swatch.style.backgroundColor = highlight.color

    // Type badge
    const badge = document.createElement("span")
    badge.className = "highlite-panel-badge"
    badge.textContent = highlight.type === "area" ? "Area" : "Text"

    // Quoted text (truncated)
    const text = document.createElement("span")
    text.className = "highlite-panel-text"
    text.textContent = highlight.text
      ? this._truncate(highlight.text, 80)
      : "(area selection)"

    // Timestamp
    const time = document.createElement("span")
    time.className = "highlite-panel-time"
    time.textContent = this._formatTime(highlight.createdAt)

    // Header row: swatch + badge + time
    const headerRow = document.createElement("div")
    headerRow.className = "highlite-panel-card-header"
    headerRow.appendChild(swatch)
    headerRow.appendChild(badge)
    headerRow.appendChild(time)

    card.appendChild(headerRow)
    card.appendChild(text)

    // Click to navigate to highlight and select it
    card.addEventListener("click", () => {
      this._navigateToHighlight(highlight)
    })

    return card
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  _navigateToHighlight(highlight) {
    const viewer = this._getViewerElement()
    if (!viewer) return

    // Scroll to the page
    const app = window.Stimulus || this.application
    const viewerController = app?.getControllerForElementAndIdentifier?.(
      viewer,
      "highlite--viewer"
    )

    if (viewerController) {
      viewerController.scrollToPage(highlight.page)
    }

    // Select the highlight
    this.store.select(highlight.id)
  }

  // ---------------------------------------------------------------------------
  // UI updates
  // ---------------------------------------------------------------------------

  _updateCount(count) {
    if (this.hasCountTarget) {
      this.countTarget.textContent = `${count} annotation${count !== 1 ? "s" : ""}`
    }

    if (this.hasClearBtnTarget) {
      this.clearBtnTarget.disabled = count === 0
    }
  }

  _emptyStateHtml() {
    if (this._searchQuery) {
      return '<p class="highlite-panel-empty">No matching annotations</p>'
    }
    return '<p class="highlite-panel-empty">No annotations yet. Select text or draw an area to highlight.</p>'
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _getAllFlat() {
    const grouped = this.store.getAll()
    const flat = []
    for (const page of Object.keys(grouped)) {
      flat.push(...grouped[page])
    }
    return flat
  }

  _groupByPage(highlights) {
    const grouped = {}
    for (const h of highlights) {
      if (!grouped[h.page]) grouped[h.page] = []
      grouped[h.page].push(h)
    }
    return grouped
  }

  _truncate(text, maxLen) {
    if (text.length <= maxLen) return text
    return text.substring(0, maxLen) + "..."
  }

  _formatTime(isoString) {
    if (!isoString) return ""
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    } catch {
      return ""
    }
  }

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
