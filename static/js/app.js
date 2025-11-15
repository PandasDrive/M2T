document.addEventListener('DOMContentLoaded', () => {
    // This script assumes WaveSurfer is loaded globally from the script tags in index.html

    // --- Main Application Elements ---
    const fileInput = document.getElementById('file-input');
    const translateButton = document.getElementById('translate-button');
    const morseToTextError = document.getElementById('morse-to-text-error');
    const loadingSpinner = document.getElementById('loading-spinner');

    // --- Data Panel Elements ---
    const wpmDisplay = document.getElementById('wpm-display');
    const liveCharDisplay = document.getElementById('live-char-display');
    const summaryText = document.getElementById('summary-text');

    // --- Visualization & Playback ---
    const waveformContainer = document.getElementById('waveform-container');
    const spectrogramContainer = document.getElementById('spectrogram-container');
    const playbackSpeed = document.getElementById('playback-speed');
    const playbackSpeedValue = document.getElementById('playback-speed-value');
    const fileNameDisplay = document.getElementById('file-name-display');

    // --- Generator Elements ---
    const textInput = document.getElementById('text-input');
    const generateButton = document.getElementById('generate-button');
    const textToMorseResults = document.getElementById('text-to-morse-results');
    const generatedAudioPlayer = document.getElementById('generated-audio-player');
    const textToMorseError = document.getElementById('text-to-morse-error');

    // --- State Variables ---
    let wavesurfer;

    // --- Initial UI State ---
    loadingSpinner.style.display = 'none';
    translateButton.disabled = true;

    // --- EVENT LISTENERS ---

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            translateButton.disabled = false;
            fileNameDisplay.textContent = fileInput.files[0].name;
            summaryText.textContent = 'File loaded. Press "DECODE" to analyze.';
        } else {
            translateButton.disabled = true;
        }
    });

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
            const response = await fetch('/translate-from-audio', { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) {
                summaryText.textContent = data.full_text || '[No text decoded]';
                wpmDisplay.textContent = data.wpm || '--';
                initializeWaveSurfer(URL.createObjectURL(file), data);
            } else {
                showError(morseToTextError, data.error || 'An unknown error occurred.');
            }
        } catch (error) {
            showError(morseToTextError, `Network error: ${error.message}`);
        } finally {
            showLoading(false);
        }
    });

    playbackSpeed.addEventListener('input', () => {
        const speed = parseFloat(playbackSpeed.value);
        playbackSpeedValue.textContent = speed.toFixed(2);
        if (wavesurfer) {
            wavesurfer.setPlaybackRate(speed);
        }
    });

    // --- Generator Logic (unchanged) ---
    generateButton.addEventListener('click', async () => {
        const text = textInput.value;
        if (!text) { showError(textToMorseError, 'Please enter some text.'); return; }
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

    // --- WAVESURFER & CORE FUNCTIONS ---

    function initializeWaveSurfer(audioUrl, apiData) {
        if (wavesurfer) {
            wavesurfer.destroy();
        }

        // Note: WaveSurfer and its plugins are expected to be global variables
        // loaded from the script tags in index.html
        const wsRegions = WaveSurfer.Regions.create();

        wavesurfer = WaveSurfer.create({
            container: '#waveform-container',
            waveColor: '#9CA3AF',
            progressColor: '#38BDF8',
            barWidth: 3,
            barRadius: 2,
            barGap: 2,
            height: 128,
            url: audioUrl,
            plugins: [
                WaveSurfer.Spectrogram.create({
                    container: '#spectrogram-container',
                    labels: true,
                    height: 128,
                }),
                WaveSurfer.Timeline.create(),
                wsRegions,
            ],
        });

        wavesurfer.on('ready', () => {
            const duration = wavesurfer.getDuration();
            (apiData.events || []).forEach((event, index) => {
                const nextEvent = (apiData.events || [])[index + 1];
                const end = nextEvent ? nextEvent.time : duration;
                wsRegions.addRegion({
                    start: event.time,
                    end: end,
                    content: event.char,
                    color: 'rgba(56, 189, 248, 0.1)',
                    drag: false,
                    resize: false,
                });
            });
        });

        let lastChar = '';
        wavesurfer.on('timeupdate', (currentTime) => {
            const activeRegion = wsRegions.getRegions().find(r => currentTime >= r.start && currentTime < r.end);
            const currentChar = activeRegion ? activeRegion.content : '_';
            if (currentChar !== lastChar) {
                liveCharDisplay.textContent = currentChar;
                lastChar = currentChar;
            }
        });

        const playButton = document.querySelector('.panel-playback button') || createPlayButton();
        playButton.onclick = () => wavesurfer.playPause();
        wavesurfer.on('play', () => playButton.textContent = 'PAUSE');
        wavesurfer.on('pause', () => playButton.textContent = 'PLAY');
    }
    
    function createPlayButton() {
        const button = document.createElement('button');
        button.textContent = 'PLAY';
        button.style.marginTop = '1rem';
        const playbackPanel = document.querySelector('.panel-playback');
        playbackPanel.insertBefore(button, playbackPanel.querySelector('.form-group'));
        return button;
    }

    function resetTranslationUI() {
        summaryText.textContent = 'Awaiting audio file...';
        liveCharDisplay.textContent = '_';
        wpmDisplay.textContent = '--';
        playbackSpeed.value = 1.0;
        playbackSpeedValue.textContent = '1.00';
        if (wavesurfer) {
            wavesurfer.destroy();
        }
        document.getElementById('waveform-container').innerHTML = '';
        document.getElementById('spectrogram-container').innerHTML = '';
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
