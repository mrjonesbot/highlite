# frozen_string_literal: true

module Highlite
  module ApplicationHelper
    def highlite_viewer(url:, document_id:, **options)
      viewer_options = {
        url: url,
        document_id: document_id,
        scale: options.fetch(:scale, 2.25),
        show_toolbar: options.fetch(:show_toolbar, true),
        show_left_sidebar: options.fetch(:show_left_sidebar, true),
        show_right_sidebar: options.fetch(:show_right_sidebar, true),
        right_sidebar_partial: options[:right_sidebar_partial] ||
                               Highlite.configuration.right_sidebar_partial
      }

      render partial: "highlite/viewer", locals: viewer_options
    end
  end
end
