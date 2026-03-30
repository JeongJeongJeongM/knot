#!/usr/bin/env python3
"""EXODIA v5.0 Setup — Extract and Test.

Usage:
    python exodia_setup.py              # Extract engine from zip
    python exodia_setup.py --test       # Extract + run 137 tests
    python exodia_setup.py --demo       # Extract + run E2E demo
"""
import os, sys, zipfile, subprocess

ZIP_NAME = "exodia_v5.0_deploy.zip"

def extract():
    if not os.path.exists(ZIP_NAME):
        print(f"ERROR: {ZIP_NAME} not found in current directory")
        sys.exit(1)
    print(f"Extracting {ZIP_NAME}...")
    with zipfile.ZipFile(ZIP_NAME) as zf:
        zf.extractall(".")
    print("Done! 105 files extracted")

def main():
    extract()
    if "--test" in sys.argv:
        print("\nRunning 137 tests...")
        r = subprocess.run([sys.executable, "-m", "pytest", "exodia/tests/", "-v", "--tb=short"])
        sys.exit(r.returncode)
    if "--demo" in sys.argv:
        print("\nRunning E2E demo...")
        r = subprocess.run([sys.executable, "demo_e2e.py"])
        sys.exit(r.returncode)
    print("\nNext steps:")
    print("  pip install pydantic pytest")
    print("  python -m pytest exodia/tests/ -v     # 137 tests")
    print("  python demo_e2e.py                    # E2E demo (free)")

if __name__ == "__main__":
    main()
