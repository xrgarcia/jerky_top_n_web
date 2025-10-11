/**
 * EventBus - Central event dispatcher for decoupled communication
 * Implements publish-subscribe pattern for low coupling between modules
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
        this.eventLog = [];
        this.maxLogSize = 100;
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when event is fired
     * @param {Object} context - Optional context for the callback
     * @returns {Function} Unsubscribe function
     */
    on(eventName, callback, context = null) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        const listener = { callback, context };
        this.listeners.get(eventName).push(listener);

        return () => this.off(eventName, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} eventName - Name of the event to listen for
     * @param {Function} callback - Function to call when event is fired
     * @param {Object} context - Optional context for the callback
     */
    once(eventName, callback, context = null) {
        const onceWrapper = (data) => {
            callback.call(context, data);
            this.off(eventName, onceWrapper);
        };
        this.on(eventName, onceWrapper, context);
    }

    /**
     * Unsubscribe from an event
     * @param {string} eventName - Name of the event
     * @param {Function} callback - Callback to remove
     */
    off(eventName, callback) {
        if (!this.listeners.has(eventName)) return;

        const eventListeners = this.listeners.get(eventName);
        const index = eventListeners.findIndex(listener => listener.callback === callback);
        
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }

        if (eventListeners.length === 0) {
            this.listeners.delete(eventName);
        }
    }

    /**
     * Emit an event to all subscribers
     * @param {string} eventName - Name of the event
     * @param {*} data - Data to pass to listeners
     */
    emit(eventName, data = null) {
        this.logEvent(eventName, data);

        if (!this.listeners.has(eventName)) return;

        const eventListeners = this.listeners.get(eventName);
        eventListeners.forEach(({ callback, context }) => {
            try {
                callback.call(context, data);
            } catch (error) {
                console.error(`Error in event listener for ${eventName}:`, error);
            }
        });
    }

    /**
     * Log event for debugging
     * @private
     */
    logEvent(eventName, data) {
        this.eventLog.push({
            eventName,
            data,
            timestamp: new Date().toISOString()
        });

        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.shift();
        }
    }

    /**
     * Get event log for debugging
     * @returns {Array} Recent events
     */
    getEventLog() {
        return [...this.eventLog];
    }

    /**
     * Clear all listeners
     */
    clear() {
        this.listeners.clear();
    }
}

window.EventBus = EventBus;
