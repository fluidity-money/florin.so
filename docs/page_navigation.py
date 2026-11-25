"""Render the local outline without its redundant document-title wrapper."""

from docutils import nodes
from sphinx.environment.adapters.toctree import TocTree


def page_context(app, pagename, templatename, context, doctree):
	if doctree is None:
		return
	toc = TocTree(app.env).get_toc_for(pagename, app.builder)
	# Only unwrap a single document-title entry; preserve all section nesting.
	if isinstance(toc, nodes.bullet_list) and len(toc.children) == 1:
		entry = toc.children[0]
		link = next(entry.findall(nodes.reference), None)
		if link is not None and link.get('refuri') == '#':
			sections = next((child for child in entry.children if isinstance(child, nodes.bullet_list)), None)
			toc = sections if sections is not None else nodes.bullet_list()
	context['page_sections'] = app.builder.render_partial(toc)['fragment'] if toc.children else ''


def setup(app):
	app.connect('html-page-context', page_context)
	return {'parallel_read_safe': True, 'parallel_write_safe': True}
