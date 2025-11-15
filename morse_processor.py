import numpy as np
import librosa
import librosa.display
import scipy.signal
from pydub import AudioSegment
from pydub.generators import Sine

# --- ---
# == Part 1: Text-to-Morse Generation ==
# --- ---

MORSE_CODE_DICT = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
    'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
    'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
    ' ': '/'  # Use / for space between words
}

# Standard Morse timing (WPM = Words Per Minute)
# We'll base everything on the 'dot' duration.
# A common WPM is 20. Dot duration = 1.2 / WPM
WPM = 20
DOT_DURATION_MS = 1200 / WPM  # Duration of one 'dot' in milliseconds
DASH_DURATION_MS = 3 * DOT_DURATION_MS
INTRA_CHAR_SPACE_MS = 1 * DOT_DURATION_MS # Space between dots/dashes in a char
INTER_CHAR_SPACE_MS = 3 * DOT_DURATION_MS # Space between letters
WORD_SPACE_MS = 7 * DOT_DURATION_MS       # Space between words

# Audio properties
TONE_FREQUENCY = 700  # Hz (A common frequency for Morse)
SAMPLE_RATE = 44100   # Standard audio sample rate

def generate_morse_audio(text, output_path):
    """
    Converts a string of text into a Morse code .wav file.
    """
    print(f"Generating Morse for: {text}")
    
    # Create silent segments
    dot_silence = AudioSegment.silent(duration=INTRA_CHAR_SPACE_MS)
    char_silence = AudioSegment.silent(duration=INTER_CHAR_SPACE_MS)
    word_silence = AudioSegment.silent(duration=WORD_SPACE_MS)
    
    # Create tone segments
    dot_tone = Sine(TONE_FREQUENCY).to_audio_segment(duration=DOT_DURATION_MS, volume=-10)
    dash_tone = Sine(TONE_FREQUENCY).to_audio_segment(duration=DASH_DURATION_MS, volume=-10)
    
    # Start with a bit of silence
    final_audio = AudioSegment.silent(duration=500)
    
    for char in text.upper():
        if char == ' ':
            # Add word space
            final_audio += word_silence
        elif char in MORSE_CODE_DICT:
            morse_symbols = MORSE_CODE_DICT[char]
            for i, symbol in enumerate(morse_symbols):
                if symbol == '.':
                    final_audio += dot_tone
                elif symbol == '-':
                    final_audio += dash_tone
                
                # Add silence *between* symbols in a character
                if i < len(morse_symbols) - 1:
                    final_audio += dot_silence
            
            # Add silence *after* the character
            final_audio += char_silence
            
    # Add a bit of silence at the end
    final_audio += AudioSegment.silent(duration=500)
    
    # Export the final audio to a .wav file
    final_audio.export(output_path, format="wav")
    print(f"File saved to {output_path}")

# --- ---
# == Part 2: Audio-to-Text Processing ==
# --- ---

def process_audio_file(filepath):
    """
    Analyzes a .wav file and attempts to decode Morse code.
    
    This is a complex signal processing task. This implementation is
    a *foundational algorithm* based on envelope detection.
    
    Returns a dictionary:
    {
        'full_text': '...', 
        'events': [{'time': 0.5, 'char': 'S'}, ...],
        'spectrogram_data': [...] 
    }
    """
    print(f"Processing audio file: {filepath}")
    
    # 1. Load the audio file
    y, sr = librosa.load(filepath, sr=None) # Load with original sample rate
    
    # 2. Get the envelope of the signal using a simpler moving average method
    # This is more robust against filter ringing than a bandpass/hilbert transform.
    
    # Rectify the signal
    y_abs = np.abs(y)
    
    # Create a moving average filter (low-pass) to get the envelope
    # Window size should be larger than the tone's period but smaller than a dot.
    # Tone period = 1/700Hz = ~1.4ms. Dot is 60ms. Let's use a 10ms window.
    window_size = int(sr * 0.01)
    moving_avg_filter = np.ones(window_size) / window_size
    y_envelope = np.convolve(y_abs, moving_avg_filter, 'same')

    # 3. Thresholding to find "on" (key down) and "off" (key up)
    # For a clean signal, a simple percentage of the max amplitude works well.
    # For noisy signals, this might need to be more adaptive.
    if np.max(y_envelope) > 0:
        threshold = np.max(y_envelope) * 0.5
    else:
        threshold = 0.0 # Handle silence

    binary_signal = (y_envelope > threshold).astype(int)
    
    # 5. Decode the binary signal (1s and 0s) into timings
    # We need to find the lengths of 'on' (1s) and 'off' (0s) stretches
    # This is a basic run-length encoding
    
    # Find indices where the signal changes
    diff = np.diff(binary_signal, prepend=binary_signal[0], append=binary_signal[-1])
    change_indices = np.where(diff != 0)[0]
    
    # Calculate durations between changes
    durations = np.diff(change_indices) / sr  # Durations in seconds
    states = binary_signal[change_indices[:-1]] # State (0 or 1) for each duration
    
    # 6. Classify durations into Morse elements (dot, dash, spaces)
    # This is the second "fiddly" part. We need to guess the WPM (dot length).
    
    # Let's find all the "on" (mark) durations
    mark_durations = durations[states == 1]
    
    if len(mark_durations) < 2:
        # Not enough data to decode
        return {'full_text': '[ERROR: Not enough signal detected]', 'wpm': 0, 'events': [], 'spectrogram_data': []}

    # A more robust clustering approach to find the dot length
    # If there's a mix of long and short signals, separate them.
    if np.mean(mark_durations) > 0 and np.std(mark_durations) > 0.02: # Check for meaningful variation
        mean_mark = np.mean(mark_durations)
        # Assume signals shorter than the mean are dots
        dot_marks = [d for d in mark_durations if d < mean_mark]
        if not dot_marks: # Handle cases with only dashes
             dot_marks = [d / 3 for d in mark_durations] # Estimate dot length from dashes
    else:
        # If all marks are similar, assume they are all dots
        dot_marks = mark_durations

    if not dot_marks:
        return {'full_text': '[ERROR: Could not determine dot timing]', 'wpm': 0, 'events': [], 'spectrogram_data': []}

    estimated_dot_s = np.median(dot_marks)
    
    if estimated_dot_s == 0:
       return {'full_text': '[ERROR: No signal duration detected]', 'wpm': 0, 'events': [], 'spectrogram_data': []}

    # --- Calculate WPM ---
    # The standard formula is WPM = 1.2 / dot_duration_in_seconds
    wpm = 1.2 / estimated_dot_s
    print(f"Estimated dot duration: {estimated_dot_s:.3f}s, Calculated WPM: {wpm:.1f}")

    # Define timing windows based on this guess
    # (These windows need to be tolerant of "swing" or "fist")
    DOT_MAX = estimated_dot_s * 1.7 # Be a bit more tolerant
    DASH_MIN = estimated_dot_s * 2.0 # Anything between 1.7 and 2.0 is ambiguous
    
    CHAR_SPACE_MIN = estimated_dot_s * 2.0
    WORD_SPACE_MIN = estimated_dot_s * 5.0
    
    # 7. Re-build the message
    # We'll also build the timestamped events list you wanted
    
    # Invert the morse dictionary for decoding
    MORSE_DECODE_DICT = {v: k for k, v in MORSE_CODE_DICT.items()}
    
    decoded_text = ""
    current_char = ""
    current_time = 0.0
    timestamped_events = []

    for i, state in enumerate(states):
        duration_s = durations[i]
        
        if state == 1: # Key is ON (mark)
            if duration_s < DOT_MAX:
                current_char += "."
            elif duration_s > DASH_MIN:
                current_char += "-"
            # Else: ambiguous duration, ignore it (or mark with '?')
            
        else: # Key is OFF (space)
            # Decode the completed character after a space
            if current_char:
                if duration_s > WORD_SPACE_MIN:
                    # End of a word
                    letter = MORSE_DECODE_DICT.get(current_char, '?')
                    decoded_text += letter + " "
                    timestamped_events.append({'time': current_time, 'char': letter})
                    current_char = ""
                    
                elif duration_s > CHAR_SPACE_MIN:
                    # End of a character
                    letter = MORSE_DECODE_DICT.get(current_char, '?')
                    decoded_text += letter
                    timestamped_events.append({'time': current_time, 'char': letter})
                    current_char = ""
                
            # Else: it's just an intra-character space, do nothing
            
        current_time += duration_s

    # Handle any remaining character at the end of the transmission
    if current_char:
        letter = MORSE_DECODE_DICT.get(current_char, '?')
        decoded_text += letter
        timestamped_events.append({'time': current_time, 'char': letter})

    # 8. Generate Spectrogram data for visualization
    # We will use the *original* unfiltered signal for a truer visual
    S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=2000)
    S_dB = librosa.power_to_db(S, ref=np.max)
    
    # We need to send this to the client in a JSON-friendly way
    # Let's send a *downsampled* version to avoid sending huge arrays
    # This is just a placeholder; a real implementation would be more clever
    spectrogram_data = S_dB[::4, ::4].tolist() # Sample every 4th value
    
    
    print(f"Decoded text: {decoded_text}")

    return {
        'full_text': decoded_text.strip(),
        'wpm': round(wpm, 1),
        'events': timestamped_events,
        'spectrogram_data': spectrogram_data, # This is a placeholder for now
        'binary_signal_data': binary_signal.tolist()[::100] # Also for debugging
    }
