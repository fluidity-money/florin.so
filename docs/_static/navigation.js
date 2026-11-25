document.addEventListener('DOMContentLoaded', () => {
	const toggle = document.querySelector('.mobile-nav-toggle');
	const sidebar = document.querySelector('.sphinxsidebar');
	if (!toggle || !sidebar) return;

	sidebar.id = 'docs-navigation';
	toggle.addEventListener('click', () => {
		toggle.setAttribute('aria-expanded', String(toggle.getAttribute('aria-expanded') !== 'true'));
	});
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && window.matchMedia('(width < 800px)').matches && toggle.getAttribute('aria-expanded') === 'true') {
			toggle.setAttribute('aria-expanded', 'false');
			toggle.focus();
		}
	});
});
