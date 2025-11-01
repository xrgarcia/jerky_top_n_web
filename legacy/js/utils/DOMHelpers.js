/**
 * DOMHelpers - Utility functions for DOM manipulation
 */
class DOMHelpers {
    /**
     * Create an element with attributes and children
     * @param {string} tag - HTML tag name
     * @param {Object} attrs - Element attributes
     * @param {Array|string} children - Child elements or text
     * @returns {HTMLElement}
     */
    static createElement(tag, attrs = {}, children = []) {
        const element = document.createElement(tag);

        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on')) {
                const eventName = key.substring(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else {
                element.setAttribute(key, value);
            }
        });

        const childArray = Array.isArray(children) ? children : [children];
        childArray.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });

        return element;
    }

    /**
     * Add a class to an element
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to add
     */
    static addClass(element, className) {
        if (element) {
            element.classList.add(className);
        }
    }

    /**
     * Remove a class from an element
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to remove
     */
    static removeClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    }

    /**
     * Toggle a class on an element
     * @param {HTMLElement} element - Target element
     * @param {string} className - Class to toggle
     */
    static toggleClass(element, className) {
        if (element) {
            element.classList.toggle(className);
        }
    }

    /**
     * Show an element
     * @param {HTMLElement} element - Element to show
     */
    static show(element) {
        if (element) {
            element.style.display = '';
        }
    }

    /**
     * Hide an element
     * @param {HTMLElement} element - Element to hide
     */
    static hide(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    /**
     * Get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    static getById(id) {
        return document.getElementById(id);
    }

    /**
     * Query selector
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Context element (default: document)
     * @returns {HTMLElement|null}
     */
    static query(selector, context = document) {
        return context.querySelector(selector);
    }

    /**
     * Query selector all
     * @param {string} selector - CSS selector
     * @param {HTMLElement} context - Context element (default: document)
     * @returns {NodeList}
     */
    static queryAll(selector, context = document) {
        return context.querySelectorAll(selector);
    }
}

window.DOMHelpers = DOMHelpers;
