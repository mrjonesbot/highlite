# frozen_string_literal: true

RSpec.describe Highlite do
  it "has a version number" do
    expect(Highlite::VERSION).not_to be nil
  end

  it "can be configured" do
    Highlite.configure do |config|
      expect(config).to be_a(Highlite::Configuration)
    end
  end
end
