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
    
    // Preprocessing controls
    const preprocessEnabled = document.getElementById('preprocess-enabled');
    const preprocessingOptions = document.getElementById('preprocessing-options');
    const removeDc = document.getElementById('remove-dc');
    const applyHighpass = document.getElementById('apply-highpass');
    const highpassCutoff = document.getElementById('highpass-cutoff');
    const highpassCutoffValue = document.getElementById('highpass-cutoff-value');
    const applyBandpass = document.getElementById('apply-bandpass');
    const bandpassLow = document.getElementById('bandpass-low');
    const bandpassLowValue = document.getElementById('bandpass-low-value');
    const bandpassHigh = document.getElementById('bandpass-high');
    const bandpassHighValue = document.getElementById('bandpass-high-value');
    const applyNotch = document.getElementById('apply-notch');
    const notchFreq = document.getElementById('notch-freq');
    const notchFreqValue = document.getElementById('notch-freq-value');
    const applyLowpass = document.getElementById('apply-lowpass');
    const lowpassCutoff = document.getElementById('lowpass-cutoff');
    const lowpassCutoffValue = document.getElementById('lowpass-cutoff-value');
    const noiseReduction = document.getElementById('noise-reduction');
    const noiseReductionDb = document.getElementById('noise-reduction-db');
    const noiseReductionDbValue = document.getElementById('noise-reduction-db-value');
    const normalize = document.getElementById('normalize');
    
    // Export controls
    const exportTxtBtn = document.getElementById('export-txt-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportFormattedBtn = document.getElementById('export-formatted-btn');

    // --- State Variables ---
    let wavesurfer;
    let currentAudioFile;
    let wsRegions;
    let decodedRegions = [];
    let currentDecodedData = null; // Store decoded data for export

    // --- Initial UI State ---
    loadingSpinner.style.display = 'none';
    translateButton.disabled = true;
    
    // --- Collapsible Panels ---
    const panelHeaders = document.querySelectorAll('.panel-header');
    panelHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const panel = header.closest('.collapsible-panel');
            if (panel) {
                panel.classList.toggle('collapsed');
                const toggle = header.querySelector('.panel-toggle');
                const content = panel.querySelector('.panel-content');
                
                if (panel.classList.contains('collapsed')) {
                    toggle.textContent = '▶';
                    content.style.display = 'none';
                } else {
                    toggle.textContent = '▼';
                    content.style.display = 'block';
                    // Force reflow for smooth animation
                    content.style.maxHeight = content.scrollHeight + 'px';
                }
            }
        });
    });

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
    
    // Preprocessing controls - make sure options show immediately with no lag
    if (preprocessEnabled && preprocessingOptions) {
        // Prevent checkbox click from bubbling to panel header
        preprocessEnabled.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        preprocessEnabled.addEventListener('change', (e) => {
            e.stopPropagation(); // Prevent event bubbling
            const preprocessingPanel = document.querySelector('.panel-preprocessing');
            const panelContent = preprocessingPanel?.querySelector('.panel-content');
            
            if (e.target.checked) {
                // First, ensure panel is expanded and visible immediately (synchronously, no delays)
                if (preprocessingPanel) {
                    // Remove collapsed class
                    preprocessingPanel.classList.remove('collapsed');
                    
                    // Update toggle icon
                    const header = preprocessingPanel.querySelector('.panel-header');
                    const toggle = header?.querySelector('.panel-toggle');
                    if (toggle) toggle.textContent = '▼';
                    
                    // Force panel content to be visible - override all hiding styles
                    if (panelContent) {
                        // Clear all styles that might hide it
                        panelContent.style.cssText = 'display: block !important; opacity: 1 !important; visibility: visible !important; max-height: none !important; overflow: visible !important; margin-top: 1.5rem;';
                    }
                }
                
                // Show preprocessing options immediately (synchronously)
                preprocessingOptions.style.cssText = 'display: block !important; opacity: 1 !important; visibility: visible !important;';
                
            } else {
                preprocessingOptions.style.display = 'none';
            }
        });
    }
    
    highpassCutoff.addEventListener('input', (e) => {
        highpassCutoffValue.textContent = e.target.value;
    });
    bandpassLow.addEventListener('input', (e) => {
        bandpassLowValue.textContent = e.target.value;
    });
    bandpassHigh.addEventListener('input', (e) => {
        bandpassHighValue.textContent = e.target.value;
    });
    notchFreq.addEventListener('input', (e) => {
        notchFreqValue.textContent = e.target.value;
    });
    lowpassCutoff.addEventListener('input', (e) => {
        lowpassCutoffValue.textContent = e.target.value;
    });
    noiseReductionDb.addEventListener('input', (e) => {
        noiseReductionDbValue.textContent = parseFloat(e.target.value).toFixed(1);
    });
    
    // Export handlers
    exportTxtBtn.addEventListener('click', () => exportDecoded('txt'));
    exportCsvBtn.addEventListener('click', () => exportDecoded('csv'));
    exportJsonBtn.addEventListener('click', () => exportDecoded('json'));
    exportFormattedBtn.addEventListener('click', () => exportDecoded('formatted'));

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
        
        // Add preprocessing parameters
        if (preprocessEnabled && preprocessEnabled.checked) {
            formData.append('preprocess', 'true');
            formData.append('remove_dc', removeDc.checked ? 'true' : 'false');
            if (applyHighpass.checked) {
                formData.append('apply_highpass', 'true');
                formData.append('highpass_cutoff', highpassCutoff.value);
            }
            if (applyBandpass.checked) {
                formData.append('apply_bandpass', 'true');
                formData.append('bandpass_low', bandpassLow.value);
                formData.append('bandpass_high', bandpassHigh.value);
            }
            if (applyNotch.checked) {
                formData.append('apply_notch', 'true');
                formData.append('notch_freq', notchFreq.value);
            }
            if (applyLowpass.checked) {
                formData.append('apply_lowpass', 'true');
                formData.append('lowpass_cutoff', lowpassCutoff.value);
            }
            if (noiseReduction.checked) {
                formData.append('noise_reduction', 'true');
                formData.append('noise_reduction_db', noiseReductionDb.value);
            }
            if (normalize.value) {
                formData.append('normalize', normalize.value);
            }
        }

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
                
                // Store decoded data for export
                currentDecodedData = {
                    text: data.full_text || '',
                    events: data.events || [],
                    metadata: {
                        wpm: data.wpm,
                        frequency: data.frequency,
                        threshold_factor: data.threshold_factor,
                        avg_snr: data.avg_snr
                    }
                };
                
                // Enable export buttons
                exportTxtBtn.disabled = false;
                exportCsvBtn.disabled = false;
                exportJsonBtn.disabled = false;
                exportFormattedBtn.disabled = false;

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
        currentDecodedData = null;
        
        // Disable export buttons
        exportTxtBtn.disabled = true;
        exportCsvBtn.disabled = true;
        exportJsonBtn.disabled = true;
        exportFormattedBtn.disabled = true;
        
        if (wavesurfer) drawRegions();
    }
    function showLoading(isLoading) { loadingSpinner.style.display = isLoading ? 'flex' : 'none'; }
    function showError(element, message) { element.textContent = message; }
    function hideError(element) { element.textContent = ''; }
    
    async function exportDecoded(format) {
        if (!currentDecodedData || !currentDecodedData.text) {
            alert('No decoded text to export.');
            return;
        }
        
        try {
            const response = await fetch('/export-decoded', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: currentDecodedData.text,
                    events: currentDecodedData.events,
                    metadata: currentDecodedData.metadata,
                    format: format
                })
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `m2t_decode.${format === 'formatted' ? 'txt' : format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                const data = await response.json();
                alert(`Export failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert(`Export error: ${error.message}`);
        }
    }
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
