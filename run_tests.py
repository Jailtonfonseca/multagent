import subprocess
import sys
import os

def main():
    # Install dependencies
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "poetry"])
        # We need to be in the root of the project for poetry to find the pyproject.toml
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        subprocess.check_call([sys.executable, "-m", "poetry", "install"])
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)

    # Run tests
    try:
        subprocess.check_call([sys.executable, "-m", "poetry", "run", "pytest", "tests/test_llm_router.py"])
    except subprocess.CalledProcessError as e:
        print(f"Error running tests: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
