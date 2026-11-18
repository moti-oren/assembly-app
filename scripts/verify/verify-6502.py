"""Checks the 6502 core against py65, an independent NMOS 6502 assembler and simulator.

- py65's assembler assembles every instruction the playground encodes: the bytes must match.
- py65's simulator runs random programs from their bytes: A, X, Y, SP, P, PC, memory and the
  number of cycles must end up exactly as the playground left them.
- In decimal mode py65 does not reproduce the NMOS chip's N, V and Z (the playground follows the
  chip, as documented by Bruce Clark), so BCD sums are compared on A and C only, with valid digits.

Needs `pip install py65`. Usage: python scripts/verify/verify-6502.py [seed]
"""

import json
import subprocess
import sys

from py65.assembler import Assembler
from py65.devices.mpu6502 import MPU

CODE = 0x0600
# P as py65 keeps it has B and bit 5 set; the playground's P has no B. Compare the real flags.
FLAGS = 0xCF


def cases(seed):
    output = subprocess.run(
        f'npx vite-node scripts/verify/mos6502Cases.ts {seed}',
        shell=True, check=True, capture_output=True, text=True, encoding='utf-8'
    ).stdout
    return json.loads(output)


def check_encodings(encodings):
    assembler = Assembler(MPU())
    failures = []
    for case in encodings:
        theirs = assembler.assemble(case['text'], case['address'])
        ours = case['bytes']
        # The playground gives BRK its signature byte; py65 assembles the opcode alone.
        if case['text'] == 'brk':
            ours = ours[:1]
        if theirs != ours:
            failures.append(f"{case['text']} at ${case['address']:04x}: playground {ours}, py65 {theirs}")
    return failures


def machine(case):
    mpu = MPU()
    # py65's table has DEC absolute ($CE) at 3 cycles; the 6502 data sheet says 6, as for INC ($EE).
    mpu.cycletime[0xCE] = 6
    for address, value in enumerate(case.get('zeroPage', [])):
        mpu.memory[address] = value
    for i, value in enumerate(case.get('data', [])):
        mpu.memory[0x0200 + i] = value
    mpu.memory[CODE:CODE + len(case['bytes'])] = case['bytes']
    start = case['initial']
    mpu.a, mpu.x, mpu.y, mpu.sp = start['a'], start['x'], start['y'], start['sp']
    mpu.p = start['p'] | 0x30
    mpu.pc = CODE
    end = CODE + len(case['bytes'])
    for _ in range(10 * len(case['program']) + 10):
        if mpu.pc == end:
            break
        mpu.step()
    return mpu


def check_executions(executions):
    failures, skipped = [], 0
    for number, case in enumerate(executions):
        if case['skip']:
            skipped += 1
            continue
        mpu = machine(case)
        want = case['final']
        problems = [f'{name}: playground {want[name]:02x}, py65 {getattr(mpu, name):02x}'
                    for name in ('a', 'x', 'y', 'sp', 'pc') if want[name] != getattr(mpu, name)]
        if (want['p'] & FLAGS) != (mpu.p & FLAGS):
            problems.append(f"P: playground {want['p'] & FLAGS:08b}, py65 {mpu.p & FLAGS:08b} (NV-BDIZC)")
        if case['cycles'] != mpu.processorCycles:
            problems.append(f"cycles: playground {case['cycles']}, py65 {mpu.processorCycles}")
        memory = [(a, b, mpu.memory[a]) for a, b in enumerate(case['memory']) if b != mpu.memory[a]]
        problems += [f'byte ${a:04x}: playground {b:02x}, py65 {c:02x}' for a, b, c in memory[:4]]
        if problems:
            listing = '\n      '.join(f'L{i}: {text}' for i, text in enumerate(case['program']))
            failures.append(f'case {number}:\n    ' + '\n    '.join(problems) + f'\n    program:\n      {listing}')
    return failures, skipped


def check_decimals(decimals):
    failures = []
    for case in decimals:
        mpu = machine(case)
        want = case['final']
        if want['a'] != mpu.a or (want['p'] & 1) != (mpu.p & 1):
            failures.append(f"{' ; '.join(case['program'])} with A={case['initial']['a']:02x} "
                            f"C={case['initial']['p'] & 1}: playground A={want['a']:02x} C={want['p'] & 1}, "
                            f"py65 A={mpu.a:02x} C={mpu.p & 1}")
    return failures


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    data = cases(seed)
    encoding_failures = check_encodings(data['encodings'])
    execution_failures, skipped = check_executions(data['executions'])
    decimal_failures = check_decimals(data['decimals'])
    instructions = sum(len(case['program']) for case in data['executions'] if not case['skip'])
    print(f"Seed {seed}: {len(data['encodings'])} encodings checked with py65's assembler; "
          f"{len(data['executions']) - skipped} programs ({instructions} instructions) run in its simulator "
          f"({skipped} skipped: they touched a device or the code); {len(data['decimals'])} BCD sums.")
    failures = encoding_failures + execution_failures + decimal_failures
    for failure in failures[:30]:
        print('FAIL', failure)
    print(f'{len(failures)} failures' if failures else 'All match.')
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
