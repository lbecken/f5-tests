"""epub2pdf-smart: EPUB -> fixed-layout PDF with competing pagination
strategies and an optional local-LLM layout judge."""

from .convert import Options, Report, convert

__version__ = "0.1.0"
__all__ = ["convert", "Options", "Report", "__version__"]
