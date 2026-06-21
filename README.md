# MarkWeaver - Web to Markdown Clipper

MarkWeaver is a lightweight, privacy-focused Chrome Extension that converts webpage content into clean, readable Markdown.

## Purpose

This addon was created to convert and save clean Markdown text from webpages that might otherwise be difficult to copy or archive (such as single-page applications, dynamic client-rendered pages, or websites behind access barriers). Running as a local extension gives it direct access to the browser's rendered DOM of the active tab, bypassing traditional static scraping and clipper limitations.

## Features

- **Clean Parsing**: Traverses the webpage DOM to translate HTML tags (headings, inline formats, lists, blockquotes, code blocks, and tables) into Markdown.
- **Article Mode**: Strips sidebars, ads, scripts, navigation bars, and footers to extract the main content.
- **Visual Design**: Features a translucent glassmorphic interface with support for light and dark themes.
- **Persisted Settings**: Automatically saves preferences (theme, links/images settings) for future runs.

## Installation

1. Download and unpack `markweaver.zip`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** (top-left button) and select the unpacked folder.

## Credits

Inspired by the HTML-to-markdown conversion rules and structures from the [kreuzberg-dev/html-to-markdown](https://github.com/kreuzberg-dev/html-to-markdown) repository.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
