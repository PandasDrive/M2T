# M2T: Morse Code Audio Processor

## Overview

This project is a self-contained, web-based Morse code toolkit built with Python and Flask. The primary focus is to decode Morse code from `.wav` audio files into text in real-time.

It also provides a secondary text-to-Morse generator which is useful for creating test audio files. The entire application is designed to run locally on a private network, with all dependencies managed within a Python virtual environment.

---

## 🧭 Core Features

*   **Audio-to-Text Transcription (Primary Feature):**
    *   Accepts user `.wav` file uploads.
    *   **Automatic Speed Detection:** Automatically estimates the transmission speed (Words Per Minute) from the audio signal and displays it.
    *   **Live Transcription:** As the audio plays, decoded characters appear on the screen, synchronized with the playback.
    *   **Full Summary:** A complete transcription of the entire message is populated at the bottom of the page.
    *   **Signal Visualization:** Displays a simple waveform of the audio signal with a "playhead" that tracks the current playback position.

*   **Text-to-Morse Generation (Testing Tool):**
    *   Housed in a collapsible section of the UI to keep the focus on decoding.
    *   Accepts user text input to generate a clean Morse code `.wav` file for playback and download.

*   **Self-Contained & Private:**
    *   Runs entirely on a local Flask server.
    *   Requires no external internet access or third-party APIs for its core processing.
    *   Includes a `setup.py` script to automate environment creation and dependency installation.

---

## 🛠️ Tech Stack & Architecture

This project uses a simple client-server architecture.

*   **Backend (Server-Side):**
    *   **Framework:** **Flask** serves the web page, handles file uploads, and manages all API endpoints.
    *   **Audio Generation:** **Pydub** creates sine-wave-based audio segments for generating Morse code tones.
    *   **Audio Analysis:** **Librosa** is used to load audio files. The core tone detection is performed by the **Goertzel algorithm** (via the `goertzel-fft` library), which is a highly efficient and noise-resistant method for detecting specific frequencies.
    *   **Core Logic:** The application processes audio in small chunks, using the Goertzel algorithm on each chunk to determine if the target Morse code frequency is present. This produces a clean binary on/off signal, which is then analyzed to determine dot/dash/space timings, calculate WPM, and translate to text.

*   **Frontend (Client-Side):**
    *   **HTML5/CSS3:** Provides a clean, single-column user interface with the decoder as the primary focus.
    *   **JavaScript (ES6+):**
        *   Uses the **Fetch API** to communicate with the Flask backend.
        *   Manages all UI interactivity, including the collapsible generator section.
        *   Uses the **Web Audio API** (`AudioContext`) to draw the waveform visualization onto an HTML **Canvas**.
        *   Synchronizes the audio `currentTime` with transcription event timestamps to create the live-display effect.

---

## 📂 File Structure

```
m2t/
├── .gitignore             # Specifies files for Git to ignore
├── app.py                 # Main Flask application (routes, file handling)
├── morse_processor.py     # Core logic (audio-to-text, wpm calc, text-to-morse)
├── README.md              # This project documentation file
├── requirements.txt       # List of Python libraries
├── setup.py               # Installation script (creates venv, installs deps)
│
├── static/                # Frontend assets (CSS, JS)
├── templates/             # HTML templates
│
├── uploads/               # (Created by app) Stores user-uploaded .wav files
├── generated_audio/       # (Created by app) Stores text-to-morse .wav files
└── venv/                  # (Created by setup.py) Python virtual environment
```

---

## 🚀 Setup & Installation

This project includes a setup script to automate the installation process. You will need **Python 3.7+** installed on your system.

1.  **Clone or Download:** Get all the project files into the root `m2t/` directory.
2.  **Open Your Terminal:** Navigate into the project's root directory:
    ```sh
    cd path/to/m2t
    ```
3.  **Run the Setup Script:**
    ```shell
    python setup.py
    ```
4.  **What the Script Does:**
    *   Checks if a virtual environment (`venv/`) exists. If not, it creates one.
    *   Installs all required libraries from `requirements.txt` into the virtual environment.
    *   Starts the Flask web server.
    *   **Automatically opens the application** in your default web browser.

5.  **Access the Application:**
    If your browser doesn't open automatically, you can access the running application at:
    **`http://127.0.0.1:5000`**

To stop the server, press **`CTRL+C`** in your terminal.

---

## 📖 How to Use

### To Translate Morse Code (Morse-to-Text)

1.  The main "Morse to Text Decoder" is the first card on the page.
2.  Click **"Choose File"** and select a `.wav` file from your computer.
3.  Click the **"Translate Audio"** button.
4.  Once processed, the results area will appear, showing:
    *   The **Detected Speed** in Words Per Minute (WPM).
    *   An audio player for your file.
    *   A waveform visualization.
    *   The empty **"Full Translated Text"** box.
5.  Press **Play** on the audio player to begin the live translation. As the audio plays, decoded letters will flash on the screen and the full translated text will build up in the summary box below.

### To Generate Morse Code (for Testing)

1.  Find the collapsible **"Text to Morse Generator"** section at the bottom of the page and click on it to expand it.
2.  Type your message into the **"Enter Text"** box.
3.  Click the **"Generate Audio"** button.
4.  An audio player will appear, allowing you to listen to and download your generated `.wav` file.
