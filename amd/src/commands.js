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

let recognition = null;
let listening = false;
let finalTranscript = '';

/**
 * Handle the button action to start/stop speech recognition.
 *
 * @param {Editor} editor The TinyMCE editor instance
 */
const handleAction = (editor) => {
    if (!listening) {
        // Start listening
        try {
            if (!recognition) {
                initializeRecognition(editor);
            }
            recognition.start();
            listening = true;
        } catch (e) {
            window.console.error('Speech recognition start error:', e);
        }
    } else {
        // Stop listening
        recognition.stop();
        listening = false;
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

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // Auto language detection from document
    recognition.lang = document.documentElement.lang || 'en-US';

    // Handle speech recognition results
    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        // Insert the final transcript
        if (finalTranscript) {
            editor.insertContent(finalTranscript);
            finalTranscript = '';
        }
    };

    // Handle errors
    recognition.onerror = (event) => {
        window.console.error('Speech recognition error:', event.error);
        listening = false;
    };

    // Handle end event
    recognition.onend = () => {
        listening = false;
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
                const updateState = () => {
                    api.setActive(listening);
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
