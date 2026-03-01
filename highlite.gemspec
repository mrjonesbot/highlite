# frozen_string_literal: true

require_relative "lib/highlite/version"

Gem::Specification.new do |spec|
  spec.name = "highlite"
  spec.version = Highlite::VERSION
  spec.authors = ["Nathan Jones"]
  spec.email = ["natejones@hey.com"]

  spec.summary = "Rails engine providing a PDF viewer with text and area highlighting"
  spec.description = "A Rails engine that wraps PDF.js to provide a full-featured PDF viewer " \
                     "with text and area highlighting, powered by Stimulus controllers and Tailwind CSS. " \
                     "Includes a three-panel layout with outline/thumbnails sidebar, highlight management, " \
                     "and an overridable right sidebar for custom integrations."
  spec.homepage = "https://github.com/nathanjones/highlite"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.1.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/nathanjones/highlite"
  spec.metadata["changelog_uri"] = "https://github.com/nathanjones/highlite/blob/main/CHANGELOG.md"

  # Specify which files should be added to the gem when it is released.
  # The `git ls-files -z` loads the files in the RubyGem that have been added into git.
  gemspec = File.basename(__FILE__)
  spec.files = IO.popen(%w[git ls-files -z], chdir: __dir__, err: IO::NULL) do |ls|
    ls.readlines("\x0", chomp: true).reject do |f|
      (f == gemspec) ||
        f.start_with?(*%w[bin/ Gemfile .gitignore .rspec spec/ .github/ .rubocop.yml])
    end
  end
  spec.bindir = "exe"
  spec.executables = spec.files.grep(%r{\Aexe/}) { |f| File.basename(f) }
  spec.require_paths = ["lib"]

  spec.add_dependency "rails", ">= 7.1"
  spec.add_dependency "importmap-rails"
end
