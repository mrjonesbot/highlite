/**
 * PdfRenderer — PDF.js wrapper that abstracts all PDF.js interactions.
 *
 * Loads a PDF document from a URL and provides methods for rendering pages,
 * text layers, thumbnails, and extracting metadata.
 *
 * @example
 *   const renderer = new PdfRenderer("/documents/sample.pdf")
 *   const { pageCount, title } = await renderer.load()
 *   await renderer.renderPage(1, canvasElement, 1.5)
 */

const PDFJS_WORKER_CDN =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs"

export class PdfRenderer {
  /**
   * @param {string} url - URL of the PDF to load
   * @param {Object} [options={}]
   * @param {string} [options.workerSrc] - Custom PDF.js worker URL
   */
  constructor(url, options = {}) {
    this.url = url
    this.options = options
    this.pdfjs = null
    this.document = null
    this._pages = new Map()
  }

  /**
   * Load the PDF document. Must be called before any other method.
   * @returns {Promise<{pageCount: number, title: string|null}>}
   */
  async load() {
    this.pdfjs = await import("pdfjs-dist")
    this.pdfjs.GlobalWorkerOptions.workerSrc =
      this.options.workerSrc || PDFJS_WORKER_CDN

    try {
      this.document = await this.pdfjs.getDocument({ url: this.url }).promise
    } catch (error) {
      throw new Error(`Failed to load PDF from ${this.url}: ${error.message}`)
    }

    const metadata = await this.document.getMetadata().catch(() => null)
    const title = metadata?.info?.Title || null

    return { pageCount: this.document.numPages, title }
  }

  /**
   * Get a cached page proxy.
   * @param {number} pageNum - 1-based page number
   * @returns {Promise<PDFPageProxy>}
   */
  async _getPage(pageNum) {
    if (!this.document) throw new Error("PDF not loaded. Call load() first.")
    if (pageNum < 1 || pageNum > this.document.numPages) {
      throw new RangeError(
        `Page ${pageNum} out of range (1-${this.document.numPages})`
      )
    }

    if (!this._pages.has(pageNum)) {
      this._pages.set(pageNum, await this.document.getPage(pageNum))
    }
    return this._pages.get(pageNum)
  }

  /**
   * Get the viewport for a page at a given scale.
   * @param {number} pageNum - 1-based page number
   * @param {number} scale
   * @returns {Promise<PDFPageViewport>}
   */
  async getViewport(pageNum, scale) {
    const page = await this._getPage(pageNum)
    return page.getViewport({ scale })
  }

  /**
   * Render a page onto a canvas element.
   * @param {number} pageNum - 1-based page number
   * @param {HTMLCanvasElement} canvas
   * @param {number} scale
   * @returns {Promise<void>}
   */
  async renderPage(pageNum, canvas, scale) {
    const page = await this._getPage(pageNum)
    const viewport = page.getViewport({ scale })
    const context = canvas.getContext("2d")

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`

    context.setTransform(dpr, 0, 0, dpr, 0, 0)

    await page.render({ canvasContext: context, viewport }).promise
  }

  /**
   * Render the selectable text layer for a page.
   * Creates positioned span elements that overlay the canvas for text selection.
   * @param {number} pageNum - 1-based page number
   * @param {HTMLElement} container - Element to render text spans into
   * @param {PDFPageViewport} viewport
   * @returns {Promise<void>}
   */
  async renderTextLayer(pageNum, container, viewport) {
    const page = await this._getPage(pageNum)
    const textContent = await page.getTextContent()

    // Clear existing text layer content
    container.innerHTML = ""

    // Use PDF.js TextLayer API
    const textLayer = new this.pdfjs.TextLayer({
      textContentSource: textContent,
      container,
      viewport,
    })

    await textLayer.render()
  }

  /**
   * Render a small thumbnail of a page.
   * @param {number} pageNum - 1-based page number
   * @param {HTMLCanvasElement} canvas
   * @param {number} [scale=0.2]
   * @returns {Promise<void>}
   */
  async renderThumbnail(pageNum, canvas, scale = 0.2) {
    await this.renderPage(pageNum, canvas, scale)
  }

  /**
   * Extract the outline (table of contents) from the PDF.
   * @returns {Promise<Array<{title: string, dest: *, items: Array}>>}
   */
  async getOutline() {
    if (!this.document) throw new Error("PDF not loaded. Call load() first.")

    const outline = await this.document.getOutline()
    if (!outline) return []

    return this._normalizeOutline(outline)
  }

  /**
   * Recursively normalize outline items, resolving page numbers from destinations.
   * @param {Array} items - Raw outline items from PDF.js
   * @returns {Promise<Array<{title: string, pageNum: number|null, items: Array}>>}
   */
  async _normalizeOutline(items) {
    const results = []

    for (const item of items) {
      let pageNum = null

      try {
        if (item.dest) {
          const dest =
            typeof item.dest === "string"
              ? await this.document.getDestination(item.dest)
              : item.dest

          if (dest && dest[0]) {
            const pageIndex = await this.document.getPageIndex(dest[0])
            pageNum = pageIndex + 1 // Convert 0-based to 1-based
          }
        }
      } catch {
        // Destination resolution can fail for malformed PDFs; skip silently
      }

      const children = item.items?.length
        ? await this._normalizeOutline(item.items)
        : []

      results.push({ title: item.title, pageNum, items: children })
    }

    return results
  }

  /**
   * Get plain text content for a page.
   * @param {number} pageNum - 1-based page number
   * @returns {Promise<string>}
   */
  async getPageText(pageNum) {
    const page = await this._getPage(pageNum)
    const textContent = await page.getTextContent()

    return textContent.items.map((item) => item.str).join(" ")
  }

  /**
   * Clean up resources. Call when the viewer is torn down.
   */
  destroy() {
    if (this.document) {
      this.document.destroy()
      this.document = null
    }
    this._pages.clear()
  }
}
