document.addEventListener('DOMContentLoaded', () => {

    // --- Common Elements ---
    const loadingSpinner = document.getElementById('loading-spinner');
    loadingSpinner.style.display = 'none'; // Force hide on load

    // --- Text-to-Morse Elements ---
    const textInput = document.getElementById('text-input');
    const generateButton = document.getElementById('generate-button');
    const textToMorseResults = document.getElementById('text-to-morse-results');
    const generatedAudioPlayer = document.getElementById('generated-audio-player');
    const textToMorseError = document.getElementById('text-to-morse-error');

    // --- Morse-to-Text Elements ---
    const fileInput = document.getElementById('file-input');
    const translateButton = document.getElementById('translate-button');
    const morseToTextResults = document.getElementById('morse-to-text-results');
    const uploadedAudioPlayer = document.getElementById('uploaded-audio-player');
    const fileNameDisplay = document.getElementById('file-name-display');
    const liveCharDisplay = document.getElementById('live-char-display');
    const summaryText = document.getElementById('summary-text');
    const morseToTextError = document.getElementById('morse-to-text-error');
    const canvas = document.getElementById('waveform-canvas');
    const ctx = canvas.getContext('2d');
    const wpmDisplay = document.getElementById('wpm-display');


    // --- State Variables ---
    let translationEvents = []; // Stores [{'time': 0.5, 'char': 'S'}, ...]
    let currentEventIndex = 0;
    let audioContext;
    let audioBuffer;
    let audioSource;

    // --- ---
    // == Part 1: Text-to-Morse (Generator) ==
    // --- ---

    generateButton.addEventListener('click', async () => {
        const text = textInput.value;
        if (!text) {
            showError(textToMorseError, 'Please enter some text to generate.');
            return;
        }

        showLoading(true);
        hideError(textToMorseError);
        textToMorseResults.classList.add('hidden');

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
        } finally {
            showLoading(false);
        }
    });

    // --- ---
    // == Part 2: Morse-to-Text (Decoder) ==
    // --- ---

    translateButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            showError(morseToTextError, 'Please select a .wav file to translate.');
            return;
        }

        showLoading(true);
        hideError(morseToTextError);
        morseToTextResults.classList.add('hidden');
        resetTranslationUI();

        const formData = new FormData();
        formData.append('audioFile', file);

        try {
            const response = await fetch('/translate-from-audio', {
                method: 'POST',
                body: formData
                // No 'Content-Type' header, browser sets it for FormData
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store results
                translationEvents = data.events || [];
                
                // Display static results
                summaryText.textContent = data.full_text || '[No text decoded]';
                fileNameDisplay.textContent = file.name;
                wpmDisplay.textContent = data.wpm || '0';
                
                // Load the audio for playback
                uploadedAudioPlayer.src = data.filepath;
                uploadedAudioPlayer.load();

                // Load audio data for visualization
                await loadAudioForVisualization(data.filepath);

                // Show the results area
                morseToTextResults.classList.remove('hidden');
            } else {
                showError(morseToTextError, data.error || 'An unknown error occurred.');
            }

        } catch (error) {
            showError(morseToTextError, `Network error: ${error.message}`);
        } finally {
            showLoading(false);
        }
    });

    /**
     * Resets the translation UI to its default state
     */
    function resetTranslationUI() {
        summaryText.textContent = '';
        liveCharDisplay.textContent = '';
        fileNameDisplay.textContent = '';
        wpmDisplay.textContent = '0';
        uploadedAudioPlayer.src = '';
        translationEvents = [];
        currentEventIndex = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    }

    // --- Live Playback and Visualization ---

    /**
     * When the user plays the uploaded audio, start the live-display loop.
     */
    uploadedAudioPlayer.addEventListener('play', () => {
        currentEventIndex = 0;
        liveCharDisplay.textContent = ''; // Clear display on play
        requestAnimationFrame(updateLiveDisplay); // Start the animation loop
        drawWaveform(); // Draw the static waveform
    });

    /**
     * This is the core loop that runs during audio playback.
     * It checks the audio's currentTime against the event timestamps.
     */
    function updateLiveDisplay() {
        // Stop the loop if audio is paused or ended
        if (uploadedAudioPlayer.paused || uploadedAudioPlayer.ended) {
            return;
        }

        const currentTime = uploadedAudioPlayer.currentTime;

        // Check if the next event's time has been reached
        if (currentEventIndex < translationEvents.length) {
            const nextEvent = translationEvents[currentEventIndex];
            
            if (currentTime >= nextEvent.time) {
                // --- This is the "live" update logic ---
                
                // 1. Show the character in the "live" display
                showLiveCharacter(nextEvent.char);
                
                // 2. Add the character to the *bottom* summary (as requested)
                // We'll just re-set it from the events list for simplicity
                updateSummaryFromEvents(currentEventIndex + 1);
                
                // 3. Move to the next event
                currentEventIndex++;
            }
        }
        
        // Update the playback scrubber/cursor on the waveform
        drawWaveform(currentTime);

        // Continue the loop
        requestAnimationFrame(updateLiveDisplay);
    }
    
    /**
     * Rebuilds the summary text from the event list up to a certain index
     */
    function updateSummaryFromEvents(index) {
        let text = "";
        for (let i = 0; i < index; i++) {
            text += translationEvents[i].char;
            // Add a space if the *next* event is a space (from " / ")
            // This logic is tricky; just appending is easier.
            // Let's stick to the simpler logic for now:
        }
        
        // A simpler way: just append.
        // We will pre-fill the summary box on load, and this
        // function will just be for showing the *live* character.
        // The user's request was complex, let's simplify:
        // 1. On load: Full text appears in summary box.
        // 2. On play: Live character appears in `liveCharDisplay` at the right time.
        
        // Let's re-read the prompt:
        // "I'd like the letter...to be showing up...and then moves down and then gets added to the summary on the bottom."
        
        // OK, that implies the summary box should *also* build live.
        // Let's adjust the logic.
        
        // 1. On load, summary box is EMPTY.
        // 2. On play, `updateLiveDisplay` calls this.
        
        // Let's reset the logic.
        
        // On `translateButton` click (in `try` block):
        // `summaryText.textContent = '';` // Clear summary on load
        // `uploadedAudioPlayer.load();`
        
        // On `uploadedAudioPlayer.addEventListener('play', ...)`
        // `summaryText.textContent = '';` // Clear summary on *play*
        
        // This function will now build the summary string
        let summaryString = "";
        for(let i=0; i < index; i++) {
             summaryString += translationEvents[i].char;
             // This needs to handle word spaces ('/') from the processor
             // Assuming the processor returns " " for word spaces...
        }
        summaryText.textContent = summaryString;
    }
    
    // We need to clear the summary on play
    uploadedAudioPlayer.addEventListener('play', () => {
        currentEventIndex = 0;
        liveCharDisplay.textContent = ''; // Clear display on play
        summaryText.textContent = '';     // Clear summary on play
        requestAnimationFrame(updateLiveDisplay); // Start the animation loop
    });


    /**
     * Shows a character in the live display box with a fade-out effect.
     */
    function showLiveCharacter(char) {
        liveCharDisplay.textContent = char;
        liveCharDisplay.style.opacity = 1;

        // Fade out after a short duration
        setTimeout(() => {
            liveCharDisplay.style.opacity = 0;
        }, 800); // 800ms visibility
    }

    // --- ---
    // == Audio Visualization (Waveform) ==
    // --- ---
    
    /**
     * Loads audio file into an AudioBuffer for analysis
     */
    async function loadAudioForVisualization(url) {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            drawWaveform(); // Draw initial waveform
        } catch (e) {
            console.error('Error loading audio for visualization:', e);
            showError(morseToTextError, 'Could not load audio visualizer.');
        }
    }

    /**
     * Draws the waveform and the current playhead position
     */
    function drawWaveform(currentTime = 0) {
        if (!audioBuffer) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#555';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Waveform preview', canvas.width / 2, canvas.height / 2);
            return;
        }

        const data = audioBuffer.getChannelData(0); // Get data from channel 0
        const width = canvas.width;
        const height = canvas.height;
        const step = Math.ceil(data.length / width);
        const amp = height / 2; // Amplitude

        ctx.fillStyle = '#000'; // Background
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#e94560'; // Waveform color
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        let x = 0;
        for (let i = 0; i < data.length; i += step) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                if (data[i + j] < min) min = data[i + j];
                if (data[i + j] > max) max = data[i + j];
            }
            ctx.moveTo(x, (1 + min) * amp);
            ctx.lineTo(x, (1 + max) * amp);
            x++;
        }
        ctx.stroke();
        
        // Draw playhead
        if (currentTime > 0) {
            const playheadX = (currentTime / audioBuffer.duration) * width;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'; // Playhead color
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
        }
    }


    // --- ---
    // == Utility Functions ==
    // --- ---

    function showLoading(isLoading) {
        loadingSpinner.classList.toggle('hidden', !isLoading);
    }

    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    function hideError(element) {
        element.textContent = '';
        element.classList.add('hidden');
    }
});
