/**
 * BaseService - Abstract base class for all services
 * Provides common functionality and lifecycle hooks
 */
class BaseService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.initialized = false;
        this.subscriptions = [];
    }

    /**
     * Initialize the service
     * Override this in subclasses
     */
    async initialize() {
        if (this.initialized) {
            console.warn(`${this.constructor.name} already initialized`);
            return;
        }
        this.initialized = true;
    }

    /**
     * Subscribe to an event and track the subscription
     * @param {string} eventName - Event to subscribe to
     * @param {Function} handler - Event handler
     */
    subscribe(eventName, handler) {
        const unsubscribe = this.eventBus.on(eventName, handler.bind(this));
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Emit an event through the event bus
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    emit(eventName, data) {
        this.eventBus.emit(eventName, data);
    }

    /**
     * Make an API request
     * @param {string} url - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<*>}
     */
    async apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            let data;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                const text = await response.text();
                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        console.error(`Failed to parse JSON response from ${url}:`, text);
                        throw new Error('Invalid JSON response from server');
                    }
                } else {
                    data = {};
                }
            } else {
                data = { error: 'Non-JSON response from server' };
            }

            if (!response.ok) {
                const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
                throw new Error(errorMessage);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${url}]:`, error);
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
        this.initialized = false;
    }
}

window.BaseService = BaseService;
