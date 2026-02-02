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

// Punctuation marks that trigger capitalization of next word
const sentenceEndingPunctuation = ['.', '?', '!', '\n\n'];

/**
 * Check if a punctuation symbol ends a sentence.
 *
 * @param {string} symbol The punctuation symbol
 * @returns {boolean} True if it ends a sentence
 */
const isSentenceEnding = (symbol) => sentenceEndingPunctuation.includes(symbol);

/**
 * Check if a word/phrase is a spoken punctuation.
 *
 * @param {string} phrase The phrase to check
 * @returns {string|null} The punctuation symbol if matched, null otherwise
 */
const getPunctuationSymbol = (phrase) => {
    const normalized = phrase.toLowerCase().trim();
    return punctuationMap[normalized] || null;
};

/**
 * Try to match multi-word punctuation from a word array.
 *
 * @param {Array} words Array of words
 * @param {number} startIndex Starting index in the array
 * @returns {Object} Object with {symbol, wordsConsumed} or null if no match
 */
const matchPunctuation = (words, startIndex) => {
    // Try matching 3 words, then 2, then 1
    for (let wordCount = 3; wordCount >= 1; wordCount--) {
        if (startIndex + wordCount <= words.length) {
            const phrase = words.slice(startIndex, startIndex + wordCount).join(' ');
            const symbol = getPunctuationSymbol(phrase);

            if (symbol) {
                return {symbol, wordsConsumed: wordCount};
            }
        }
    }
    return null;
};

/**
 * Capitalize the first letter of a word.
 *
 * @param {string} word The word to capitalize
 * @returns {string} The capitalized word
 */
const capitalizeWord = (word) => {
    if (!word || word.length === 0) {
        return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
};

/**
 * Add appropriate spacing before text.
 *
 * @param {string} currentResult Current result string
 * @returns {string} Space character or empty string
 */
const getSpacingBefore = (currentResult) => {
    if (currentResult.length === 0) {
        return '';
    }
    if (currentResult.endsWith('\n') || currentResult.endsWith(' ')) {
        return '';
    }
    return ' ';
};

/**
 * Process and convert text with punctuation handling.
 *
 * @param {string} text The text to process
 * @returns {string} The processed text with proper spacing and capitalization
 */
const processTextWithPunctuation = (text) => {
    if (!text || !text.trim()) {
        return '';
    }

    const words = text.trim().split(/\s+/);
    let result = '';
    let shouldCapitalize = false;
    let i = 0;

    while (i < words.length) {
        const punctMatch = matchPunctuation(words, i);

        if (punctMatch) {
            // Add punctuation symbol directly (no space before)
            result += punctMatch.symbol;

            // Add space after (except newlines)
            if (punctMatch.symbol !== '\n' && punctMatch.symbol !== '\n\n') {
                result += ' ';
            }

            // Mark next word for capitalization if sentence-ending
            if (isSentenceEnding(punctMatch.symbol)) {
                shouldCapitalize = true;
            }

            i += punctMatch.wordsConsumed;
        } else {
            // Regular word - add spacing and handle capitalization
            result += getSpacingBefore(result);

            let word = words[i];
            if (shouldCapitalize) {
                word = capitalizeWord(word);
                shouldCapitalize = false;
            }

            result += word;
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
 * Check if text should be capitalized based on editor content.
 *
 * @param {string} editorContent Current editor content
 * @param {string} textToInsert Text that will be inserted
 * @returns {boolean} True if text should be capitalized
 */
const shouldCapitalizeText = (editorContent, textToInsert) => {
    // Don't capitalize if editor is empty or text doesn't start with lowercase letter
    if (editorContent.length === 0 || !/^[a-z]/.test(textToInsert)) {
        return false;
    }

    // Capitalize if previous content ended with sentence-ending punctuation
    return /[.!?]\s*$/.test(editorContent.trim());
};

/**
 * Check if spacing is needed before new text.
 *
 * @param {string} editorContent Current editor content
 * @param {string} textToInsert Text that will be inserted
 * @returns {boolean} True if space is needed
 */
const needsSpaceBefore = (editorContent, textToInsert) => {
    if (editorContent.length === 0) {
        return false;
    }

    // No space if editor content ends with space or newline
    if (editorContent.endsWith(' ') || editorContent.endsWith('\n')) {
        return false;
    }

    // No space if new text starts with punctuation
    if (/^[.,!?;:)\]]/.test(textToInsert)) {
        return false;
    }

    return true;
};

/**
 * Prepare text for insertion into editor.
 *
 * @param {Editor} editor The TinyMCE editor instance
 * @param {string} text The processed text to insert
 * @returns {string} The final text ready for insertion
 */
const prepareTextForInsertion = (editor, text) => {
    const currentContent = editor.getContent({format: 'text'});

    let finalText = text;

    // Apply capitalization if needed
    if (shouldCapitalizeText(currentContent, finalText)) {
        finalText = capitalizeWord(finalText);
    }

    // Add spacing if needed
    if (needsSpaceBefore(currentContent, finalText)) {
        finalText = ' ' + finalText;
    }

    return finalText;
};

/**
 * Handle finalized speech recognition results.
 *
 * @param {Editor} editor The TinyMCE editor instance
 * @param {Object} state The editor state
 */
const handleFinalTranscript = (editor, state) => {
    if (!state.finalTranscript) {
        return;
    }

    // Process text with punctuation conversion
    const processedText = processTextWithPunctuation(state.finalTranscript);

    // Prepare text with proper spacing and capitalization
    const textToInsert = prepareTextForInsertion(editor, processedText);

    // Insert into editor
    editor.insertContent(textToInsert);

    // Reset state
    state.finalTranscript = '';
    updatePreview(editor, '');
};

/**
 * Handle speech recognition result event.
 *
 * @param {Editor} editor The TinyMCE editor instance
 * @param {Object} state The editor state
 * @param {Event} event The speech recognition event
 */
const handleRecognitionResult = (editor, state, event) => {
    let interimTranscript = '';

    // Collect interim and final results
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

    // Handle final transcript
    handleFinalTranscript(editor, state);
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
    state.recognition.lang = 'en-US';

    // Handle speech recognition results
    state.recognition.onresult = (event) => handleRecognitionResult(editor, state, event);

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
