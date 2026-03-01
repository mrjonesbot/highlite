require_relative "boot"

require "action_controller/railtie"
require "action_view/railtie"
require "propshaft"
require "importmap-rails"
require "highlite"

module Dummy
  class Application < Rails::Application
    config.load_defaults Rails::VERSION::STRING.to_f
    config.eager_load = false
    config.secret_key_base = "test-secret-key-base-for-dummy-app"
  end
end
