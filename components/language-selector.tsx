'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function LanguageSelector() {
	const [open, setOpen] = useState(false);
	const id = useId();
	const container = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const option = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		option.current?.focus();
		function dismiss(event: PointerEvent) {
			if (!container.current?.contains(event.target as Node)) setOpen(false);
		}
		document.addEventListener('pointerdown', dismiss);
		return () => document.removeEventListener('pointerdown', dismiss);
	}, [open]);

	function close() {
		setOpen(false);
		trigger.current?.focus();
	}

	return (
		<div
			className="language-selector"
			ref={container}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
			}}
			onKeyDown={(event) => {
				if (open && event.key === 'Escape') {
					event.preventDefault();
					event.stopPropagation();
					close();
				}
			}}
		>
			<button
				ref={trigger}
				type="button"
				className="language-selector__trigger"
				aria-label="Select language"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				onClick={() => setOpen((value) => !value)}
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
					<circle cx="4" cy="10" r="1.6" />
					<circle cx="10" cy="10" r="1.6" />
					<circle cx="16" cy="10" r="1.6" />
				</svg>
			</button>
			{open && (
				<div id={id} className="language-selector__popup" role="dialog" aria-label="Select language">
					<p className="language-selector__title">Language</p>
					<button ref={option} type="button" className="language-selector__option" aria-pressed="true" onClick={close}>
						<span lang="en">English</span>
						<span aria-hidden="true">✓</span>
					</button>
				</div>
			)}
		</div>
	);
}
