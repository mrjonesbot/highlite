# frozen_string_literal: true

module Highlite
  class Configuration
    attr_accessor :pdf_js_version, :default_colors, :toolbar_tools, :right_sidebar_partial

    def initialize
      @pdf_js_version = "5.4.624"
      @default_colors = [
        "rgba(255, 226, 143, 0.5)", # yellow
        "rgba(166, 227, 161, 0.5)", # green
        "rgba(137, 180, 250, 0.5)", # blue
        "rgba(245, 194, 231, 0.5)"  # pink
      ]
      @toolbar_tools = %i[text area]
      @right_sidebar_partial = nil
    end

    def self.instance
      @instance ||= new
    end

    def self.reset!
      @instance = new
    end
  end
end
