# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'The Florin Book'
copyright = '2026, Florin'
author = 'Bayge'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
extensions = ['sphinxcontrib.mermaid', 'build_agents']

templates_path = ['_templates']
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']



# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'alabaster'
html_static_path = ['_static']
html_favicon = '_static/images/favicon.ico'
html_css_files = ['book.css']
html_js_files = ['graph-examples.js']
html_title = 'The Florin Book'
html_baseurl = 'https://docs.florin.so/'
html_context = {
	'social_image_url': html_baseurl + '_static/images/opengraph.png',
}
html_theme_options = {
	'description': 'Never sell a share.',
	'fixed_sidebar': False,
}
# book.css supplies a restrained syntax palette for both color schemes.
pygments_style = 'sphinx'
