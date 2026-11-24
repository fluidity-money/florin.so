"""Combine documentation sources into a single downloadable RST file."""

import argparse
from pathlib import Path


def build_agents(source: Path, output: Path) -> None:
	pages = sorted(
		path for path in source.rglob("*.rst")
		if not any(part.startswith(("_", ".")) for part in path.relative_to(source).parts)
		and path.resolve() != output.resolve()
	)
	index = source / "index.rst"
	if index in pages:
		pages.remove(index)
		pages.insert(0, index)
	if not pages:
		raise ValueError(f"No documentation sources found in {source}")
	sections = [
		f".. Source: {path.relative_to(source).as_posix()}\n\n{path.read_text(encoding='utf-8').rstrip()}\n"
		for path in pages
	]
	output.parent.mkdir(parents=True, exist_ok=True)
	output.write_text("\n\n".join(sections), encoding="utf-8")


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description=__doc__)
	parser.add_argument("output", type=Path)
	args = parser.parse_args()
	build_agents(Path(__file__).resolve().parent, args.output)
