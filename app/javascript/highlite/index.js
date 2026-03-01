import { Application } from "@hotwired/stimulus"
import ViewerController from "./controllers/viewer_controller"
import HighlightController from "./controllers/highlight_controller"
import SidebarController from "./controllers/sidebar_controller"
import HighlightsPanelController from "./controllers/highlights_panel_controller"

/**
 * Register all highlite Stimulus controllers with the given application.
 *
 * Controllers are registered with a "highlite--" prefix namespace so they
 * don't collide with host app controllers.
 *
 * @param {Application} application - Stimulus Application instance
 */
export function registerControllers(application) {
  application.register("highlite--viewer", ViewerController)
  application.register("highlite--highlight", HighlightController)
  application.register("highlite--sidebar", SidebarController)
  application.register("highlite--highlights-panel", HighlightsPanelController)
}

// Auto-register if a Stimulus application already exists on the window,
// or start a fresh one. This allows the gem to work out of the box
// when loaded via importmap without manual registration.
const application = window.Stimulus || Application.start()
registerControllers(application)

export { ViewerController, HighlightController, SidebarController, HighlightsPanelController }
export { PdfRenderer } from "./lib/pdf_renderer"
export { HighlightStore } from "./lib/highlight_store"
