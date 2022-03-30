export default class Flag {
  public description: string = '';

  constructor(public name: string, public value: boolean) { }

  get binaryValue (): number {
    return +this.value;
  }

  turnOn () {
    this.value = true;
    return this;
  }

  turnOff () {
    this.value = false;
    return this;
  }
}
