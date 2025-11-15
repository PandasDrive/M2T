import numpy as np
import librosa
from pydub import AudioSegment
from pydub.generators import Sine

# --- ---
# == Part 1: Text-to-Morse Generation (Unchanged) ==
# --- ---

MORSE_CODE_DICT = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
    'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
    'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..',
    '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
    ' ': '/'
}

WPM = 20
DOT_DURATION_MS = 1200 / WPM
DASH_DURATION_MS = 3 * DOT_DURATION_MS
INTRA_CHAR_SPACE_MS = 1 * DOT_DURATION_MS
INTER_CHAR_SPACE_MS = 3 * DOT_DURATION_MS
WORD_SPACE_MS = 7 * DOT_DURATION_MS
TONE_FREQUENCY = 700
SAMPLE_RATE = 44100

def generate_morse_audio(text, output_path):
    """Converts a string of text into a Morse code .wav file."""
    print(f"Generating Morse for: {text}")
    dot_silence = AudioSegment.silent(duration=INTRA_CHAR_SPACE_MS)
    char_silence = AudioSegment.silent(duration=INTER_CHAR_SPACE_MS)
    word_silence = AudioSegment.silent(duration=WORD_SPACE_MS)
    dot_tone = Sine(TONE_FREQUENCY).to_audio_segment(duration=DOT_DURATION_MS, volume=-10)
    dash_tone = Sine(TONE_FREQUENCY).to_audio_segment(duration=DASH_DURATION_MS, volume=-10)
    final_audio = AudioSegment.silent(duration=500)
    for char in text.upper():
        if char == ' ':
            final_audio += word_silence
        elif char in MORSE_CODE_DICT:
            morse_symbols = MORSE_CODE_DICT[char]
            for i, symbol in enumerate(morse_symbols):
                if symbol == '.':
                    final_audio += dot_tone
                elif symbol == '-':
                    final_audio += dash_tone
                if i < len(morse_symbols) - 1:
                    final_audio += dot_silence
            final_audio += char_silence
    final_audio += AudioSegment.silent(duration=500)
    final_audio.export(output_path, format="wav")
    print(f"File saved to {output_path}")

# --- ---
# == Part 2: Audio-to-Text Processing (Goertzel Implementation) ==
# --- ---

def goertzel_mag(frames, sample_rate, target_freq):
    """
    A pure Python/NumPy implementation of the Goertzel algorithm.
    This is used to detect the magnitude of a single frequency in a signal.
    """
    num_frames = len(frames)
    k = int(0.5 + (num_frames * target_freq) / sample_rate)
    omega = (2.0 * np.pi * k) / num_frames
    cosine = np.cos(omega)
    sine = np.sin(omega)
    coeff = 2.0 * cosine

    q0, q1, q2 = 0, 0, 0
    for frame in frames:
        q0 = coeff * q1 - q2 + frame
        q2 = q1
        q1 = q0
    
    # Calculate the real and imaginary parts
    real = (q1 - q2 * cosine)
    imag = (q2 * sine)
    
    # Return the squared magnitude (power)
    return real**2 + imag**2

def process_audio_file(filepath, wpm_override=None, threshold_factor=1.0, frequency_override=None, preprocess_config=None):
    # --- 1. Find Peak Frequency using FFT ---
    # This gives us a much better starting point than a hardcoded frequency
    try:
        y, sr = librosa.load(filepath, sr=SAMPLE_RATE)
    except Exception as e:
        return {'full_text': f'[ERROR: Could not load audio file: {e}]', 'wpm': 0, 'avg_snr': 0, 'events': [], 'binary_signal_data': []}

    fft_result = np.fft.fft(y)
    fft_freq = np.fft.fftfreq(len(y), d=1/sr)
    
    # Find the peak frequency in a sensible range (e.g., 300Hz to 1500Hz)
    min_freq_idx = np.where(fft_freq > 300)[0][0]
    max_freq_idx = np.where(fft_freq < 1500)[0][-1]
    
    peak_freq_idx = min_freq_idx + np.argmax(np.abs(fft_result[min_freq_idx:max_freq_idx]))
    auto_detected_freq = fft_freq[peak_freq_idx]
    
    # Use the override if provided, otherwise use our auto-detected frequency
    target_freq = frequency_override if frequency_override is not None else auto_detected_freq
    print(f"Processing: {filepath}, WPM: {wpm_override}, Threshold: {threshold_factor}, Freq: {target_freq} (Auto-detected: {auto_detected_freq:.1f} Hz)")

    # --- 2. Goertzel Analysis ---
    chunk_duration_s = 0.01
    chunk_size = int(sr * chunk_duration_s)
    padding = chunk_size - (len(y) % chunk_size)
    y_padded = np.pad(y, (0, padding), 'constant')
    num_chunks = len(y_padded) // chunk_size
    
    magnitudes = [goertzel_mag(y_padded[i*chunk_size : (i+1)*chunk_size], sr, target_freq) for i in range(num_chunks)]
    magnitudes = np.array(magnitudes)

    # --- 3. Thresholding and Binary Signal Creation ---
    if np.max(magnitudes) > 0:
        # The base threshold is calculated automatically
        base_threshold = (np.mean(magnitudes) + np.max(magnitudes)) / 2.5
        # The user's factor adjusts this threshold
        tuned_threshold = base_threshold * threshold_factor
        
        binary_signal = (magnitudes > tuned_threshold).astype(int)
        on_signals = magnitudes[binary_signal == 1]
        avg_snr = np.mean(on_signals) if len(on_signals) > 0 else 0.0
    else:
        binary_signal = np.zeros_like(magnitudes)
        avg_snr = 0.0

    # --- 4. Decode Binary Signal into Timings ---
    # A simpler, more explicit run-length encoding implementation
    durations = []
    states = []
    if len(binary_signal) > 0:
        current_run_length = 1
        current_run_state = binary_signal[0]
        for i in range(1, len(binary_signal)):
            if binary_signal[i] == current_run_state:
                current_run_length += 1
            else:
                durations.append(current_run_length * chunk_duration_s)
                states.append(current_run_state)
                current_run_state = binary_signal[i]
                current_run_length = 1
        # Append the final run
        durations.append(current_run_length * chunk_duration_s)
        states.append(current_run_state)
    
    durations = np.array(durations)
    states = np.array(states)

    # --- 5. Classify Durations and Decode ---
    mark_durations = durations[states == 1]
    if len(mark_durations) < 2:
        return {'full_text': '[ERROR: Not enough signal detected]', 'wpm': 0, 'avg_snr': avg_snr, 'events': [], 'binary_signal_data': binary_signal.tolist(), 'frequency': target_freq}

    # Use WPM override if provided, otherwise auto-detect
    if wpm_override is not None:
        wpm = wpm_override
        estimated_dot_s = 1.2 / wpm
        print(f"Using WPM override: {wpm}, Dot duration: {estimated_dot_s:.3f}s")
    else:
        # Robust auto-detection
        if np.mean(mark_durations) > 0 and np.std(mark_durations) > 0.02:
            mean_mark = np.mean(mark_durations)
            dot_marks = [d for d in mark_durations if d < mean_mark]
            if not dot_marks: dot_marks = [d / 3 for d in mark_durations]
        else:
            dot_marks = mark_durations

        if not dot_marks:
            return {'full_text': '[ERROR: Could not determine dot timing]', 'wpm': 0, 'avg_snr': avg_snr, 'events': [], 'binary_signal_data': binary_signal.tolist(), 'frequency': target_freq}

        estimated_dot_s = np.median(dot_marks)
        if estimated_dot_s == 0:
           return {'full_text': '[ERROR: No signal duration detected]', 'wpm': 0, 'avg_snr': avg_snr, 'events': [], 'binary_signal_data': binary_signal.tolist(), 'frequency': target_freq}
        
        wpm = 1.2 / estimated_dot_s
        print(f"Auto-detected dot duration: {estimated_dot_s:.3f}s, Calculated WPM: {wpm:.1f}")

    DOT_MAX = estimated_dot_s * 1.7
    DASH_MIN = estimated_dot_s * 2.0
    CHAR_SPACE_MIN = estimated_dot_s * 2.0
    WORD_SPACE_MIN = estimated_dot_s * 5.0
    
    MORSE_DECODE_DICT = {v: k for k, v in MORSE_CODE_DICT.items()}
    decoded_parts = []
    current_char = ""
    timestamped_events = []
    char_start_time = 0

    time_cursor = 0.0
    for i, state in enumerate(states):
        duration_s = durations[i]
        if state == 1: # Mark (tone)
            if not current_char: # First mark of a new potential character
                char_start_time = time_cursor
            
            if duration_s < DOT_MAX:
                current_char += "."
            elif duration_s > DASH_MIN:
                current_char += "-"
        else: # Space
            if current_char and duration_s > CHAR_SPACE_MIN:
                letter = MORSE_DECODE_DICT.get(current_char, '?')
                decoded_parts.append(letter)
                
                # The character region starts at the beginning of its first mark
                # and ends at the end of its last mark (the start of the current space).
                timestamped_events.append({
                    'start': char_start_time,
                    'end': time_cursor,
                    'char': letter
                })
                
                if duration_s > WORD_SPACE_MIN:
                    decoded_parts.append(' ')
                
                current_char = ""
        time_cursor += duration_s

    # Add the final character if it exists at the end of the file
    if current_char:
        letter = MORSE_DECODE_DICT.get(current_char, '?')
        decoded_parts.append(letter)
        timestamped_events.append({
            'start': char_start_time,
            'end': time_cursor,
            'char': letter
        })
    
    # Assemble the final string from the parts
    final_text = "".join(decoded_parts)
    
    print(f"Decoded text: {final_text}")

    return {
        'full_text': final_text,
        'wpm': round(wpm, 1),
        'threshold_factor': threshold_factor,
        'frequency': round(target_freq),
        'avg_snr': avg_snr,
        'events': timestamped_events,
        'binary_signal_data': binary_signal.tolist()
    }
