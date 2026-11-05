#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Antero Fagerstedt
# SPDX-License-Identifier: GPL-3.0-or-later
"""Package the static site and its complete corresponding source, without Git data."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile


ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "index.html", "licenses.html", "LICENSE", "README.md",
    "THIRD_PARTY_NOTICES.md", "ARTWORK.md", "third-party-manifest.json",
    "categories.js", "embeddings.js", "embedding-worker.js", "game.js",
    "finnish-inflections.js", "finnish-inflections-worker.js", "wikipedia.js",
    "start-local.sh", "tools/prepare_release.py", "favicon.ico",
    "images/denantle-icon.png", "images/denantle-wordmark.png", "images/denantle-mark.png",
    "images/favicon-32.png", "images/icon-192.png", "images/apple-touch-icon.png",
    "vendor/compromise-14.19.0.js", "vendor/compromise-LICENSE.txt",
    "vendor/voikko-1.0.1.min.js", "source/voikko-corresponding-source.tar.gz",
    "licenses/Apache-2.0.txt", "licenses/CC-BY-SA-4.0.txt",
    "licenses/Emscripten-LICENSE.txt", "licenses/Hugging-Face-Jinja-LICENSE.txt",
    "licenses/ONNX-Runtime-LICENSE.txt", "licenses/ONNX-Runtime-ThirdPartyNotices.txt",
    "licenses/Voikko-Finnish-GPL-2.0.txt", "licenses/Voikko-Core-LICENSE.txt",
    "licenses/Voikko-COPYING.txt", "licenses/model-en-README.md",
    "licenses/model-fi-README.md",
)


def prepare_release(output):
    """Create a new output directory atomically; never overwrite an existing one."""
    output = output.absolute()
    if output.exists() or output.is_symlink():
        raise ValueError(f"Output already exists: {output}. Choose a new directory.")
    for name in FILES:
        source = ROOT / name
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Missing file or symbolic link in release inputs: {name}")
    manifest = json.loads((ROOT / "third-party-manifest.json").read_text())
    for entry in manifest["files"]:
        if entry["path"] not in FILES:
            raise ValueError(f"Manifest file is absent from release inputs: {entry['path']}")
        data = (ROOT / entry["path"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Third-party checksum mismatch: {entry['path']}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".denantle-release-", dir=output.parent) as temporary:
        site = Path(temporary) / "site"
        for name in FILES:
            target = site / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
        # Archive the staged bytes, so the source and the published site match.
        archive = site / "source/denantle-source.tar.gz"
        with archive.open("wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", filename="", mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as bundle:
                for name in sorted(FILES):
                    path = site / name
                    info = tarfile.TarInfo("denantle/" + name)
                    info.size = path.stat().st_size
                    info.mode = 0o755 if path.stat().st_mode & 0o111 else 0o644
                    info.mtime = 0
                    with path.open("rb") as data:
                        bundle.addfile(info, data)
        checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
        (site / "source/denantle-source.tar.gz.sha256").write_text(
            checksum + "  denantle-source.tar.gz\n", encoding="utf-8",
        )
        site.rename(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist", help="New static-site directory (default: dist)")
    arguments = parser.parse_args()
    try:
        output = prepare_release(arguments.output)
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, f"Release preparation failed: {error}\n")
    print(f"Publication directory: {output}")
    print("Publish the entire directory, including licenses/ and source/.")


if __name__ == "__main__":
    main()
