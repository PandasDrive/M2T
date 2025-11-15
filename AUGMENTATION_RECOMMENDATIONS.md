# M2T Audio Development & Augmentation Recommendations

## Executive Summary

Based on analysis of the current M2T codebase, this document outlines recommended enhancements for audio development and augmentation features. The focus is on improving decoding accuracy, adding audio processing capabilities, and expanding development tools.

---

## 🎯 Current State Analysis

### Strengths
- ✅ Clean Goertzel algorithm implementation for frequency detection
- ✅ Real-time visualization with WaveSurfer (waveform + spectrogram)
- ✅ Manual tuning controls (WPM, threshold, frequency)
- ✅ Live playback with character highlighting
- ✅ Auto-detection of frequency and WPM

### Limitations
- ❌ Only supports WAV format
- ❌ No audio preprocessing (noise reduction, filtering)
- ❌ No real-time audio input (microphone recording)
- ❌ Limited export capabilities
- ❌ No batch processing
- ❌ Basic noise handling (threshold-based only)
- ❌ No audio comparison/diff tools

---

## 🚀 Recommended Enhancements

### 1. **Audio Preprocessing & Enhancement**

#### Noise Reduction
- **Adaptive Noise Reduction**: Implement spectral subtraction or Wiener filtering
- **DC Offset Removal**: Detect and remove DC bias automatically
- **High-Pass/Low-Pass Filters**: Configurable filters for different frequency ranges
- **Notch Filters**: Remove specific interference frequencies (50/60Hz hum, etc.)

**Implementation:**
```python
# Add to morse_processor.py
from scipy import signal

def apply_noise_reduction(audio, sr, method='spectral_subtraction'):
    """Apply noise reduction to audio signal"""
    # Implementation here
    pass

def remove_dc_offset(audio):
    """Remove DC offset from audio"""
    return audio - np.mean(audio)

def apply_bandpass_filter(audio, sr, low_freq=300, high_freq=1500):
    """Apply bandpass filter"""
    sos = signal.butter(4, [low_freq, high_freq], btype='band', fs=sr, output='sos')
    return signal.sosfilt(sos, audio)
```

#### Audio Normalization
- Auto-gain control
- Peak normalization
- RMS normalization options

### 2. **Multi-Format Audio Support**

**Add Support For:**
- MP3, FLAC, OGG, M4A
- Web Audio API for browser-based format conversion
- Automatic format detection and conversion

**Implementation:**
```python
# Extend app.py to handle multiple formats
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'flac', 'ogg', 'm4a'}

def convert_audio_to_wav(input_path, output_path):
    """Convert any audio format to WAV using pydub"""
    audio = AudioSegment.from_file(input_path)
    audio.export(output_path, format="wav")
    return output_path
```

### 3. **Real-Time Audio Input**

**Features:**
- Microphone recording interface
- Real-time decoding while recording
- Stream processing for continuous monitoring
- Recording quality controls (sample rate, bit depth)

**Implementation:**
```javascript
// Add to app.js
async function startMicrophoneRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    // Process audio chunks in real-time
}
```

### 4. **Advanced Audio Analysis Tools**

#### Multi-Frequency Detection
- Detect multiple simultaneous Morse signals
- Frequency waterfall display
- Signal strength visualization across frequencies

#### SNR Analysis Improvements
- Per-character SNR calculation
- SNR visualization on waveform
- Automatic quality assessment

#### Timing Analysis
- Detailed timing statistics (dot/dash/space distributions)
- Timing histogram visualization
- Timing consistency metrics

### 5. **Audio Export & Sharing**

**Export Capabilities:**
- Export decoded text to TXT, CSV, JSON
- Export audio with annotations
- Export timing data
- Save session states (all settings + decoded text)

**Implementation:**
```python
@app.route('/export-decoded', methods=['POST'])
def export_decoded():
    """Export decoded text in various formats"""
    data = request.json
    format_type = data.get('format', 'txt')
    # Implementation
```

### 6. **Batch Processing**

**Features:**
- Process multiple files at once
- Queue system with progress tracking
- Results comparison
- Bulk export

**UI Addition:**
```html
<input type="file" id="batch-file-input" multiple accept=".wav,.mp3,.flac">
<button id="process-batch-button">Process Batch</button>
<div id="batch-results"></div>
```

### 7. **Audio Comparison & Diff Tools**

**Features:**
- Compare original text vs decoded text
- Side-by-side audio/text comparison
- Error highlighting (missed/detected characters)
- Accuracy metrics (character-level, word-level)

### 8. **Enhanced Visualization**

**Add:**
- **Waterfall Display**: Show frequency over time (like SDR software)
- **3D Spectrogram**: Interactive 3D frequency-time visualization
- **Signal Quality Heatmap**: Color-code by SNR
- **Timing Overlay**: Visual representation of dot/dash/space lengths

### 9. **Advanced Tuning & Calibration**

**Features:**
- **Frequency Sweep**: Automatically test multiple frequencies
- **WPM Sweep**: Test different WPM settings
- **Threshold Calibration**: Automatic threshold optimization
- **Preset Management**: Save/load tuning presets for different signal types
- **A/B Testing**: Compare two different tuning settings side-by-side

### 10. **Machine Learning Integration**

**Potential ML Features:**
- **Pattern Recognition**: Learn character patterns from examples
- **Noise Classification**: Auto-detect and remove common noise types
- **Adaptive Thresholding**: ML-based threshold optimization
- **Character Prediction**: Use context to improve decoding accuracy

**Libraries to Consider:**
- TensorFlow.js (client-side)
- scikit-learn (server-side for pattern matching)

### 11. **Audio Development Tools**

#### Test Signal Generator Enhancements
- Variable WPM
- Multiple tone frequencies
- Add noise (white, pink, brown)
- Add interference signals
- Configurable timing variations
- Generate test datasets

#### Debugging Tools
- **Step-through Decoding**: Visualize each step of the decoding process
- **Raw Signal Inspector**: View raw audio samples
- **Threshold Visualization**: Show threshold line on magnitude plot
- **Timing Debugger**: Highlight timing decisions

### 12. **Session Management**

**Features:**
- Save/load analysis sessions
- Session history
- Compare sessions
- Export session reports

---

## 📦 Required Dependencies

### New Python Packages
```txt
# Audio Processing
noisereduce  # Advanced noise reduction
soundfile    # Already included, good for format support
ffmpeg-python  # Format conversion

# Signal Processing
scipy        # Already included
scikit-learn  # For ML features

# Data Export
pandas       # For CSV export
```

### New JavaScript Libraries
```html
<!-- Real-time audio -->
<script src="https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.min.js"></script>

<!-- 3D Visualization -->
<script src="https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/plotly.js@2.26.0/dist/plotly.min.js"></script>
```

---

## 🔧 Implementation Priority

### Phase 1: Core Enhancements (High Priority)
1. ✅ Multi-format audio support (MP3, FLAC, etc.)
2. ✅ Audio preprocessing (noise reduction, filters)
3. ✅ Enhanced export capabilities
4. ✅ Real-time microphone input

### Phase 2: Analysis Tools (Medium Priority)
5. ✅ Multi-frequency detection
6. ✅ Batch processing
7. ✅ Audio comparison/diff tools
8. ✅ Enhanced visualization (waterfall, 3D)

### Phase 3: Advanced Features (Lower Priority)
9. ✅ ML integration
10. ✅ Session management
11. ✅ Advanced debugging tools

---

## 🎨 UI/UX Improvements

### New Sections to Add
1. **Audio Processing Panel**: Pre-processing controls
2. **Analysis Panel**: Advanced metrics and statistics
3. **Export Panel**: Various export options
4. **Recording Panel**: Real-time audio input
5. **Presets Panel**: Save/load tuning configurations

### Suggested Layout
```
┌─────────────────────────────────────────────────┐
│  [File Input / Recording Controls]              │
├──────────────────┬──────────────────────────────┤
│  Visualization   │  Controls & Tuning           │
│  ┌─────────────┐ │  ┌─────────────────────┐    │
│  │ Waveform    │ │  │ WPM/Threshold/Freq  │    │
│  ├─────────────┤ │  ├─────────────────────┤    │
│  │ Spectrogram │ │  │ Audio Preprocessing │    │
│  ├─────────────┤ │  ├─────────────────────┤    │
│  │ Waterfall   │ │  │ Export Options      │    │
│  └─────────────┘ │  └─────────────────────┘    │
├──────────────────┴──────────────────────────────┤
│  Decoded Text & Analysis                        │
│  ┌───────────────────────────────────────────┐ │
│  │ Full Transcription                        │ │
│  │ Statistics | Timing | Quality Metrics     │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 📝 Code Structure Recommendations

### Suggested File Organization
```
m2t/
├── app.py                    # Flask routes
├── morse_processor.py        # Core decoding logic
├── audio_preprocessor.py     # NEW: Audio enhancement
├── audio_formats.py          # NEW: Format conversion
├── batch_processor.py        # NEW: Batch operations
├── export_utils.py           # NEW: Export functions
├── ml_helpers.py             # NEW: ML features (future)
└── utils/
    ├── filters.py            # Signal filtering
    ├── noise_reduction.py    # Noise removal
    └── visualization.py      # Advanced plots
```

---

## 🔬 Research & Development Areas

1. **Advanced Noise Reduction Algorithms**
   - Study spectral subtraction, Wiener filtering
   - Implement adaptive noise gate
   - Research deep learning denoising

2. **Signal Classification**
   - Machine learning for character pattern recognition
   - Context-aware decoding
   - Error correction algorithms

3. **Real-time Processing Optimization**
   - Web Workers for background processing
   - Streaming audio processing
   - Efficient chunking strategies

4. **Multi-Signal Processing**
   - Frequency-division multiplexing
   - Simultaneous multi-frequency detection
   - Signal separation techniques

---

## 📚 References & Resources

- **Audio Processing**: Librosa documentation, scipy.signal
- **Noise Reduction**: noisereduce library, spectral subtraction papers
- **Web Audio API**: MDN Web Audio API documentation
- **Signal Processing**: Digital Signal Processing textbooks
- **Morse Code**: ITU-R M.1677-1 standard

---

## 🎯 Success Metrics

**Quantitative:**
- Decoding accuracy improvement (target: >95%)
- Support for 5+ audio formats
- Processing time reduction (target: <50% current time)
- SNR improvement from preprocessing (target: +3dB)

**Qualitative:**
- User feedback on ease of use
- Feature adoption rates
- Developer contributions

---

## Next Steps

1. Review and prioritize recommendations
2. Create detailed implementation plans for Phase 1
3. Set up development branches for new features
4. Begin with multi-format support (lowest risk, high value)
5. Gradually add preprocessing features
6. Test each feature incrementally

---

*Last Updated: Based on codebase analysis as of current state*
