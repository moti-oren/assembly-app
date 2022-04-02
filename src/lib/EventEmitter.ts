import { EventHandler } from '../types/event-emitter';
import { Events } from '../types/event-emitter';
import { EventEmitter as IEventEmitter } from '../types/event-emitter';

export default class EventEmitter implements IEventEmitter {
  protected events: Events = {};
  protected maxListeners: number = 0;
  protected readonly internalEvents = {
    newListener: 'listener.new',
    removeListener: 'listener.remove',
    error: 'error'
  };

  on (name: string, func: EventHandler) {
    try {
      const finalEvent = this.addHandler(name, func);
      this.emit(this.internalEvents.newListener, finalEvent);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }
    return this;
  }

  once (name: string, func: EventHandler) {
    try {
      const finalEvent = this.addHandler(name, func, true);
      this.emit(this.internalEvents.newListener, finalEvent);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }
    return this;
  }

  prependListener (name: string, func: EventHandler) {
    try {
      const finalEvent = this.addHandler(name, func, false, true);
      this.emit(this.internalEvents.newListener, finalEvent);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }
    return this;
  }

  prependOnceListener (name: string, func: EventHandler) {
    try {
      const finalEvent = this.addHandler(name, func, true, true);
      this.emit(this.internalEvents.newListener, finalEvent);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }
    return this;
  }

  off (name: string, func: EventHandler) {
    try {
      this.removeHandler(name, func);
      this.emit(this.internalEvents.removeListener);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }

    return this;
  }

  offAll (name: string) {
    try {
      this.removeEvent(name);
      this.emit(this.internalEvents.removeListener);
    } catch (error) {
      this.emit(this.internalEvents.error, error);
    }

    return this;
  }

  emit (name: string, ...args: any[]) {
    const targetEvent = this.getEvent(name);

    if (!targetEvent) {
      return false;
    }

    targetEvent.forEach((eventHandler) => {
      try {
        eventHandler.func(name, ...args);
      } catch (error) {
        this.emit(this.internalEvents.error, error);
      }
      if (eventHandler.once) {
        this.off(name, eventHandler.func);
      }
    });

    return true;
  }

  setMaxListeners (n: number) {
    this.maxListeners = n;

    return this;
  }

  getMaxListeners () {
    return this.maxListeners;
  }

  eventNames () {
    return Object.keys(this.events);
  }

  listeners (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.filter((eventHandler) => !eventHandler.once).map((eventHandler) => eventHandler.func);
    }

    return [];
  }

  listenerCount (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.length;
    }

    return 0;
  }

  rawListeners (name: string) {
    const targetEvent = this.getEvent(name);

    if (targetEvent) {
      return targetEvent.map((eventHandler) => eventHandler.func);
    }

    return [];
  }

  protected addHandler (name: string, func: EventHandler, once: boolean = false, prepend: boolean = false) {
    const finalEvent = { name, func, once };

    if (this.events[name]) {
      const targetEvent = this.getEvent(name);
      if (this.maxListeners && targetEvent.length >= this.maxListeners) {
        throw new Error('Max listeners reached');
      }
      targetEvent.push({ func, once });
    }

    if (prepend) {
      this.events[name].unshift({ func, once });
    } else {
      this.events[name].push({ func, once });
    }

    return finalEvent;
  }

  protected removeHandler (name: string, func: EventHandler) {
    if (!this.events[name]) {
      throw new Error('No such event');
    }

    this.events[name] = this.events[name].filter((eventHandler) => eventHandler.func !== func);
    return true;
  }

  protected removeEvent (name: string) {
    if (!this.events[name]) {
      throw new Error('No such event');
    }

    delete this.events[name];
    return true;
  }

  protected getEvent (name: string) {
    return this.events[name];
  }
}

export const eventEmitterSingleton = new EventEmitter();
