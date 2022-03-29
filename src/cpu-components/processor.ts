import Processor from "../lib/Processor";
import registers from "./registers";
import flags from "./flags";
import instructions from "./instructions";

export default new Processor(registers, flags, instructions);
