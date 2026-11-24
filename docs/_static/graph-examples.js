document.addEventListener('DOMContentLoaded', () => {
	for (const example of document.querySelectorAll('[data-graph-example]')) {
		const button = example.querySelector('[data-graph-run]');
		const status = example.querySelector('[data-graph-status]');
		const output = example.querySelector('[data-graph-response]');
		button.addEventListener('click', async () => {
			if (button.disabled) return;
			button.disabled = true;
			status.textContent = 'Sending query…';
			output.textContent = 'Waiting for a response…';
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);
			try {
				const response = await fetch('https://graph.superposition.so/robinhood-testnet/florin', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'omit',
					body: JSON.stringify({ query: example.querySelector('[data-graph-query]').value }),
					signal: controller.signal,
				});
				const body = await response.json();
				output.textContent = JSON.stringify(body, null, 2);
				if (!response.ok || body.errors?.length) {
					status.textContent = `Query failed (HTTP ${response.status}). See the response below.`;
				} else {
					status.textContent = body.extensions?.florinIndexedBlock
						? `Indexed through block ${body.extensions.florinIndexedBlock}.`
						: 'Query completed, but the ingestor checkpoint is unavailable.';
				}
			} catch (error) {
				status.textContent = error.name === 'AbortError'
					? 'Request timed out. You can try again.'
					: 'Could not read the graph response. Check your connection and browser cross-origin restrictions.';
				output.textContent = error.message;
			} finally {
				clearTimeout(timeout);
				button.disabled = false;
			}
		});
	}
});
