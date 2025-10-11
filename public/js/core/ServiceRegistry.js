/**
 * ServiceRegistry - Dependency injection container for managing service instances
 * Implements singleton pattern for shared services
 */
class ServiceRegistry {
    constructor() {
        this.services = new Map();
        this.factories = new Map();
    }

    /**
     * Register a service factory
     * @param {string} name - Service name
     * @param {Function} factory - Factory function that creates the service
     * @param {boolean} singleton - Whether to cache the instance
     */
    register(name, factory, singleton = true) {
        this.factories.set(name, { factory, singleton });
        
        if (this.services.has(name)) {
            this.services.delete(name);
        }
    }

    /**
     * Get a service instance
     * @param {string} name - Service name
     * @returns {*} Service instance
     */
    get(name) {
        if (this.services.has(name)) {
            return this.services.get(name);
        }

        if (!this.factories.has(name)) {
            throw new Error(`Service "${name}" not registered`);
        }

        const { factory, singleton } = this.factories.get(name);
        const instance = factory(this);

        if (singleton) {
            this.services.set(name, instance);
        }

        return instance;
    }

    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this.factories.has(name);
    }

    /**
     * Remove a service
     * @param {string} name - Service name
     */
    unregister(name) {
        this.factories.delete(name);
        this.services.delete(name);
    }

    /**
     * Clear all services
     */
    clear() {
        this.services.clear();
        this.factories.clear();
    }

    /**
     * Get all registered service names
     * @returns {Array<string>}
     */
    getServiceNames() {
        return Array.from(this.factories.keys());
    }
}

window.ServiceRegistry = ServiceRegistry;
