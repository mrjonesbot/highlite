# frozen_string_literal: true

module Highlite
  class Engine < ::Rails::Engine
    isolate_namespace Highlite

    initializer "highlite.assets" do |app|
      app.config.assets.paths << root.join("app/assets/stylesheets")
      app.config.assets.paths << root.join("app/javascript")
    end

    initializer "highlite.importmap", before: "importmap" do |app|
      if app.config.respond_to?(:importmap)
        app.config.importmap.paths << root.join("config/importmap.rb")
      end
    end

    initializer "highlite.helpers" do
      ActiveSupport.on_load(:action_controller_base) do
        helper Highlite::ApplicationHelper
      end
    end
  end
end
