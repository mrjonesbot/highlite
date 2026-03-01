# frozen_string_literal: true

require_relative "highlite/version"
require_relative "highlite/configuration"
require_relative "highlite/engine"

module Highlite
  class Error < StandardError; end

  def self.configure
    yield Configuration.instance
  end

  def self.configuration
    Configuration.instance
  end
end
