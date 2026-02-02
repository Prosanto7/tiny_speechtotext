// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Commands helper for the Moodle tiny_speechtotext plugin.
 *
 * @module      tiny_speechtotext/commands
 * @copyright   2026
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getButtonImage} from 'editor_tiny/utils';
import {get_string as getString} from 'core/str';
import {component, buttonName, icon} from './common';

// Map to store editor-specific state
const editorStates = new WeakMap();

/**
 * Get or create the state for a specific editor.
 *
 * @param {Editor} editor The TinyMCE editor instance
 * @returns {Object} The editor state
 */
const getEditorState = (editor) => {
    if (!editorStates.has(editor)) {
        editorStates.set(editor, {
            recognition: null,
            listening: false,
            finalTranscript: '',
            previewContainer: null
        });
    }
    return editorStates.get(editor);
};

// Define punctuation replacements (case-insensitive)
const punctuationMap = {
    'full stop': '.',
    'period': '.',
    'dot': '.',
    'comma': ',',
    'question mark': '?',
    'exclamation mark': '!',
    'exclamation point': '!',
    'semicolon': ';',
    'semi colon': ';',
    'colon': ':',
    'dash': '-',
    'hyphen': '-',
    'apostrophe': "'",
    'quotation mark': '"',
    'quote': '"',
    'open bracket': '(',
    'close bracket': ')',
    'open parenthesis': '(',
    'close parenthesis': ')',
    'new line': '\n',
    'new paragraph': '\n\n'
};

/**
 * Check if a word is a spoken punctuation word.
 *
 * @param {string} word The word to check
 * @returns {string|null} The punctuation symbol if it's a punctuation word, null otherwise
 */
const getPunctuationSymbol = (word) => {
    const lowerWord = word.toLowerCase().trim();
    return punctuationMap[lowerWord] || null;
};

/**
 * Process and convert text with punctuation handling.
 *
 * @param {string} text The text to process
 * @returns {string} The processed text with proper spacing
 */
const processTextWithPunctuation = (text) => {
    if (!text || !text.trim()) {
        return '';
    }

    // Split text into words
    const words = text.trim().split(/\s+/);
    let result = '';
    let i = 0;

    while (i < words.length) {
        let matched = false;
        let punctSymbol = null;
        let wordsConsumed = 0;

        // Try to match multi-word punctuation patterns (up to 3 words)
        for (let wordCount = 3; wordCount >= 1; wordCount--) {
            if (i + wordCount <= words.length) {
                const phrase = words.slice(i, i + wordCount).join(' ');
                punctSymbol = getPunctuationSymbol(phrase);

                if (punctSymbol) {
                    matched = true;
                    wordsConsumed = wordCount;
                    break;
                }
            }
        }

        if (matched && punctSymbol) {
            // It's a punctuation phrase - add the symbol without space before it
            result += punctSymbol;
            // Add space after punctuation (except for newlines)
            if (punctSymbol !== '\n' && punctSymbol !== '\n\n') {
                result += ' ';
            }
            i += wordsConsumed;
        } else {
            // It's a regular word - add space before it if result is not empty
            if (result.length > 0 && !result.endsWith('\n') && !result.endsWith(' ')) {
                result += ' ';
            }
            result += words[i];
            i++;
        }
    }

    return result;
};

/**
 * Create and show the preview container.
 *
 * @param {Editor} editor The TinyMCE editor instance
 */
const showPreview = (editor) => {
    const state = getEditorState(editor);

    if (state.previewContainer) {
        return; // Already exists
    }

    // Create preview container
    state.previewContainer = document.createElement('div');
    state.previewContainer.className = 'tiny-speechtotext-preview';
    state.previewContainer.innerHTML = `
        <div class="tiny-speechtotext-preview-header">
            <span class="tiny-speechtotext-preview-title"></span>
            <button class="tiny-speechtotext-preview-close" aria-label="Close preview">&times;</button>
        </div>
        <div class="tiny-speechtotext-preview-content">
            <span class="tiny-speechtotext-preview-text"></span>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .tiny-speechtotext-preview {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 350px;
            max-width: calc(100vw - 40px);
            background: #fff;
            border: 2px solid #0f6cbf;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .tiny-speechtotext-preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 15px;
            background: #0f6cbf;
            color: white;
            border-radius: 6px 6px 0 0;
            font-weight: 600;
            font-size: 14px;
        }
        .tiny-speechtotext-preview-close {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            line-height: 20px;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .tiny-speechtotext-preview-close:hover {
            background: rgba(255, 255, 255, 0.2);
        }
        .tiny-speechtotext-preview-content {
            padding: 15px;
            min-height: 60px;
            max-height: 200px;
            overflow-y: auto;
        }
        .tiny-speechtotext-preview-text {
            color: #333;
            font-size: 14px;
            line-height: 1.5;
            display: block;
        }
        .tiny-speechtotext-preview-text:empty::before {
            content: "Listening...";
            color: #999;
            font-style: italic;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .tiny-speechtotext-preview.listening .tiny-speechtotext-preview-header {
            animation: pulse 2s infinite;
        }
    `;

    if (!document.getElementById('tiny-speechtotext-preview-styles')) {
        style.id = 'tiny-speechtotext-preview-styles';
        document.head.appendChild(style);
    }

    // Add to document
    document.body.appendChild(state.previewContainer);

    // Set up close button
    const closeButton = state.previewContainer.querySelector('.tiny-speechtotext-preview-close');
    closeButton.addEventListener('click', () => {
        if (state.listening && state.recognition) {
            state.recognition.stop();
            state.listening = false;
        }
        hidePreview(editor);
    });

    // Load and set the title
    getString('previewtitle', component).then((str) => {
        const titleElement = state.previewContainer.querySelector('.tiny-speechtotext-preview-title');
        if (titleElement) {
            titleElement.textContent = str;
        }
        return str;
    }).catch(() => {
        const titleElement = state.previewContainer.querySelector('.tiny-speechtotext-preview-title');
        if (titleElement) {
            titleElement.textContent = 'Speech Preview';
        }
    });

    // Add listening class
    state.previewContainer.classList.add('listening');
};

/**
 * Hide and remove the preview container.
 *
 * @param {Editor} editor The TinyMCE editor instance
 */
const hidePreview = (editor) => {
    const state = getEditorState(editor);

    if (state.previewContainer) {
        state.previewContainer.remove();
        state.previewContainer = null;
    }
};

/**
 * Update the preview with interim text.
 *
 * @param {Editor} editor The TinyMCE editor instance
 * @param {string} text The interim text to display
 */
const updatePreview = (editor, text) => {
    const state = getEditorState(editor);

    if (state.previewContainer) {
        const textElement = state.previewContainer.querySelector('.tiny-speechtotext-preview-text');
        if (textElement) {
            // Process and display text with punctuation conversion
            textElement.textContent = processTextWithPunctuation(text);
        }
    }
};

/**
 * Handle the button action to start/stop speech recognition.
 *
 * @param {Editor} editor The TinyMCE editor instance
 */
const handleAction = (editor) => {
    const state = getEditorState(editor);

    if (!state.listening) {
        // Start listening
        try {
            if (!state.recognition) {
                initializeRecognition(editor);
            }
            showPreview(editor);
            state.recognition.start();
            state.listening = true;
        } catch (e) {
            window.console.error('Speech recognition start error:', e);
            hidePreview(editor);
        }
    } else {
        // Stop listening
        state.recognition.stop();
        state.listening = false;
        hidePreview(editor);
    }
};

/**
 * Initialize the speech recognition.
 *
 * @param {Editor} editor The TinyMCE editor instance
 */
const initializeRecognition = (editor) => {
    // Check if Web Speech API is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        window.console.warn("Speech API not supported in this browser");
        return;
    }

    const state = getEditorState(editor);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;

    // Auto language detection from document
    state.recognition.lang = document.documentElement.lang || 'en-US';

    // Handle speech recognition results
    state.recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                state.finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        // Update preview with interim results
        if (interimTranscript) {
            updatePreview(editor, interimTranscript);
        }

        // Insert the final transcript with punctuation conversion
        if (state.finalTranscript) {
            const processedText = processTextWithPunctuation(state.finalTranscript);

            // Check if processed text starts with punctuation
            const startsWithPunctuation = /^[.,!?;:)\]]/.test(processedText);

            // Get current cursor position and check if we need to add space
            const currentContent = editor.getContent({format: 'text'});
            const needsSpace = currentContent.length > 0 &&
                              !currentContent.endsWith(' ') &&
                              !currentContent.endsWith('\n') &&
                              !startsWithPunctuation;

            // Insert space before text if needed, unless it starts with punctuation
            const textToInsert = (needsSpace ? ' ' : '') + processedText;

            editor.insertContent(textToInsert);
            state.finalTranscript = '';
            // Clear preview after inserting final text
            updatePreview(editor, '');
        }
    };

    // Handle errors
    state.recognition.onerror = (event) => {
        window.console.error('Speech recognition error:', event.error);
        state.listening = false;
        hidePreview(editor);
    };

    // Handle end event
    state.recognition.onend = () => {
        state.listening = false;
        hidePreview(editor);
    };
};

/**
 * Get the setup function for the buttons and menu items.
 *
 * @returns {function} The setup function
 */
export const getSetup = async() => {
    const [
        buttonText,
        buttonImage,
    ] = await Promise.all([
        getString('buttontitle', component),
        getButtonImage(icon, component),
    ]);

    return (editor) => {
        // Check if Web Speech API is supported
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            window.console.warn("Speech API not supported in this browser");
            return;
        }

        // Register the icon.
        editor.ui.registry.addIcon(icon, buttonImage.html);

        // Register the toggle button.
        editor.ui.registry.addToggleButton(buttonName, {
            icon: icon,
            tooltip: buttonText,
            onAction: () => handleAction(editor),
            onSetup: (api) => {
                const state = getEditorState(editor);
                const updateState = () => {
                    api.setActive(state.listening);
                };

                // Update state periodically
                const interval = setInterval(updateState, 100);

                return () => {
                    clearInterval(interval);
                };
            }
        });

        // Register the menu item.
        editor.ui.registry.addMenuItem(buttonName, {
            icon: icon,
            text: buttonText,
            onAction: () => handleAction(editor),
        });
    };
};
