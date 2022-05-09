import IFlag from "../types/flag";

export default class Flag implements IFlag {
  public description: string = '';

  constructor(public name: string, public value: boolean) { }

  protected set (value: boolean) {
    this.value = value;
    return this;
  }

  toggle () {
    return this.set(!this.value);
  }

  turnOn () {
    return this.set(true);
  }

  turnOff () {
    return this.set(false);
  }
}
