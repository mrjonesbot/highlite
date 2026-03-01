/**
 * HighlightStore — State management for highlights with localStorage persistence.
 *
 * Manages a collection of highlights for a specific document, persisting them
 * to localStorage and dispatching DOM events when highlights change.
 *
 * @example
 *   const store = new HighlightStore("doc-123")
 *   store.setEventTarget(viewerElement)
 *   store.load()
 *
 *   store.add({ page: 1, type: "text", color: "#ffd54f", rects: [...], text: "Hello" })
 *   const pageHighlights = store.getByPage(1)
 */

const STORAGE_PREFIX = "highlite-"

export class HighlightStore {
  /**
   * @param {string} documentId - Unique identifier for the document
   */
  constructor(documentId) {
    this.documentId = documentId
    this.storageKey = `${STORAGE_PREFIX}${documentId}`
    this._highlights = new Map()
    this._eventTarget = null
  }

  /**
   * Set the DOM element that will receive highlight events.
   * @param {HTMLElement} element
   */
  setEventTarget(element) {
    this._eventTarget = element
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Add a new highlight. Assigns an id and createdAt timestamp.
   * @param {Object} highlight
   * @param {number} highlight.page - Page number (1-based)
   * @param {string} highlight.type - "text" or "area"
   * @param {string} highlight.color - CSS color string
   * @param {Array<{x: number, y: number, w: number, h: number}>} highlight.rects
   * @param {string} [highlight.text] - Selected text content
   * @returns {Object} The created highlight with id and createdAt
   */
  add(highlight) {
    const entry = {
      id: crypto.randomUUID(),
      page: highlight.page,
      type: highlight.type || "text",
      color: highlight.color || "#ffd54f",
      rects: highlight.rects || [],
      text: highlight.text || "",
      note: highlight.note || "",
      createdAt: new Date().toISOString(),
    }

    this._highlights.set(entry.id, entry)
    this.save()
    this._dispatch("highlite:highlight-created", entry)

    return entry
  }

  /**
   * Remove a highlight by id.
   * @param {string} id
   * @returns {boolean} True if the highlight was found and removed
   */
  remove(id) {
    const existed = this._highlights.delete(id)
    if (existed) {
      this.save()
      this._dispatch("highlite:highlight-removed", { id })
    }
    return existed
  }

  /**
   * Get all highlights grouped by page number.
   * @returns {Object<number, Array>} Highlights keyed by page number
   */
  getAll() {
    const grouped = {}
    for (const highlight of this._highlights.values()) {
      if (!grouped[highlight.page]) {
        grouped[highlight.page] = []
      }
      grouped[highlight.page].push(highlight)
    }
    return grouped
  }

  /**
   * Get highlights for a specific page.
   * @param {number} page - 1-based page number
   * @returns {Array} Highlights on the given page
   */
  getByPage(page) {
    const results = []
    for (const highlight of this._highlights.values()) {
      if (highlight.page === page) {
        results.push(highlight)
      }
    }
    return results
  }

  /**
   * Get a single highlight by id.
   * @param {string} id
   * @returns {Object|undefined}
   */
  getById(id) {
    return this._highlights.get(id)
  }

  /**
   * Clear highlights. If page is given, clear only that page; otherwise clear all.
   * @param {number|null} [page=null]
   */
  clear(page = null) {
    if (page !== null) {
      for (const [id, highlight] of this._highlights) {
        if (highlight.page === page) {
          this._highlights.delete(id)
        }
      }
    } else {
      this._highlights.clear()
    }

    this.save()
    this._dispatch("highlite:highlights-cleared", { page })
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Search highlights by text content (case-insensitive).
   * @param {string} query
   * @returns {Array} Matching highlights
   */
  search(query) {
    const lower = query.toLowerCase()
    const results = []
    for (const highlight of this._highlights.values()) {
      if (highlight.text && highlight.text.toLowerCase().includes(lower)) {
        results.push(highlight)
      }
    }
    return results
  }

  // ---------------------------------------------------------------------------
  // Selection (for UI interactions)
  // ---------------------------------------------------------------------------

  /**
   * Mark a highlight as selected, dispatching a selection event.
   * @param {string} id
   */
  select(id) {
    const highlight = this._highlights.get(id)
    if (highlight) {
      this._dispatch("highlite:highlight-selected", {
        id,
        page: highlight.page,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  /**
   * Persist all highlights to localStorage.
   */
  save() {
    try {
      const data = Array.from(this._highlights.values())
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch {
      // localStorage may be full or unavailable; fail silently
    }
  }

  /**
   * Load highlights from localStorage.
   */
  load() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return

      const data = JSON.parse(raw)
      if (!Array.isArray(data)) return

      this._highlights.clear()
      for (const item of data) {
        if (item.id && item.page) {
          this._highlights.set(item.id, item)
        }
      }
    } catch {
      // Corrupted data; start fresh
      this._highlights.clear()
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Dispatch a custom event on the event target element.
   * @param {string} name - Event name
   * @param {Object} detail - Event detail payload
   */
  _dispatch(name, detail) {
    if (!this._eventTarget) return

    this._eventTarget.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true })
    )
  }
}
