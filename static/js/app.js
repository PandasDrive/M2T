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
    
    // Batch processing elements
    const batchFileInput = document.getElementById('batch-file-input');
    const batchProcessButton = document.getElementById('batch-process-button');
    const batchStatus = document.getElementById('batch-status');
    
    // Waterfall display elements
    const waterfallContainer = document.getElementById('waterfall-container');
    const waterfallCanvas = document.getElementById('waterfall-canvas');
    const toggleWaterfallBtn = document.getElementById('toggle-waterfall');
    const waterfallFreqMin = document.getElementById('waterfall-freq-min');
    const waterfallFreqMax = document.getElementById('waterfall-freq-max');

    // --- State Variables ---
    let wavesurfer;
    let currentAudioFile;
    let wsRegions;
    let decodedRegions = [];
    let currentDecodedData = null; // Store decoded data for export
    let batchQueue = []; // Files queued for batch processing
    let waterfallCtx = null;
    let waterfallData = []; // Waterfall frequency data
    let audioContext = null;
    let analyserNode = null;
    let sourceNode = null;
    let waterfallInterval = null;
    let waterfallFreqRange = { min: 0, max: 3000 }; // Focus on Morse range (0-3000 Hz)

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
    
    // Batch processing handlers
    batchFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            batchQueue = Array.from(e.target.files);
            batchProcessButton.disabled = false;
            batchStatus.style.display = 'block';
            batchStatus.textContent = `${batchQueue.length} file(s) ready for processing`;
            batchStatus.style.color = 'var(--primary-color)';
        }
    });
    
    batchProcessButton.addEventListener('click', () => {
        if (batchQueue.length > 0) {
            processBatch(batchQueue);
        }
    });
    
    // Waterfall toggle buttons
    const showWaterfallBtn = document.getElementById('show-waterfall-btn');
    
    const toggleWaterfall = () => {
        if (waterfallContainer.style.display === 'none') {
            waterfallContainer.style.display = 'block';
            if (toggleWaterfallBtn) toggleWaterfallBtn.textContent = 'Hide Waterfall';
            if (showWaterfallBtn) showWaterfallBtn.textContent = 'Hide Waterfall';
            initializeWaterfall();
            
            // Start waterfall if audio is playing
            if (wavesurfer && wavesurfer.isPlaying()) {
                startWaterfallUpdate();
            }
        } else {
            waterfallContainer.style.display = 'none';
            if (toggleWaterfallBtn) toggleWaterfallBtn.textContent = 'Show Waterfall';
            if (showWaterfallBtn) showWaterfallBtn.textContent = 'Show Waterfall';
            stopWaterfallUpdate();
        }
    };
    
    if (toggleWaterfallBtn) {
        toggleWaterfallBtn.addEventListener('click', toggleWaterfall);
    }
    
    if (showWaterfallBtn) {
        showWaterfallBtn.addEventListener('click', toggleWaterfall);
    }
    
    // Initialize waterfall canvas
    if (waterfallCanvas) {
        waterfallCtx = waterfallCanvas.getContext('2d');
        waterfallCanvas.width = waterfallCanvas.offsetWidth;
        waterfallCanvas.height = waterfallCanvas.offsetHeight;
    }

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

    playPauseButton.addEventListener('click', () => { 
        if (wavesurfer) {
            // Toggle play/pause
            if (wavesurfer.isPlaying()) {
                wavesurfer.pause();
            } else {
                // Resume playback from current position
                wavesurfer.play();
            }
        }
    });
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
                
                // Update waterfall frequency range to center around detected frequency
                if (data.frequency) {
                    const centerFreq = data.frequency;
                    // Set range to center the detected frequency (±1500 Hz window, 3000 Hz total range)
                    // This ensures the detected frequency appears in the center
                    const rangeSize = 3000; // Total range width
                    const halfRange = rangeSize / 2;
                    waterfallFreqRange.min = Math.max(0, centerFreq - halfRange);
                    waterfallFreqRange.max = Math.min(8000, centerFreq + halfRange);
                    // If we hit a boundary, adjust the other side to maintain center
                    if (waterfallFreqRange.min === 0 && centerFreq > halfRange) {
                        // Hit left boundary, extend right
                        waterfallFreqRange.max = Math.min(8000, centerFreq + (centerFreq - waterfallFreqRange.min));
                    }
                    if (waterfallFreqRange.max === 8000 && centerFreq < (8000 - halfRange)) {
                        // Hit right boundary, extend left
                        waterfallFreqRange.min = Math.max(0, centerFreq - (waterfallFreqRange.max - centerFreq));
                    }
                } else {
                    // Default to Morse code range (0-3000 Hz)
                    waterfallFreqRange.min = 0;
                    waterfallFreqRange.max = 3000;
                }
                
                // Update frequency labels
                if (waterfallFreqMin) {
                    waterfallFreqMin.textContent = `${Math.round(waterfallFreqRange.min)} Hz`;
                }
                if (waterfallFreqMax) {
                    waterfallFreqMax.textContent = `${Math.round(waterfallFreqRange.max)} Hz`;
                }
                
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
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Calculate frequency from Y position (existing behavior)
            const maxFreq = wavesurfer.options.sampleRate / 2;
            const freq = Math.round(maxFreq * (1 - (y / rect.height)));
            frequencyInput.value = freq;
            
            // Calculate time position from X position and seek to it
            if (wavesurfer && wavesurfer.getDuration()) {
                // Get the waveform container which should match spectrogram width
                const waveformContainer = document.getElementById('waveform-container');
                
                if (!waveformContainer) return;
                
                // Get the actual visible width of the waveform (what you can see)
                const visibleWidth = waveformContainer.clientWidth;
                // Get the total scrollable width (accounts for zoom)
                const totalWidth = waveformContainer.scrollWidth;
                
                // Calculate click position relative to visible spectrogram
                const clickPercent = x / rect.width; // 0.0 to 1.0 relative to visible spectrogram
                
                // Calculate scroll offset (how much is scrolled left)
                const scrollLeft = waveformContainer.scrollLeft;
                
                // Calculate the absolute position in the total waveform
                // If zoomed, the visible area represents a portion of the total
                const zoomRatio = totalWidth / visibleWidth;
                const absolutePosition = (clickPercent * visibleWidth * zoomRatio) + scrollLeft;
                
                // Normalize to 0.0-1.0 based on total waveform duration
                const normalizedPosition = Math.max(0, Math.min(1, absolutePosition / totalWidth));
                
                // Seek to the clicked position and always start playback
                // This allows repeated clicking to replay from different positions
                wavesurfer.seekTo(normalizedPosition);
                
                // Always restart playback from the clicked position
                // If already playing, pause first then play to ensure clean restart
                // If finished/paused, this will start playback
                if (wavesurfer.isPlaying()) {
                    wavesurfer.pause();
                }
                // Small delay to ensure seek and pause complete before playing
                setTimeout(() => {
                    wavesurfer.play();
                }, 50);
            }
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

        wavesurfer.on('play', () => {
            playPauseButton.textContent = 'PAUSE';
            startWaterfallUpdate();
        });
        
        wavesurfer.on('pause', () => {
            playPauseButton.textContent = 'PLAY';
            stopWaterfallUpdate();
        });
        
        wavesurfer.on('finish', () => {
            playPauseButton.textContent = 'PLAY';
            stopWaterfallUpdate();
        });
        
        // Setup audio analyser for waterfall
        setupAudioAnalyser();
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
    
    // --- BATCH PROCESSING ---
    async function processBatch(files) {
        if (!files || files.length === 0) {
            alert('No files to process.');
            return;
        }
        
        batchProcessButton.disabled = true;
        batchStatus.style.display = 'block';
        batchStatus.textContent = `Uploading ${files.length} file(s)...`;
        batchStatus.style.color = 'var(--primary-color)';
        
        try {
            // Upload files
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files[]', files[i]);
            }
            
            const uploadResponse = await fetch('/batch-upload', {
                method: 'POST',
                body: formData
            });
            
            if (!uploadResponse.ok) {
                throw new Error('Upload failed');
            }
            
            const uploadData = await uploadResponse.json();
            const uploadedFiles = uploadData.files || [];
            
            if (uploadedFiles.length === 0) {
                throw new Error('No files were uploaded');
            }
            
            batchStatus.textContent = `Processing ${uploadedFiles.length} file(s)...`;
            
            // Get preprocessing config if enabled
            const config = {};
            if (preprocessEnabled && preprocessEnabled.checked) {
                config.preprocessing = {
                    remove_dc: removeDc.checked,
                    apply_highpass: applyHighpass.checked,
                    highpass_cutoff: applyHighpass.checked ? parseFloat(highpassCutoff.value) : null,
                    apply_bandpass: applyBandpass.checked,
                    bandpass_low: applyBandpass.checked ? parseFloat(bandpassLow.value) : null,
                    bandpass_high: applyBandpass.checked ? parseFloat(bandpassHigh.value) : null,
                    apply_notch: applyNotch.checked,
                    notch_freq: applyNotch.checked ? parseFloat(notchFreq.value) : null,
                    apply_lowpass: applyLowpass.checked,
                    lowpass_cutoff: applyLowpass.checked ? parseFloat(lowpassCutoff.value) : null,
                    noise_reduction: noiseReduction.checked,
                    noise_reduction_db: noiseReduction.checked ? parseFloat(noiseReductionDb.value) : null,
                    normalize: normalize.value || null
                };
            }
            
            // Process files
            const processResponse = await fetch('/batch-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_ids: uploadedFiles.map(f => ({
                        filepath: f.filepath,
                        original_filename: f.original_filename
                    })),
                    config: config
                })
            });
            
            if (!processResponse.ok) {
                throw new Error('Processing failed');
            }
            
            const processData = await processResponse.json();
            const summary = processData.summary || {};
            
            // Update status
            batchStatus.textContent = `Completed: ${summary.successful || 0}/${summary.total || 0} successful. Avg Quality: ${(summary.average_quality || 0).toFixed(1)}%`;
            batchStatus.style.color = summary.failed === 0 ? '#10b981' : '#f59e0b';
            
            // Reset batch queue
            batchQueue = [];
            batchFileInput.value = '';
            
            setTimeout(() => {
                batchStatus.style.display = 'none';
            }, 5000);
            
        } catch (error) {
            batchStatus.textContent = `Error: ${error.message}`;
            batchStatus.style.color = '#ef4444';
            console.error('Batch processing error:', error);
        } finally {
            batchProcessButton.disabled = false;
        }
    }
    
    // --- WATERFALL DISPLAY ---
    function initializeWaterfall() {
        if (!waterfallCanvas || !waterfallCtx) return;
        
        waterfallCanvas.width = waterfallCanvas.offsetWidth || 800;
        waterfallCanvas.height = waterfallCanvas.offsetHeight || 200;
        
        // Clear canvas
        waterfallCtx.fillStyle = '#000';
        waterfallCtx.fillRect(0, 0, waterfallCanvas.width, waterfallCanvas.height);
        
        waterfallData = []; // Reset data
    }
    
    function setupAudioAnalyser() {
        if (!wavesurfer) return;
        
        try {
            // Create AudioContext if needed
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Create analyser node
            if (!analyserNode) {
                analyserNode = audioContext.createAnalyser();
                analyserNode.fftSize = 2048; // Higher resolution
                analyserNode.smoothingTimeConstant = 0.8;
            }
        } catch (e) {
            console.error('Error setting up audio analyser:', e);
        }
    }
    
    function startWaterfallUpdate() {
        if (!wavesurfer || !waterfallCanvas || waterfallContainer.style.display === 'none') return;
        
        // Stop any existing interval
        stopWaterfallUpdate();
        
        // Get the audio element from WaveSurfer
        const audioElement = wavesurfer.getMediaElement();
        if (!audioElement) {
            console.warn('No audio element available for waterfall');
            return;
        }
        
        try {
            // Resume audio context if suspended (required by browser autoplay policies)
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            
            // Connect audio to analyser WITHOUT interfering with playback
            // The key is to NOT create a MediaElementSource if WaveSurfer already has one
            // Instead, we'll use the audio element's stream if available, or create a splitter
            if (audioContext && analyserNode) {
                // Disconnect existing source if any
                if (sourceNode) {
                    try {
                        sourceNode.disconnect();
                        sourceNode = null;
                    } catch (e) {
                        // Ignore disconnect errors
                    }
                }
                
                // IMPORTANT: We can only create ONE MediaElementSource per audio element
                // WaveSurfer might already be using one, so we need to check first
                // If it already exists, we'll use a different approach that doesn't interfere
                try {
                    // Try to create source - this will fail if WaveSurfer already created one
                    sourceNode = audioContext.createMediaElementSource(audioElement);
                    
                    // Success! Now split the signal properly
                    const gainForAnalysis = audioContext.createGain();
                    gainForAnalysis.gain.value = 1.0; // Full signal to analyser
                    
                    // Split: source -> gain -> (analyser AND destination)
                    sourceNode.connect(gainForAnalysis);
                    gainForAnalysis.connect(analyserNode);
                    // Don't connect analyser to destination - that's for playback only
                    
                    // Connect to destination for playback (if not already connected)
                    try {
                        gainForAnalysis.connect(audioContext.destination);
                    } catch (e) {
                        // Destination might already be connected - that's okay
                        console.log('Audio destination connection handled');
                    }
                } catch (e) {
                    // MediaElementSource already exists - WaveSurfer created it
                    // This means we CAN'T tap into the audio stream without breaking it
                    console.warn('Cannot create MediaElementSource - WaveSurfer may already be using it');
                    console.log('Using fallback: extracting data from WaveSurfer spectrogram');
                    
                    // Use fallback method that extracts from WaveSurfer's spectrogram
                    waterfallInterval = setInterval(() => {
                        if (!wavesurfer || !wavesurfer.isPlaying()) {
                            stopWaterfallUpdate();
                            return;
                        }
                        updateWaterfallFromSpectrogram();
                    }, 50);
                    return; // Exit early since we're using fallback
                }
            }
            
            // Update waterfall periodically
            waterfallInterval = setInterval(() => {
                if (!wavesurfer || !wavesurfer.isPlaying()) {
                    stopWaterfallUpdate();
                    return;
                }
                updateWaterfallFromAnalyser();
            }, 50); // Update every 50ms for smooth waterfall
        } catch (e) {
            console.error('Error starting waterfall update:', e);
            // Fallback method
            console.log('Using fallback waterfall update method...');
        }
    }
    
    function updateWaterfallFromSpectrogram() {
        // Fallback method: Extract frequency data from WaveSurfer's spectrogram canvas
        // This doesn't interfere with audio playback
        if (!waterfallCtx || !waterfallCanvas || !wavesurfer) return;
        
        const width = waterfallCanvas.width;
        const height = waterfallCanvas.height;
        
        // Try to get spectrogram canvas
        const spectrogramCanvas = spectrogramContainer.querySelector('canvas');
        if (!spectrogramCanvas) {
            // No spectrogram available yet, use simple fallback
            updateWaterfallFallback();
            return;
        }
        
        // Get current time position
        const currentTime = wavesurfer.getCurrentTime();
        const duration = wavesurfer.getDuration();
        if (!duration) return;
        
        // Calculate x position in spectrogram
        const spectrogramWidth = spectrogramCanvas.width;
        const xPos = (currentTime / duration) * spectrogramWidth;
        
        // Extract frequency data from spectrogram at current time position
        const spectrogramCtx = spectrogramCanvas.getContext('2d');
        const lineY = height - 1;
        
        // Shift existing data up
        const imageData = waterfallCtx.getImageData(0, 0, width, height);
        waterfallCtx.putImageData(imageData, 0, -1);
        
        // Clear bottom line
        waterfallCtx.fillStyle = '#000';
        waterfallCtx.fillRect(0, lineY, width, 1);
        
        // Extract vertical slice from spectrogram
        try {
            const maxFreq = 8000; // Max frequency to display
            const spectrogramHeight = spectrogramCanvas.height;
            const sampleSize = Math.floor(spectrogramHeight / 200); // Sample points
            
            waterfallCtx.beginPath();
            let firstPoint = true;
            
            for (let i = 0; i < spectrogramHeight; i += sampleSize) {
                // Read pixel data from spectrogram at current x position
                const imageData = spectrogramCtx.getImageData(
                    Math.floor(xPos), i, 1, 1
                );
                const [r, g, b] = imageData.data;
                
                // Convert to intensity (0-255)
                const intensity = Math.max(r, g, b);
                
                // Map to frequency (spectrogram is inverted - 0 Hz is at bottom)
                const freqY = 1 - (i / spectrogramHeight);
                const freq = freqY * (maxFreq * 2); // Account for Nyquist
                
                // Focus on Morse code frequency range
                if (freq >= waterfallFreqRange.min && freq <= waterfallFreqRange.max && intensity > 20) {
                    // Map frequency to x position within the visible range
                    const freqRange = waterfallFreqRange.max - waterfallFreqRange.min;
                    const normalizedFreq = (freq - waterfallFreqRange.min) / freqRange;
                    const x = normalizedFreq * width;
                    const y = lineY - (intensity / 255) * 50;
                    
                    if (firstPoint) {
                        waterfallCtx.moveTo(x, y);
                        firstPoint = false;
                    } else {
                        waterfallCtx.lineTo(x, y);
                    }
                    
                    // Draw colored dot
                    waterfallCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    waterfallCtx.fillRect(x - 1, lineY - 2, 2, 2);
                }
            }
            
            waterfallCtx.strokeStyle = '#0f0';
            waterfallCtx.lineWidth = 1;
            waterfallCtx.stroke();
        } catch (e) {
            console.error('Error extracting spectrogram data:', e);
            updateWaterfallFallback();
        }
    }
    
    function updateWaterfallFallback() {
        // Simple fallback visualization when no data available
        if (!waterfallCtx || !waterfallCanvas) return;
        
        const width = waterfallCanvas.width;
        const height = waterfallCanvas.height;
        
        // Shift existing data up
        const imageData = waterfallCtx.getImageData(0, 0, width, height);
        waterfallCtx.putImageData(imageData, 0, -1);
        
        // Draw a simple baseline
        const lineY = height - 1;
        waterfallCtx.fillStyle = '#000';
        waterfallCtx.fillRect(0, lineY, width, 1);
        
        // Draw minimal visualization
        waterfallCtx.strokeStyle = '#333';
        waterfallCtx.lineWidth = 1;
        waterfallCtx.beginPath();
        waterfallCtx.moveTo(0, lineY);
        waterfallCtx.lineTo(width, lineY);
        waterfallCtx.stroke();
    }
    
    function stopWaterfallUpdate() {
        if (waterfallInterval) {
            clearInterval(waterfallInterval);
            waterfallInterval = null;
        }
    }
    
    function updateWaterfallFromAnalyser() {
        if (!analyserNode || !waterfallCtx || !waterfallCanvas) return;
        
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteFrequencyData(dataArray);
        
        // Convert to waterfall format
        const width = waterfallCanvas.width;
        const height = waterfallCanvas.height;
        const sampleRate = wavesurfer ? (wavesurfer.options.sampleRate || 44100) : 44100;
        const maxFreq = sampleRate / 2;
        
        // Shift existing data up
        const imageData = waterfallCtx.getImageData(0, 0, width, height);
        waterfallCtx.putImageData(imageData, 0, -1);
        
        // Draw new line at bottom with frequency data
        const lineY = height - 1;
        
        // Ensure canvas dimensions are correct
        if (waterfallCanvas.width !== waterfallCanvas.offsetWidth || 
            waterfallCanvas.height !== waterfallCanvas.offsetHeight) {
            waterfallCanvas.width = waterfallCanvas.offsetWidth || 800;
            waterfallCanvas.height = waterfallCanvas.offsetHeight || 200;
        }
        
        // Draw frequency spectrum as a line with color coding
        waterfallCtx.beginPath();
        let firstPoint = true;
        
        for (let i = 0; i < bufferLength; i++) {
            const magnitude = dataArray[i];
            const intensity = Math.min(255, magnitude);
            
            // Calculate frequency for this bin
            const freq = (i / bufferLength) * maxFreq;
            
            // Focus on Morse code frequency range (0-3000 Hz typically)
            if (freq >= waterfallFreqRange.min && freq <= waterfallFreqRange.max) {
                // Map frequency to x position within the visible range
                const freqRange = waterfallFreqRange.max - waterfallFreqRange.min;
                const normalizedFreq = (freq - waterfallFreqRange.min) / freqRange;
                const x = normalizedFreq * width;
                // Scale intensity for visibility (0-60% of line height)
                const y = lineY - (intensity / 255) * 60;
                
                if (firstPoint) {
                    waterfallCtx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    waterfallCtx.lineTo(x, y);
                }
                
                // Draw color-coded dots for signal intensity
                if (intensity > 30) { // Only draw if above noise threshold
                    // Color gradient: blue -> green -> yellow -> red
                    let r, g, b;
                    if (intensity < 85) {
                        r = 0;
                        g = 0;
                        b = intensity * 3;
                    } else if (intensity < 170) {
                        r = 0;
                        g = (intensity - 85) * 3;
                        b = 255 - (intensity - 85) * 3;
                    } else {
                        r = (intensity - 170) * 3;
                        g = 255 - (intensity - 170);
                        b = 0;
                    }
                    
                    waterfallCtx.fillStyle = `rgb(${Math.min(255, r)}, ${Math.min(255, g)}, ${Math.min(255, b)})`;
                    waterfallCtx.fillRect(x - 1, lineY - 3, 2, 3);
                }
            }
        }
        
        // Stroke the line
        waterfallCtx.strokeStyle = '#0f0';
        waterfallCtx.lineWidth = 1;
        waterfallCtx.stroke();
    }
    
    function updateWaterfall(frequencyData) {
        // Legacy function - kept for compatibility
        if (!waterfallCtx || !waterfallCanvas) return;
        // This function is now replaced by updateWaterfallFromAnalyser
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
