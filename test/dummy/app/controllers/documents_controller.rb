class DocumentsController < ApplicationController
  def show
    @pdf_url = "/convention-over-configuration.pdf"
    @document_id = "convention-over-configuration"
  end
end
