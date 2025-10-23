#!/usr/bin/env python3
"""
resize_images_pro.py
Professional image resizing tool for pre-press workflows.

Resizes images with configurable DPI, format, and quality settings.
Supports recursive directory processing with structure preservation.
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Tuple, Optional, List
from statistics import mean

try:
    from PIL import Image, ImageEnhance
except ImportError:
    print("Error: Pillow library is required. Install with: pip install Pillow")
    sys.exit(1)


# ANSI color codes for terminal output
class Colors:
    """ANSI color codes for formatted console output."""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def colorize(text: str, color: str) -> str:
    """
    Apply ANSI color to text with fallback for unsupported terminals.
    
    Args:
        text: The text to colorize
        color: ANSI color code
        
    Returns:
        Colored text string
    """
    if sys.stdout.isatty():
        return f"{color}{text}{Colors.RESET}"
    return text


def calculate_degradation(original_size: Tuple[int, int], new_size: Tuple[int, int]) -> float:
    """
    Calculate estimated degradation percentage from resizing.
    
    Degradation is computed as the difference in total pixel count,
    indicating potential quality loss when upscaling.
    
    Args:
        original_size: (width, height) of original image
        new_size: (width, height) of resized image
        
    Returns:
        Degradation percentage (positive for upscaling, negative for downscaling)
    """
    original_pixels = original_size[0] * original_size[1]
    new_pixels = new_size[0] * new_size[1]
    
    if original_pixels == 0:
        return 0.0
    
    degradation = 100 - (original_pixels / new_pixels * 100)
    return degradation


def create_output_path(
    input_path: Path,
    input_dir: Path,
    output_dir: Path,
    recursive: bool,
    output_format: str,
    scale_percent: int
) -> Path:
    """
    Generate output path preserving directory structure if recursive.
    
    Args:
        input_path: Path to input file
        input_dir: Root input directory
        output_dir: Root output directory
        recursive: Whether to preserve subdirectory structure
        output_format: Target file format extension
        scale_percent: Scale percentage for filename suffix
        
    Returns:
        Complete output file path
    """
    # Add x<percent> suffix to filename
    new_filename = f"{input_path.stem}x{scale_percent}.{output_format.lower()}"
    
    if recursive:
        relative_path = input_path.relative_to(input_dir)
        output_path = output_dir / relative_path.parent / new_filename
    else:
        output_path = output_dir / new_filename
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return output_path


def process_image(
    input_path: Path,
    output_path: Path,
    scale_factor: float,
    dpi: int,
    output_format: str,
    quality: int,
    saturation: float,
    sharpness: float,
    verbose: bool
) -> Optional[Tuple[Tuple[int, int], Tuple[int, int], float]]:
    """
    Process a single image: resize, set DPI, enhance, and save.
    
    Args:
        input_path: Path to input image
        output_path: Path to output image
        scale_factor: Scaling factor (e.g., 1.5 for 150%)
        dpi: Target DPI value
        output_format: Output format (PNG, JPG, TIFF)
        quality: JPEG quality setting (1-100)
        saturation: Saturation enhancement factor (1.0 = no change, >1.0 = more saturated)
        sharpness: Sharpness enhancement factor (1.0 = no change, >1.0 = sharper)
        verbose: Enable detailed logging
        
    Returns:
        Tuple of (original_size, new_size, degradation) or None if failed
    """
    try:
        with Image.open(input_path) as img:
            original_size = img.size
            
            # Calculate new dimensions
            new_width = int(original_size[0] * scale_factor)
            new_height = int(original_size[1] * scale_factor)
            new_size = (new_width, new_height)
            
            # Resize with bicubic interpolation
            resized_img = img.resize(new_size, Image.BICUBIC)
            
            # Apply saturation enhancement if specified
            if saturation != 1.0:
                enhancer = ImageEnhance.Color(resized_img)
                resized_img = enhancer.enhance(saturation)
            
            # Apply sharpness enhancement if specified
            if sharpness != 1.0:
                enhancer = ImageEnhance.Sharpness(resized_img)
                resized_img = enhancer.enhance(sharpness)
            
            # Calculate degradation
            degradation = calculate_degradation(original_size, new_size)
            
            # Prepare save parameters
            save_kwargs = {'dpi': (dpi, dpi)}
            
            # Convert mode if necessary
            if output_format.upper() == 'JPG':
                if resized_img.mode in ('RGBA', 'LA', 'P'):
                    # Convert to RGB for JPEG
                    rgb_img = Image.new('RGB', resized_img.size, (255, 255, 255))
                    if resized_img.mode == 'P':
                        resized_img = resized_img.convert('RGBA')
                    rgb_img.paste(resized_img, mask=resized_img.split()[-1] if resized_img.mode in ('RGBA', 'LA') else None)
                    resized_img = rgb_img
                save_kwargs['quality'] = quality
                save_kwargs['optimize'] = True
            elif output_format.upper() == 'PNG':
                save_kwargs['optimize'] = True
            elif output_format.upper() == 'TIFF':
                save_kwargs['compression'] = 'tiff_lzw'
            
            # Save the resized image
            resized_img.save(output_path, format=output_format.upper(), **save_kwargs)
            
            # Log success
            if verbose:
                status = colorize('✅', Colors.GREEN)
                filename = input_path.name
                dims = f"{original_size[0]}x{original_size[1]} → {new_size[0]}x{new_size[1]}"
                deg_color = Colors.YELLOW if degradation > 0 else Colors.GREEN
                deg_text = colorize(f"{degradation:+.2f}%", deg_color)
                print(f"{status} {filename:30s} | {dims:20s} | degradation: {deg_text}")
            
            return (original_size, new_size, degradation)
            
    except Exception as e:
        warning = colorize('⚠️', Colors.YELLOW)
        print(f"{warning} {input_path.name} skipped: {str(e)}")
        return None


def resize_images(
    input_folder: Path,
    scale_percent: int,
    recursive: bool,
    dpi: int,
    output_format: str,
    quality: int,
    saturation: float,
    sharpness: float,
    verbose: bool,
    overwrite: bool
) -> None:
    """
    Main image resizing function with batch processing.
    
    Args:
        input_folder: Directory containing input images
        scale_percent: Scale percentage (e.g., 150 for 150%)
        recursive: Process subdirectories recursively
        dpi: Target DPI value
        output_format: Output format (PNG, JPG, TIFF)
        quality: JPEG quality (1-100)
        saturation: Saturation enhancement factor (1.0 = no change)
        sharpness: Sharpness enhancement factor (1.0 = no change)
        verbose: Enable detailed logging
        overwrite: Overwrite existing output files
    """
    # Validate input folder
    if not input_folder.exists():
        print(colorize(f"Error: Input folder '{input_folder}' does not exist.", Colors.RED))
        sys.exit(1)
    
    if not input_folder.is_dir():
        print(colorize(f"Error: '{input_folder}' is not a directory.", Colors.RED))
        sys.exit(1)
    
    # Calculate scale factor
    scale_factor = scale_percent / 100.0
    
    # Create output directory
    output_dir = input_folder.parent / f"outx{scale_percent}"
    
    if output_dir.exists() and not overwrite:
        print(colorize(f"Error: Output directory '{output_dir}' already exists. Use --overwrite to replace.", Colors.RED))
        sys.exit(1)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Supported image extensions
    supported_extensions = {'.png', '.jpg', '.jpeg', '.tiff', '.tif'}
    
    # Collect image files
    if recursive:
        image_files = [
            f for f in input_folder.rglob('*')
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]
    else:
        image_files = [
            f for f in input_folder.iterdir()
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]
    
    if not image_files:
        print(colorize("No supported image files found.", Colors.YELLOW))
        sys.exit(0)
    
    # Print header
    if verbose:
        header = colorize(f"\n🎨 Processing {len(image_files)} images at {scale_percent}% scale", Colors.BOLD + Colors.BLUE)
        print(header)
        print(colorize(f"   Output: {output_dir}", Colors.BLUE))
        print(colorize(f"   DPI: {dpi} | Format: {output_format} | Quality: {quality}", Colors.BLUE))
        print(colorize(f"   Saturation: {saturation}x | Sharpness: {sharpness}x\n", Colors.BLUE))
    
    # Process images
    start_time = time.time()
    results: List[Tuple[Tuple[int, int], Tuple[int, int], float]] = []
    
    for input_path in image_files:
        output_path = create_output_path(
            input_path,
            input_folder,
            output_dir,
            recursive,
            output_format,
            scale_percent
        )
        
        # Skip if output exists and overwrite is disabled
        if output_path.exists() and not overwrite:
            if verbose:
                warning = colorize('⚠️', Colors.YELLOW)
                print(f"{warning} {input_path.name} skipped: output already exists")
            continue
        
        result = process_image(
            input_path,
            output_path,
            scale_factor,
            dpi,
            output_format,
            quality,
            saturation,
            sharpness,
            verbose
        )
        
        if result:
            results.append(result)
    
    # Calculate summary statistics
    elapsed_time = time.time() - start_time
    processed_count = len(results)
    
    if processed_count > 0:
        degradations = [r[2] for r in results]
        avg_degradation = mean(degradations)
        
        # Print summary
        print()
        summary_icon = colorize('🎨', Colors.BLUE)
        summary_text = f"{summary_icon} {colorize('Summary:', Colors.BOLD)}"
        count_text = colorize(f"{processed_count} files processed", Colors.GREEN)
        deg_color = Colors.YELLOW if avg_degradation > 0 else Colors.GREEN
        avg_deg_text = colorize(f"{avg_degradation:+.2f}%", deg_color)
        time_text = colorize(f"{elapsed_time:.2f}s", Colors.BLUE)
        
        print(f"{summary_text} {count_text} | avg degradation: {avg_deg_text} | elapsed: {time_text}")
    else:
        print(colorize("\n⚠️ No images were processed.", Colors.YELLOW))


def main() -> None:
    """
    Parse command-line arguments and execute image resizing.
    """
    parser = argparse.ArgumentParser(
        description='Professional image resizing tool for pre-press workflows.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s ./assets 150
  %(prog)s ./images 175 -d 600 -f JPG -v
  %(prog)s ./photos 80 -f PNG -q 95 -o
        """
    )
    
    # Required arguments
    parser.add_argument(
        'input_folder',
        type=Path,
        help='Path to directory containing images (PNG/JPG/TIFF)'
    )
    
    parser.add_argument(
        'scale_percent',
        type=int,
        help='Scale percentage (e.g., 150 = enlarge by 150%%)'
    )
    
    # Optional arguments
    parser.add_argument(
        '-r', '--recursive',
        action='store_true',
        default=True,
        help='Process subdirectories recursively and preserve structure (default: True)'
    )
    
    parser.add_argument(
        '-d', '--dpi',
        type=int,
        default=300,
        help='Set custom DPI (default: 300)'
    )
    
    parser.add_argument(
        '-f', '--format',
        type=str,
        default='PNG',
        choices=['PNG', 'JPG', 'TIFF', 'png', 'jpg', 'tiff'],
        help='Output format: PNG, JPG, or TIFF (default: PNG)'
    )
    
    parser.add_argument(
        '-q', '--quality',
        type=int,
        default=95,
        help='Output compression quality for JPEG (1-100, default: 95)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Display detailed log lines'
    )
    
    parser.add_argument(
        '-o', '--overwrite',
        action='store_true',
        help='Overwrite existing output if already exists'
    )
    
    parser.add_argument(
        '-s', '--saturation',
        type=float,
        default=1.0,
        help='Saturation enhancement factor (1.0 = no change, >1.0 = more saturated, <1.0 = less saturated, default: 1.0)'
    )
    
    parser.add_argument(
        '-p', '--sharpness',
        type=float,
        default=1.0,
        help='Sharpness enhancement factor (1.0 = no change, >1.0 = sharper, <1.0 = blurred, default: 1.0)'
    )
    
    args = parser.parse_args()
    
    # Validate scale_percent
    if args.scale_percent <= 0:
        parser.error("scale_percent must be a positive integer")
    
    # Validate quality
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")
    
    # Validate DPI
    if args.dpi <= 0:
        parser.error("dpi must be a positive integer")
    
    # Validate saturation
    if args.saturation < 0:
        parser.error("saturation must be a positive number")
    
    # Validate sharpness
    if args.sharpness < 0:
        parser.error("sharpness must be a positive number")
    
    # Execute resizing
    resize_images(
        input_folder=args.input_folder,
        scale_percent=args.scale_percent,
        recursive=args.recursive,
        dpi=args.dpi,
        output_format=args.format.upper(),
        quality=args.quality,
        saturation=args.saturation,
        sharpness=args.sharpness,
        verbose=args.verbose,
        overwrite=args.overwrite
    )


if __name__ == '__main__':
    main()
