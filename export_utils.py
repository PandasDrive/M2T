"""
Export Utilities Module
Provides functions to export decoded Morse code text in various formats.
"""
import json
import csv
import io
from datetime import datetime


def export_to_txt(decoded_text, metadata=None):
    """
    Export decoded text to plain text format.
    
    Args:
        decoded_text: The decoded text string
        metadata: Optional dictionary with metadata (WPM, frequency, etc.)
        
    Returns:
        String containing the text file content
    """
    lines = []
    
    if metadata:
        lines.append(f"# M2T Decoded Morse Code Export")
        lines.append(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if 'wpm' in metadata:
            lines.append(f"# Words Per Minute: {metadata['wpm']}")
        if 'frequency' in metadata:
            lines.append(f"# Target Frequency: {metadata['frequency']} Hz")
        if 'avg_snr' in metadata:
            lines.append(f"# Average SNR: {metadata['avg_snr']:.2f}")
        lines.append("")
        lines.append("--- Decoded Text ---")
        lines.append("")
    
    lines.append(decoded_text)
    
    return "\n".join(lines)


def export_to_csv(decoded_text, events=None, metadata=None):
    """
    Export decoded text and timing events to CSV format.
    
    Args:
        decoded_text: The decoded text string
        events: List of event dictionaries with 'start', 'end', 'char' keys
        metadata: Optional dictionary with metadata
        
    Returns:
        String containing the CSV file content
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write metadata header
    if metadata:
        writer.writerow(["# M2T Decoded Morse Code Export (CSV)"])
        writer.writerow(["# Generated", datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        
        for key, value in metadata.items():
            if key != 'events':
                writer.writerow([f"# {key}", value])
        writer.writerow([])
    
    # Write full text
    writer.writerow(["Full Decoded Text"])
    writer.writerow([decoded_text])
    writer.writerow([])
    
    # Write timing events if available
    if events:
        writer.writerow(["Character", "Start Time (s)", "End Time (s)", "Duration (s)"])
        for event in events:
            duration = event.get('end', 0) - event.get('start', 0)
            writer.writerow([
                event.get('char', ''),
                f"{event.get('start', 0):.3f}",
                f"{event.get('end', 0):.3f}",
                f"{duration:.3f}"
            ])
    
    return output.getvalue()


def export_to_json(decoded_text, events=None, metadata=None):
    """
    Export decoded text, events, and metadata to JSON format.
    
    Args:
        decoded_text: The decoded text string
        events: List of event dictionaries
        metadata: Optional dictionary with metadata
        
    Returns:
        String containing the JSON file content
    """
    export_data = {
        'export_info': {
            'generated': datetime.now().isoformat(),
            'source': 'M2T Morse Code Decoder'
        },
        'decoded_text': decoded_text,
    }
    
    if metadata:
        export_data['metadata'] = {k: v for k, v in metadata.items() if k != 'events'}
    
    if events:
        export_data['events'] = events
    
    return json.dumps(export_data, indent=2)


def export_to_formatted_text(decoded_text, events=None, metadata=None):
    """
    Export to a formatted, human-readable text format with timing information.
    
    Args:
        decoded_text: The decoded text string
        events: List of event dictionaries
        metadata: Optional dictionary with metadata
        
    Returns:
        String containing formatted text
    """
    lines = []
    
    lines.append("=" * 60)
    lines.append("M2T MORSE CODE DECODER - EXPORT REPORT")
    lines.append("=" * 60)
    lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    if metadata:
        lines.append("--- DECODING PARAMETERS ---")
        if 'wpm' in metadata:
            lines.append(f"Words Per Minute (WPM): {metadata['wpm']}")
        if 'frequency' in metadata:
            lines.append(f"Target Frequency: {metadata['frequency']} Hz")
        if 'threshold_factor' in metadata:
            lines.append(f"Threshold Factor: {metadata['threshold_factor']}")
        if 'avg_snr' in metadata:
            lines.append(f"Average Signal-to-Noise Ratio: {metadata['avg_snr']:.2f}")
        lines.append("")
    
    lines.append("--- DECODED TEXT ---")
    lines.append("")
    lines.append(decoded_text)
    lines.append("")
    
    if events:
        lines.append("--- TIMING INFORMATION ---")
        lines.append("")
        lines.append(f"{'Char':<6} {'Start (s)':<12} {'End (s)':<12} {'Duration (s)':<14}")
        lines.append("-" * 60)
        
        for event in events:
            start = event.get('start', 0)
            end = event.get('end', 0)
            duration = end - start
            char = event.get('char', '')
            lines.append(f"{char:<6} {start:<12.3f} {end:<12.3f} {duration:<14.3f}")
        lines.append("")
    
    lines.append("=" * 60)
    
    return "\n".join(lines)

