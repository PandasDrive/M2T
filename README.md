# Morse Code Audio Processor

##  overview

This project is a self-contained, web-based Morse code toolkit built with Python and Flask. It provides a simple user interface to perform two primary functions:

1.  **Text-to-Morse:** Convert any text string into a downloadable Morse code `.wav` audio file.
2.  **Morse-to-Text:** Upload a `.wav` file containing Morse code and receive a live transcription of the audio.

The entire application is designed to run locally on a private network, with all dependencies managed within a Python virtual environment.

---

## 🧭 Core Features

* **Text-to-Morse Generation:**
    * Accepts user text input.
    * Generates a clean Morse code audio signal at a standard WPM (Words Per Minute).
    * Provides the generated `.wav` file for playback and download directly in the browser.

* **Audio-to-Text Transcription:**
    * Accepts user `.wav` file uploads.
    * **Live Transcription:** As the audio plays, the decoded characters appear on the screen in real-time, synchronized with the audio playback.
    * **Full Summary:** A complete transcription of the entire message is populated at the bottom of the page.
    * **Signal Visualization:** Displays a simple waveform of the audio signal, with a "playhead" that tracks the current playback position.

* **Self-Contained & Private:**
    * Runs entirely on a local Flask server.
    * Requires no external internet access or third-party APIs for its core processing.
    * Includes a setup script (`setup.py`) to automatically create a virtual environment and install all necessary dependencies.

---

## 🛠️ Tech Stack & Architecture

This project uses a simple client-server architecture.

* **Backend (Server-Side):**
    * **Framework:** **Flask** (a Python micro-framework) serves the web page, handles file uploads, and manages all API endpoints.
    * **Audio Generation:** **Pydub** is used to create sine-wave-based audio segments for generating Morse code tones.
    * **Audio Analysis:** **Librosa** and **Scipy** are used to load audio files, perform signal processing (band-pass filtering), and detect the signal envelope.
    * **Core Logic:** A custom **NumPy**-based algorithm analyzes the "on" (mark) and "off" (space) durations to decode the binary signal into Morse elements (dots, dashes, spaces) and, finally, text.

* **Frontend (Client-Side):**
    * **HTML5:** Provides the structure for the two main interface panels.
    * **CSS3:** Simple, clean styling for a user-friendly layout.
    * **JavaScript (ES6+):**
        * Uses the **Fetch API** to communicate with the Flask backend.
        * Manages all UI interactivity (showing/hiding elements, handling button clicks).
        * Uses the **Web Audio API** (`AudioContext`) to load and draw the waveform visualization onto an HTML **Canvas**.
        * Synchronizes the audio `currentTime` with the transcription event timestamps to create the live-display effect.

---

## 📂 File Structure

morse_app/ ├── app.py # Main Flask application (routes, file handling) ├── morse_processor.py # Core logic (text-to-morse, audio-to-text) ├── setup.py # Installation script (creates venv, installs deps) ├── requirements.txt # List of Python libraries ├── README.md # This project documentation file │ ├── static/ # Frontend assets │ ├── css/ │ │ └── style.css # All application styling │ └── js/ │ └── app.js # Frontend logic, API calls, visualization │ ├── templates/ # HTML templates │ └── index.html # The main (and only) web page │ ├── uploads/ # (Created by app) Stores user-uploaded .wav files ├── generated_audio/ # (Created by app) Stores text-to-morse .wav files └── venv/ # (Created by setup.py) Virtual environment


---

## 🚀 Setup & Installation

This project includes a setup script to automate the installation process. You will need **Python 3.7+** installed on your system.

1.  **Clone or Download:** Get all the project files into a single directory named `morse_app/`.
2.  **Open Your Terminal:** Navigate into the project's root directory:
    ```sh
    cd path/to/morse_app
    ```
3.  **Run the Setup Script:**
    * **On macOS/Linux:**
        ```sh
        python3 setup.py
        ```
    * **On Windows:**
        ```sh
        python setup.py
        ```
4.  **What the Script Does:**
    * Checks if a virtual environment directory (`venv/`) already exists. If not, it creates one.
    * Activates the virtual environment.
    * Uses `pip` (from within the venv) to install all libraries listed in `requirements.txt`.
    * Once dependencies are installed, it automatically starts the Flask server.

5.  **Access the Application:**
    Once the server is running, open your web browser and go to:
    **`http://127.0.0.1:5000`**

To stop the server, press **`CTRL+C`** in your terminal.

---

## 📖 How to Use

### To Generate Morse Code (Text-to-Morse)

1.  Type your message (e.g., "HELLO WORLD") into the **"Enter Text"** box.
2.  Click the **"Generate Audio"** button.
3.  An audio player will appear, allowing you to listen to and download your generated `.wav` file.

### To Translate Morse Code (Morse-to-Text)

1.  Under the **"Morse to Text"** section, click **"Choose File"** and select a `.wav` file from your computer.
2.  Click the **"Translate Audio"** button.
3.  The application will process the file (a spinner may appear for larger files).
4.  Once processed, the results area will appear, showing:
    * The name of your file.
    * An audio player loaded with your file.
    * A static waveform visualization of the audio.
    * The **"Full Translated Text"** box (which will be empty initially).
5.  Press **Play** on the audio player.
6.  As the audio plays:
    * A red "playhead" will move across the waveform.
    * Decoded letters will flash in the "live display" box, synchronized with the audio.
    * The **"Full Translated Text"** box will fill up live as the letters are decoded.
