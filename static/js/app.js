document.addEventListener('DOMContentLoaded', () => {
    // --- Main Application Elements ---
    const fileInput = document.getElementById('file-input');
    const translateButton = document.getElementById('translate-button');
    const morseToTextError = document.getElementById('morse-to-text-error');
    const loadingSpinner = document.getElementById('loading-spinner');

    // --- Data Panel Elements ---
    const wpmDisplay = document.getElementById('wpm-display');
    const liveCharDisplay = document.getElementById('live-char-display');
    const summaryText = document.getElementById('summary-text');

    // --- Visualization Panel Elements ---
    const advancedViewToggle = document.getElementById('advanced-view-toggle');
    const waveformCanvas = document.getElementById('waveform-canvas');
    const binarySignalCanvas = document.getElementById('binary-signal-canvas');
    const wfCtx = waveformCanvas.getContext('2d');
    const bsCtx = binarySignalCanvas.getContext('2d');

    // --- Playback Panel Elements ---
    const fileNameDisplay = document.getElementById('file-name-display');
    const uploadedAudioPlayer = document.getElementById('uploaded-audio-player');
    const playbackSpeed = document.getElementById('playback-speed');
    const playbackSpeedValue = document.getElementById('playback-speed-value');

    // --- Generator Elements ---
    const textInput = document.getElementById('text-input');
    const generateButton = document.getElementById('generate-button');
    const textToMorseResults = document.getElementById('text-to-morse-results');
    const generatedAudioPlayer = document.getElementById('generated-audio-player');
    const textToMorseError = document.getElementById('text-to-morse-error');

    // --- State Variables ---
    let translationEvents = [];
    let binarySignalData = [];
    let currentEventIndex = 0;
    let audioContext;
    let audioBuffer;

    // --- Initial UI State ---
    loadingSpinner.style.display = 'none';
    translateButton.disabled = true;

    // --- EVENT LISTENERS ---

    // Enable Decode button only when a file is selected
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            translateButton.disabled = false;
            fileNameDisplay.textContent = fileInput.files[0].name;
            summaryText.textContent = 'File loaded. Press "DECODE" to analyze.';
        } else {
            translateButton.disabled = true;
            fileNameDisplay.textContent = 'No file loaded';
        }
    });

    // Main Decode button action
    translateButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            showError(morseToTextError, 'Please select a .wav file.');
            return;
        }

        showLoading(true);
        hideError(morseToTextError);
        resetTranslationUI();

        const formData = new FormData();
        formData.append('audioFile', file);

        try {
            const response = await fetch('/translate-from-audio', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store results from backend
                translationEvents = data.events || [];
                binarySignalData = data.binary_signal_data || [];

                // Populate UI
                summaryText.textContent = data.full_text || '[No text decoded]';
                wpmDisplay.textContent = data.wpm || '--';
                uploadedAudioPlayer.src = data.filepath;
                uploadedAudioPlayer.load();

                // Prepare for visualization
                await loadAudioForVisualization(data.filepath);
                drawBinarySignal();

            } else {
                showError(morseToTextError, data.error || 'An unknown error occurred.');
                summaryText.textContent = `Error: ${data.error || 'An unknown error occurred.'}`;
            }

        } catch (error) {
            showError(morseToTextError, `Network error: ${error.message}`);
            summaryText.textContent = `Network error: ${error.message}`;
        } finally {
            showLoading(false);
        }
    });

    // Playback starts the animation loop
    uploadedAudioPlayer.addEventListener('play', () => {
        currentEventIndex = 0;
        liveCharDisplay.textContent = '_';
        summaryText.textContent = ''; // Clear summary on play to rebuild it live
        requestAnimationFrame(updateLiveDisplay);
    });

    // Playback speed control
    playbackSpeed.addEventListener('input', () => {
        const speed = parseFloat(playbackSpeed.value);
        playbackSpeedValue.textContent = speed.toFixed(2);
        uploadedAudioPlayer.playbackRate = speed;
    });

    // Advanced view toggle
    advancedViewToggle.addEventListener('change', () => {
        waveformCanvas.classList.toggle('hidden', advancedViewToggle.checked);
        binarySignalCanvas.classList.toggle('hidden', !advancedViewToggle.checked);
    });

    // --- Generator Logic ---
    generateButton.addEventListener('click', async () => {
        // (This logic remains largely the same)
        const text = textInput.value;
        if (!text) {
            showError(textToMorseError, 'Please enter some text.');
            return;
        }
        textToMorseResults.classList.add('hidden');
        hideError(textToMorseError);
        try {
            const response = await fetch('/translate-to-morse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text })
            });
            const data = await response.json();
            if (response.ok) {
                generatedAudioPlayer.src = data.filepath;
                generatedAudioPlayer.load();
                textToMorseResults.classList.remove('hidden');
            } else {
                showError(textToMorseError, data.error || 'An unknown error occurred.');
            }
        } catch (error) {
            showError(textToMorseError, `Network error: ${error.message}`);
        }
    });


    // --- CORE FUNCTIONS ---

    function resetTranslationUI() {
        summaryText.textContent = 'Awaiting audio file...';
        liveCharDisplay.textContent = '_';
        wpmDisplay.textContent = '--';
        uploadedAudioPlayer.src = '';
        playbackSpeed.value = 1.0;
        playbackSpeedValue.textContent = '1.00';
        uploadedAudioPlayer.playbackRate = 1.0;
        translationEvents = [];
        binarySignalData = [];
        currentEventIndex = 0;
        drawWaveform(); // Draw empty state
        drawBinarySignal(); // Draw empty state
    }

    /**
     * The main animation loop that runs during audio playback.
     */
    function updateLiveDisplay() {
        if (uploadedAudioPlayer.paused || uploadedAudioPlayer.ended) {
            liveCharDisplay.textContent = '■'; // Stop symbol
            return;
        }

        const currentTime = uploadedAudioPlayer.currentTime;

        // Update live character display
        if (currentEventIndex < translationEvents.length) {
            const nextEvent = translationEvents[currentEventIndex];
            if (currentTime >= nextEvent.time) {
                showLiveCharacter(nextEvent.char);
                updateSummaryFromEvents(currentEventIndex + 1);
                currentEventIndex++;
            }
        }
        
        // Redraw visualizations with playhead
        drawWaveform(currentTime);
        drawBinarySignal(currentTime);

        requestAnimationFrame(updateLiveDisplay);
    }

    function showLiveCharacter(char) {
        liveCharDisplay.textContent = char;
    }

    function updateSummaryFromEvents(index) {
        let summaryString = "";
        for(let i=0; i < index; i++) {
             summaryString += translationEvents[i].char;
        }
        summaryText.textContent = summaryString;
    }

    // --- VISUALIZATION FUNCTIONS ---

    async function loadAudioForVisualization(url) {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            drawWaveform();
        } catch (e) {
            console.error('Error loading audio for visualization:', e);
            showError(morseToTextError, 'Could not load audio for visualization.');
        }
    }

    function drawWaveform(currentTime = 0) {
        const width = waveformCanvas.width;
        const height = waveformCanvas.height;
        wfCtx.fillStyle = '#111827'; // Background
        wfCtx.fillRect(0, 0, width, height);

        if (!audioBuffer) return;

        const data = audioBuffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        wfCtx.strokeStyle = '#38BDF8'; // Waveform color
        wfCtx.lineWidth = 1;
        wfCtx.beginPath();
        
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            wfCtx.moveTo(i, (1 + min) * amp);
            wfCtx.lineTo(i, (1 + max) * amp);
        }
        wfCtx.stroke();
        
        // Draw playhead
        if (currentTime > 0) {
            const playheadX = (currentTime / audioBuffer.duration) * width;
            wfCtx.strokeStyle = 'rgba(249, 250, 251, 0.75)'; // Playhead color
            wfCtx.lineWidth = 2;
            wfCtx.beginPath();
            wfCtx.moveTo(playheadX, 0);
            wfCtx.lineTo(playheadX, height);
            wfCtx.stroke();
        }
    }

    function drawBinarySignal(currentTime = 0) {
        const width = binarySignalCanvas.width;
        const height = binarySignalCanvas.height;
        bsCtx.fillStyle = '#111827'; // Background
        bsCtx.fillRect(0, 0, width, height);

        if (binarySignalData.length === 0) return;

        const step = width / binarySignalData.length;
        bsCtx.fillStyle = '#38BDF8'; // "On" color

        for (let i = 0; i < binarySignalData.length; i++) {
            if (binarySignalData[i] === 1) {
                bsCtx.fillRect(i * step, 0, step, height);
            }
        }

        // Draw playhead
        if (currentTime > 0 && audioBuffer) {
            const playheadX = (currentTime / audioBuffer.duration) * width;
            bsCtx.strokeStyle = 'rgba(249, 250, 251, 0.75)'; // Playhead color
            bsCtx.lineWidth = 2;
            bsCtx.beginPath();
            bsCtx.moveTo(playheadX, 0);
            bsCtx.lineTo(playheadX, height);
            bsCtx.stroke();
        }
    }

    // --- UTILITY FUNCTIONS ---
    function showLoading(isLoading) {
        loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    }

    function showError(element, message) {
        element.textContent = message;
    }

    function hideError(element) {
        element.textContent = '';
    }
});