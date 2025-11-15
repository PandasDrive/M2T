// This script assumes WaveSurfer and its plugins are loaded globally from the script tags in index.html
document.addEventListener('DOMContentLoaded', () => {
    // --- Get all DOM elements ---
    const fileInput = document.getElementById('file-input');
    const translateButton = document.getElementById('translate-button');
    const morseToTextError = document.getElementById('morse-to-text-error');
    const loadingSpinner = document.getElementById('loading-spinner');
    const wpmDisplay = document.getElementById('wpm-display');
    const liveCharDisplay = document.getElementById('live-char-display');
    const summaryText = document.getElementById('summary-text');
    const signalStrengthDisplay = document.getElementById('signal-strength-display');
    const frequencyHoverDisplay = document.getElementById('frequency-hover-display');
    const waveformContainer = document.getElementById('waveform-container');
    const regionsCanvas = document.getElementById('regions-canvas');
    const spectrogramContainer = document.getElementById('spectrogram-container');
    const playbackSpeedSlider = document.getElementById('playback-speed');
    const playbackSpeedValue = document.getElementById('playback-speed-value');
    const fileNameDisplay = document.getElementById('file-name-display');
    const wpmSlider = document.getElementById('wpm-slider');
    const wpmSliderValue = document.getElementById('wpm-slider-value');
    const thresholdSlider = document.getElementById('threshold-slider');
    const thresholdSliderValue = document.getElementById('threshold-slider-value');
    const frequencyInput = document.getElementById('frequency-input');
    const playPauseButton = document.getElementById('play-pause-button');
    const resetZoomButton = document.getElementById('reset-zoom-button');
    const generateButton = document.getElementById('generate-button');
    const textInput = document.getElementById('text-input');
    const textToMorseResults = document.getElementById('text-to-morse-results');
    const generatedAudioPlayer = document.getElementById('generated-audio-player');
    const textToMorseError = document.getElementById('text-to-morse-error');

    // --- State Variables ---
    let wavesurfer;
    let currentAudioFile;
    let wsRegions;
    let decodedRegions = [];

    // --- Initial UI State ---
    loadingSpinner.style.display = 'none';
    translateButton.disabled = true;

    // --- EVENT LISTENERS ---

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            translateButton.disabled = false;
            currentAudioFile = fileInput.files[0];
            fileNameDisplay.textContent = currentAudioFile.name;
            summaryText.textContent = 'File loaded. Press "DECODE / RE-TUNE" to analyze.';
            wpmSlider.disabled = true;
            thresholdSlider.disabled = true;
            frequencyInput.disabled = true;
        } else {
            translateButton.disabled = true;
            currentAudioFile = null;
        }
    });

    translateButton.addEventListener('click', () => {
        if (!currentAudioFile) return;
        const wpm = wpmSlider.disabled ? null : wpmSlider.value;
        const threshold = thresholdSlider.disabled ? 1.0 : thresholdSlider.value;
        const frequency = frequencyInput.disabled ? null : frequencyInput.value;
        handleDecodeRequest(currentAudioFile, wpm, threshold, frequency);
    });

    // --- Tuning & Control Listeners ---
    wpmSlider.addEventListener('input', () => { wpmSliderValue.textContent = wpmSlider.value; });
    wpmSlider.addEventListener('change', () => { translateButton.click(); });

    thresholdSlider.addEventListener('input', () => { thresholdSliderValue.textContent = parseFloat(thresholdSlider.value).toFixed(2); });
    thresholdSlider.addEventListener('change', () => { translateButton.click(); });

    frequencyInput.addEventListener('change', () => { translateButton.click(); });

    playbackSpeedSlider.addEventListener('input', () => {
        const speed = parseFloat(playbackSpeedSlider.value);
        playbackSpeedValue.textContent = speed.toFixed(2);
        if (wavesurfer) wavesurfer.setPlaybackRate(speed);
    });

    playPauseButton.addEventListener('click', () => { if (wavesurfer) wavesurfer.playPause(); });
    resetZoomButton.addEventListener('click', () => { if (wavesurfer) wavesurfer.zoom('auto'); });

    // --- CORE DECODE & WAVESURFER LOGIC ---

    async function handleDecodeRequest(file, wpm, threshold, frequency) {
        showLoading(true);
        hideError(morseToTextError);
        
        const formData = new FormData();
        formData.append('audioFile', file);
        if (wpm) formData.append('wpm', wpm);
        if (threshold) formData.append('threshold', threshold);
        if (frequency) formData.append('frequency', frequency);

        try {
            const response = await fetch('/translate-from-audio', { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) {
                summaryText.textContent = data.full_text || '[No text decoded]';
                wpmDisplay.textContent = data.wpm || '--';
                signalStrengthDisplay.textContent = data.avg_snr ? data.avg_snr.toFixed(2) : '--';

                wpmSlider.disabled = false;
                thresholdSlider.disabled = false;
                frequencyInput.disabled = false;
                wpmSlider.value = data.wpm;
                wpmSliderValue.textContent = data.wpm;
                thresholdSlider.value = data.threshold_factor;
                thresholdSliderValue.textContent = data.threshold_factor.toFixed(2);
                frequencyInput.value = data.frequency;

                decodedRegions = data.events || [];

                if (!wavesurfer) {
                    initializeWaveSurfer(URL.createObjectURL(file));
                } else {
                    // If wavesurfer exists, just load the new audio
                    await wavesurfer.load(URL.createObjectURL(file));
                    drawRegions();
                }
            } else {
                showError(morseToTextError, data.error || 'An unknown error occurred.');
            }
        } catch (error) {
            showError(morseToTextError, `Network error: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

    function initializeWaveSurfer(audioUrl) {
        if (wavesurfer) wavesurfer.destroy();
        
        // Note: WaveSurfer.Regions is the correct name for the plugin when loaded globally
        wsRegions = WaveSurfer.Regions.create();

        wavesurfer = WaveSurfer.create({
            container: '#waveform-container',
            waveColor: '#9CA3AF',
            progressColor: '#38BDF8',
            height: 128,
            url: audioUrl,
            scrollParent: true, // Enable Shift+Scroll
            plugins: [
                WaveSurfer.Spectrogram.create({ container: '#spectrogram-container', labels: true, height: 256 }),
                WaveSurfer.Timeline.create({ container: '#timeline-container' }),
                wsRegions,
            ],
        });

        // Enable drag-to-create regions for zooming
        wsRegions.enableDragSelection({ color: 'rgba(255, 255, 255, 0.2)' });

        // On region creation (drag-to-zoom), zoom to it then remove it
        wavesurfer.on('region-updated', (region) => {
            wavesurfer.zoom(region.start, region.end);
            region.remove();
        });
        
        wavesurfer.on('redraw', () => drawRegions());
        wavesurfer.on('ready', () => {
            wavesurfer.zoom('auto');
            drawRegions();
        });

        // --- Interactive Spectrogram Logic ---
        spectrogramContainer.addEventListener('mousemove', (e) => {
            frequencyHoverDisplay.style.visibility = 'visible';
            const rect = spectrogramContainer.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const maxFreq = wavesurfer.options.sampleRate / 2;
            const freq = Math.round(maxFreq * (1 - (y / rect.height)));
            frequencyHoverDisplay.textContent = `${freq} HZ`;
        });
        spectrogramContainer.addEventListener('mouseleave', () => {
            frequencyHoverDisplay.style.visibility = 'hidden';
        });
        spectrogramContainer.addEventListener('click', (e) => {
            const rect = spectrogramContainer.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const maxFreq = wavesurfer.options.sampleRate / 2;
            const freq = Math.round(maxFreq * (1 - (y / rect.height)));
            frequencyInput.value = freq;
        });

        // --- Playback and Live Display Logic ---
        let lastChar = '';
        wavesurfer.on('timeupdate', (currentTime) => {
            const activeRegion = decodedRegions.find(r => currentTime >= r.start && currentTime < r.end);
            const currentChar = activeRegion ? activeRegion.char : '_';
            if (currentChar !== lastChar) {
                liveCharDisplay.textContent = currentChar;
                lastChar = currentChar;
            }
        });

        wavesurfer.on('play', () => playPauseButton.textContent = 'PAUSE');
        wavesurfer.on('pause', () => playPauseButton.textContent = 'PLAY');
    }

    // --- MANUAL REGION DRAWING ---
    function drawRegions() {
        if (!wavesurfer || !decodedRegions) return;
        const ctx = regionsCanvas.getContext('2d');
        const duration = wavesurfer.getDuration();
        if (!duration) return;

        const view = wavesurfer.getScroll();
        const totalWidth = wavesurfer.getWrapper().scrollWidth;
        const visibleWidth = waveformContainer.clientWidth;
        
        const start = view / totalWidth * duration;
        const end = (view + visibleWidth) / totalWidth * duration;

        ctx.canvas.width = visibleWidth;
        ctx.canvas.height = regionsCanvas.height;
        ctx.clearRect(0, 0, visibleWidth, regionsCanvas.height);

        decodedRegions.forEach(region => {
            // Only draw regions that are at least partially visible
            if (region.end > start && region.start < end) {
                const startPx = (region.start / duration) * totalWidth - view;
                const endPx = (region.end / duration) * totalWidth - view;
                const regionWidth = endPx - startPx;

                // Draw the highlight
                ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
                ctx.fillRect(startPx, 0, regionWidth, regionsCanvas.height);

                // Draw the text
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = '24px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-mono');
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Only draw text if the region is wide enough
                if (regionWidth > 20) {
                    ctx.fillText(region.char, startPx + regionWidth / 2, regionsCanvas.height / 2);
                }
            }
        });
    }

    // --- UTILITY & GENERATOR FUNCTIONS ---
    function resetTranslationUI() {
        summaryText.textContent = 'Awaiting audio file...';
        liveCharDisplay.textContent = '_';
        wpmDisplay.textContent = '--';
        signalStrengthDisplay.textContent = '--';
        frequencyHoverDisplay.textContent = '--';
        decodedRegions = [];
        if (wavesurfer) drawRegions();
    }
    function showLoading(isLoading) { loadingSpinner.style.display = isLoading ? 'flex' : 'none'; }
    function showError(element, message) { element.textContent = message; }
    function hideError(element) { element.textContent = ''; }
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
});
