# M2T: Morse Code Audio Processor & Signal Analysis Tool

## Overview

M2T is a professional-grade, web-based Morse code toolkit built with Python and Flask. The primary focus is decoding Morse code from audio files into text in real-time, with advanced signal analysis capabilities for processing hundreds or thousands of files.

The application provides both single-file and batch processing modes, with advanced audio preprocessing, multi-format support, and professional visualization tools including waveform, spectrogram, and waterfall displays. All processing runs locally on a private network with no external dependencies.

---

## 🧭 Core Features

### **Audio-to-Text Transcription (Primary Feature):**
*   **Multi-Format Support:** Accepts WAV, MP3, FLAC, OGG, M4A, and AAC audio files with automatic format conversion.
*   **Automatic Speed Detection:** Automatically estimates transmission speed (Words Per Minute) from the audio signal.
*   **Live Transcription:** As audio plays, decoded characters appear on screen, synchronized with playback.
*   **Full Summary:** Complete transcription of the entire message with timing information.
*   **Advanced Signal Visualization:**
    *   Waveform display with playhead tracking
    *   Interactive spectrogram with frequency detection
    *   Waterfall display for multi-frequency analysis (SDR-style)
    *   Drag-to-zoom functionality
    *   Horizontal scrolling with Shift/Ctrl + Mouse Wheel

### **Audio Preprocessing & Enhancement:**
*   **Noise Reduction:** Spectral gating and adaptive noise reduction
*   **DC Offset Removal:** Automatic DC bias correction
*   **Filtering Options:**
    *   High-pass, Low-pass, and Band-pass filters
    *   Notch filter for removing interference (50/60Hz hum)
*   **Normalization:** Peak and RMS normalization options
*   **Configurable Pipeline:** Enable/disable preprocessing steps as needed

### **Batch Processing:**
*   **Multiple File Processing:** Process hundreds or thousands of files simultaneously
*   **Queue Management:** Visual progress tracking for batch operations
*   **Database Storage:** All results stored in SQLite database for later analysis
*   **Quality Metrics:** Automatic quality scoring and timing analysis
*   **Bulk Export:** Export all results in various formats (TXT, CSV, JSON)

### **Export Capabilities:**
*   **Multiple Formats:** Export decoded text to TXT, CSV, JSON, or formatted reports
*   **Metadata Included:** Timing information, quality metrics, and processing parameters
*   **Event Data:** Character-by-character timing with start/end times

### **Text-to-Morse Generation (Testing Tool):**
*   Housed in a collapsible section to keep focus on decoding
*   Accepts text input to generate clean Morse code audio files
*   Download generated files for testing

### **Professional Features:**
*   **Database Integration:** SQLite database stores all file metadata and decode results
*   **Session Management:** Save and load analysis sessions
*   **Quality Metrics:** SNR, timing consistency, confidence scores
*   **Collapsible UI Panels:** Organized interface with expandable sections
*   **Keyboard Shortcuts:** Efficient navigation for power users

### **Self-Contained & Private:**
*   Runs entirely on a local Flask server
*   Requires no external internet access or third-party APIs for core processing
*   Includes `setup.py` script to automate environment creation and dependency installation

---

## 🛠️ Tech Stack & Architecture

This project uses a modern client-server architecture with database integration.

*   **Backend (Server-Side):**
    *   **Framework:** **Flask** with **Flask-SQLAlchemy** for database management
    *   **Audio Generation:** **Pydub** creates sine-wave-based audio segments for generating Morse code tones
    *   **Audio Analysis:** **Librosa** loads audio files, **SoundFile** handles format conversion
    *   **Signal Processing:** **SciPy** for filtering and signal processing operations
    *   **Core Logic:** The application uses the **Goertzel algorithm** for efficient frequency detection. Audio is processed in chunks to determine if target Morse code frequencies are present, producing a binary on/off signal that's analyzed for dot/dash/space timings, WPM calculation, and text translation.
    *   **Database:** SQLite database stores file metadata, decode results, and session data
    *   **Data Export:** **Pandas** for CSV export and data manipulation

*   **Frontend (Client-Side):**
    *   **HTML5/CSS3:** Modern, responsive interface with collapsible panels
    *   **WaveSurfer.js:** Professional audio visualization library for waveform, spectrogram, and timeline displays
    *   **JavaScript (ES6+):**
        *   Uses **Fetch API** for async communication with Flask backend
        *   Manages UI interactivity, batch processing, and visualization
        *   **Canvas API** for waterfall display and custom visualizations
        *   Synchronizes audio playback with live transcription updates
        *   Real-time frequency detection and display

---

## 📂 File Structure

```
m2t/
├── .gitignore             # Specifies files for Git to ignore
├── app.py                 # Main Flask application (routes, file handling, batch processing)
├── morse_processor.py     # Core logic (audio-to-text, wpm calc, text-to-morse)
├── audio_preprocessor.py  # Audio preprocessing functions (filters, noise reduction)
├── batch_processor.py     # Batch processing utilities
├── export_utils.py        # Export functionality (TXT, CSV, JSON)
├── models.py              # Database models (SQLAlchemy)
├── README.md              # This project documentation file
├── requirements.txt       # List of Python libraries
├── setup.py               # Installation script (creates venv, installs deps)
│
├── static/                # Frontend assets
│   ├── css/
│   │   └── style.css      # Stylesheet
│   └── js/
│       └── app.js         # Main JavaScript application
├── templates/             # HTML templates
│   └── index.html         # Main interface
│
├── uploads/               # (Created by app) Stores user-uploaded audio files
├── generated_audio/       # (Created by app) Stores text-to-morse audio files
├── temp/                  # (Created by app) Temporary files during processing
├── m2t_analysis.db        # (Created by app) SQLite database for results
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

1.  The main "Morse to Text Decoder" is in the **CONTROLS** panel on the right.
2.  Click **"Choose File"** and select an audio file (WAV, MP3, FLAC, OGG, M4A, or AAC) from your computer.
3.  (Optional) Enable **Audio Preprocessing** to apply filters, noise reduction, or normalization.
4.  Click the **"DECODE / RE-TUNE"** button.
5.  Once processed, the visualization area will show:
    *   **Timeline** at the top
    *   **Waveform** display
    *   **Spectrogram** showing frequency content
    *   **Waterfall** display (click "Show Waterfall" button to enable)
6.  The decoded results appear in the **DECODED DATA** panel:
    *   **WPM** (Words Per Minute)
    *   **Live Character** display
    *   **Signal Strength** metrics
    *   **Full Transcription** text
7.  Press **Play** in the **PLAYBACK** panel to begin live translation. Decoded characters appear in real-time as audio plays.
8.  Use **TUNING** controls to manually adjust WPM, threshold, or frequency if needed.

### Batch Processing

1.  In the **CONTROLS** panel, use the **BATCH PROCESSING** file input (accepts multiple files).
2.  Select multiple audio files (hold Ctrl/Cmd to select multiple).
3.  Click **"Process Batch"** to process all files.
4.  Status updates show progress: "Processing X file(s)..."
5.  Upon completion, see summary: "Completed: X/Y successful. Avg Quality: Z%"
6.  All results are automatically stored in the database for later analysis.

### Using Advanced Features

#### Waterfall Display
*   Click **"Show Waterfall"** button in the visualization footer
*   Displays frequency content over time (like SDR software)
*   Scrolls vertically showing signal intensity at different frequencies
*   Useful for detecting multiple simultaneous Morse signals

#### Audio Preprocessing
*   Enable preprocessing in the **AUDIO PREPROCESSING** panel
*   Options include:
    *   **Remove DC Offset** - Removes DC bias
    *   **High-Pass Filter** - Removes low-frequency noise
    *   **Band-Pass Filter** - Focuses on specific frequency range
    *   **Notch Filter** - Removes 50/60Hz interference
    *   **Low-Pass Filter** - Removes high-frequency noise
    *   **Noise Reduction** - Reduces background noise
    *   **Normalize** - Peak or RMS normalization
*   Adjust parameters with sliders and checkboxes

#### Zoom and Navigation
*   **Drag Selection**: Click and drag on waveform/spectrogram to zoom into that region
*   **Horizontal Scroll**: Hold Shift or Ctrl and scroll mouse wheel
*   **Reset View**: Click "Reset View" button to return to full view
*   **Frequency Selection**: Click on spectrogram to set target frequency

#### Export Results
*   After decoding, use export buttons in **DECODED DATA** panel:
    *   **Export TXT** - Plain text format
    *   **Export CSV** - Spreadsheet format with timing data
    *   **Export JSON** - Structured data format
    *   **Export Formatted** - Human-readable report

### To Generate Morse Code (for Testing)

1.  Find the collapsible **"Text to Morse Generator"** section at the bottom of the page and click to expand.
2.  Type your message into the **"Enter Text"** box.
3.  Click the **"Generate Audio"** button.
4.  An audio player will appear, allowing you to listen to and download your generated audio file.

---

## 🆕 New Features & Enhancements

### Version 2.0 Features:

*   **✅ Multi-Format Audio Support**: WAV, MP3, FLAC, OGG, M4A, AAC
*   **✅ Audio Preprocessing**: Noise reduction, filtering, normalization
*   **✅ Batch Processing**: Process hundreds/thousands of files
*   **✅ Database Integration**: Store results for analysis
*   **✅ Advanced Visualization**: WaveSurfer.js with waveform, spectrogram, and waterfall displays
*   **✅ Quality Metrics**: SNR, timing consistency, confidence scores
*   **✅ Export Options**: Multiple formats (TXT, CSV, JSON, Formatted)
*   **✅ Collapsible UI**: Organized panels for better workflow
*   **✅ Session Management**: Save and load analysis sessions
*   **✅ Professional UI**: Modern, responsive interface

---

## 📚 Dependencies

See `requirements.txt` for complete list. Key dependencies:
*   Flask & Flask-SQLAlchemy (web framework & database)
*   Librosa (audio analysis)
*   SciPy (signal processing)
*   Pydub (audio manipulation)
*   SoundFile (format conversion)
*   Pandas (data export)
*   NumPy (numerical operations)

---

## 🔧 Configuration

The application uses a SQLite database (`m2t_analysis.db`) to store:
*   Audio file metadata
*   Decode results and quality metrics
*   Processing history
*   Session states

Database is automatically created on first run.

---

## 🚧 Future Enhancements

See `ADVANCED_RECOMMENDATIONS.md` for detailed roadmap including:
*   Multi-frequency detection algorithms
*   Machine learning integration
*   Real-time streaming input
*   Advanced timing analysis
*   Comparative analysis tools
*   Enhanced visualization options
