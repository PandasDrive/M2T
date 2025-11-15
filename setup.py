import sys
import subprocess
import os
import venv
import webbrowser
import time

# Define the name of the virtual environment directory
VENV_DIR = "venv"

def create_virtual_env():
    """Creates a virtual environment if it doesn't exist."""
    if not os.path.exists(VENV_DIR):
        print(f"Creating virtual environment in ./{VENV_DIR}...")
        try:
            venv.create(VENV_DIR, with_pip=True)
            print("Virtual environment created successfully.")
        except Exception as e:
            print(f"Error creating virtual environment: {e}")
            sys.exit(1)
    else:
        print("Virtual environment already exists.")

def get_pip_path():
    """Gets the path to the pip executable within the venv."""
    if sys.platform == "win32":
        return os.path.join(VENV_DIR, "Scripts", "pip.exe")
    else:
        return os.path.join(VENV_DIR, "bin", "pip")

def get_python_path():
    """Gets the path to the python executable within the venv."""
    if sys.platform == "win32":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    else:
        return os.path.join(VENV_DIR, "bin", "python")

def install_requirements():
    """Installs dependencies from requirements.txt using the venv's pip."""
    pip_path = get_pip_path()
    requirements_file = "requirements.txt"
    
    if not os.path.exists(requirements_file):
        print(f"Error: {requirements_file} not found.")
        print("Please make sure it's in the same directory as setup.py.")
        sys.exit(1)

    print("--- Ensuring pip is up-to-date ---")
    try:
        subprocess.check_call([get_python_path(), "-m", "pip", "install", "--upgrade", "pip"])
    except subprocess.CalledProcessError as e:
        print(f"Could not upgrade pip: {e}. Continuing with installation...")

    print(f"--- Installing dependencies from {requirements_file} ---")
    try:
        # We run pip as a module of the venv's python to ensure correctness
        subprocess.check_call([get_python_path(), "-m", "pip", "install", "-r", requirements_file])
        print("Dependencies installed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"Error installing dependencies: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"Error: '{get_python_path()}' or 'pip' not found in venv.")
        print("Virtual environment may be corrupted.")
        sys.exit(1)

def run_application():
    """Runs the main Flask application using the venv's python."""
    python_path = get_python_path()
    app_file = "app.py"
    
    if not os.path.exists(app_file):
        print(f"Error: {app_file} not found.")
        print("Please make sure it's in the same directory as setup.py.")
        sys.exit(1)
        
    print(f"Starting the Flask application ({app_file})...")
    print("Find the application at http://127.0.0.1:5000")
    print("Press CTRL+C to stop the server.")
    
    # --- Auto-open browser ---
    def open_browser():
        time.sleep(2) # Give the server a moment to start
        webbrowser.open('http://127.0.0.1:5000')
        
    from threading import Thread
    browser_thread = Thread(target=open_browser)
    browser_thread.start()
    # ---
    
    try:
        subprocess.check_call([python_path, app_file])
    except subprocess.CalledProcessError as e:
        print(f"Application exited with error: {e}")
    except KeyboardInterrupt:
        print("\nServer stopped by user.")

if __name__ == "__main__":
    print("--- Morse Code Application Setup ---")
    create_virtual_env()
    install_requirements()
    print("--- Setup complete ---")
    run_application()
