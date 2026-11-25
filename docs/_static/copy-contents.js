(() => {
	'use strict';

	function legacyCopy(text) {
		const focused = document.activeElement;
		const field = document.createElement('textarea');
		field.value = text;
		field.readOnly = true;
		field.setAttribute('aria-label', 'Page source in reStructuredText');
		field.style.cssText = 'position:fixed;left:-9999px;top:0';
		document.body.append(field);
		try {
			field.select();
			if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
		} finally {
			field.remove();
			focused?.focus({ preventScroll: true });
		}
	}

	document.addEventListener('DOMContentLoaded', () => {
		const link = document.querySelector('[data-copy-contents]');
		if (!link) return;
		const status = document.getElementById('copy-status');
		let busy = false;
		link.addEventListener('click', async (event) => {
			// Keep the real source link available through modified clicks and without JS.
			if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
			event.preventDefault();
			if (busy) return;
			busy = true;
			link.setAttribute('aria-disabled', 'true');
			status.textContent = 'Copying reStructuredText…';
			try {
				const response = await fetch(link.href, { credentials: 'same-origin' });
				if (!response.ok || response.headers.get('content-type')?.includes('text/html')) {
					throw new Error('Source unavailable');
				}
				const source = await response.text();
				try {
					if (!window.isSecureContext || !navigator.clipboard?.writeText) {
						throw new Error('Secure clipboard unavailable');
					}
					await navigator.clipboard.writeText(source);
				} catch {
					legacyCopy(source);
				}
				status.textContent = 'Copied reStructuredText to clipboard.';
			} catch {
				status.textContent = 'Could not copy contents. ';
				const manual = document.createElement('a');
				manual.href = link.href;
				manual.textContent = 'Open page source to copy manually.';
				status.append(manual);
			} finally {
				busy = false;
				link.removeAttribute('aria-disabled');
			}
		});
	});
})();
