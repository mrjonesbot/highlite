# frozen_string_literal: true

module Highlite
  module Generators
    class InstallGenerator < Rails::Generators::Base
      source_root File.expand_path("templates", __dir__)

      desc "Install Highlite: creates initializer and optionally copies sidebar override template"

      class_option :sidebar, type: :boolean, default: false,
                             desc: "Copy the right sidebar partial for customization"

      def create_initializer
        template "initializer.rb.tt", "config/initializers/highlite.rb"
      end

      def copy_sidebar_override
        return unless options[:sidebar]

        template "_right_sidebar.html.erb.tt",
                 "app/views/highlite/_right_sidebar.html.erb"
      end

      def add_importmap_pin
        return unless File.exist?(Rails.root.join("config/importmap.rb"))

        append_to_file "config/importmap.rb", <<~RUBY

          # Highlite
          pin "highlite", to: "highlite/index.js"
        RUBY
      end

      def show_readme
        say ""
        say "Highlite installed successfully!", :green
        say ""
        say "Usage in any view:"
        say '  <%= highlite_viewer(url: url_for(@document.file), document_id: @document.id) %>'
        say ""
      end
    end
  end
end
