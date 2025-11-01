/**
 * BaseController - Abstract base class for page controllers
 * Handles page lifecycle and UI coordination
 */
class BaseController {
    constructor(eventBus, serviceRegistry) {
        this.eventBus = eventBus;
        this.serviceRegistry = serviceRegistry;
        this.isActive = false;
        this.subscriptions = [];
    }

    /**
     * Activate the controller (page shown)
     * Override this in subclasses
     */
    async activate() {
        if (this.isActive) return;
        this.isActive = true;
        this.setupEventListeners();
    }

    /**
     * Deactivate the controller (page hidden)
     */
    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        this.cleanup();
    }

    /**
     * Setup event listeners
     * Override this in subclasses
     */
    setupEventListeners() {
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler
     */
    subscribe(eventName, handler) {
        const unsubscribe = this.eventBus.on(eventName, handler.bind(this));
        this.subscriptions.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Emit an event
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     */
    emit(eventName, data) {
        this.eventBus.emit(eventName, data);
    }

    /**
     * Get a service from registry
     * @param {string} name - Service name
     * @returns {*} Service instance
     */
    getService(name) {
        return this.serviceRegistry.get(name);
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.subscriptions.forEach(unsubscribe => unsubscribe());
        this.subscriptions = [];
    }

    /**
     * Destroy the controller
     */
    destroy() {
        this.deactivate();
    }
}

window.BaseController = BaseController;
