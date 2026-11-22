"""Checks the RISC-V core against two independent tools.

- Capstone disassembles every encoded word: it must be the same instruction with the same operands.
- Unicorn runs random programs from their encoded bytes on a real RV32IM core: registers, PC and
  memory must end up exactly as the playground left them.

Needs `pip install capstone unicorn`. Usage: python scripts/verify/verify-rv32.py [seed]
"""

import json
import re
import struct
import subprocess
import sys

import capstone
from unicorn import UC_ARCH_RISCV, UC_MODE_RISCV32, Uc, UcError
from unicorn import riscv_const as rv

ABI = ('zero ra sp gp tp t0 t1 t2 s0 s1 a0 a1 a2 a3 a4 a5 a6 a7 '
       's2 s3 s4 s5 s6 s7 s8 s9 s10 s11 t3 t4 t5 t6').split()
RAM_SIZE = 0x100000


def cases(seed):
    output = subprocess.run(
        f'npx vite-node scripts/verify/rv32Cases.ts {seed}',
        shell=True, check=True, capture_output=True, text=True, encoding='utf-8'
    ).stdout
    return json.loads(output)


def tokens(text):
    """Operands as comparable values: register names, and numbers whatever base they are written in."""
    out = []
    for token in re.split(r'[,\s()]+', text.strip()):
        if not token:
            continue
        if token in ABI or token == 'fp':
            out.append('s0' if token == 'fp' else token)
        elif re.fullmatch(r'L\d+', token):
            out.append(token)  # a line label: the caller puts the distance in its place
        else:
            out.append(int(token, 0))
    return out


def check_encodings(encodings):
    md = capstone.Cs(capstone.CS_ARCH_RISCV, capstone.CS_MODE_RISCV32)
    failures, aliased = [], 0
    for case in encodings:
        found = list(md.disasm(struct.pack('<I', case['word']), 0))
        if len(found) != 1:
            failures.append(f"{case['text']}: Capstone cannot decode {case['word']:08x}")
            continue
        insn = found[0]
        if insn.insn_name() != case['mnemonic']:
            failures.append(f"{case['text']}: {case['word']:08x} is {insn.insn_name()} to Capstone")
            continue
        if insn.mnemonic != case['mnemonic']:
            aliased += 1  # printed as an alias (li, mv, ret, beqz, ...): the instruction itself matched
            continue
        ours = tokens(case['text'].split(' ', 1)[1] if ' ' in case['text'] else '')
        theirs = tokens(insn.op_str)
        if case['mnemonic'] == 'jalr':
            ours = [ours[0], ours[2], ours[1]]  # Capstone writes `jalr rd, rs1, imm`, not `imm(rs1)`
            if len(theirs) == 1:
                theirs = ['ra', theirs[0], 0]  # `jalr rs`: Capstone leaves out ra and a zero offset
        if case['mnemonic'] == 'jal' and len(theirs) == 1:
            theirs = ['ra'] + theirs  # Capstone leaves out ra, the usual link register
        if case['distance'] is not None:
            ours[-1] = case['distance']  # Capstone prints the branch distance, the playground the line
        if ours != theirs:
            failures.append(f"{case['text']}: {case['word']:08x} is '{insn.mnemonic} {insn.op_str}' to Capstone")
    return failures, aliased


def run_unicorn(case):
    uc = Uc(UC_ARCH_RISCV, UC_MODE_RISCV32)
    uc.mem_map(0, RAM_SIZE)
    code = b''.join(struct.pack('<I', word) for word in case['words'])
    uc.mem_write(0, code)
    for i in range(1, 32):
        uc.reg_write(rv.UC_RISCV_REG_X0 + i, case['initial'][i])
    end = len(code)
    if end:
        # The programs only jump forward, so each line runs at most once. A wrongly encoded jump
        # can loop forever; the count stops it, and the PC it stopped at shows up as a mismatch.
        uc.emu_start(0, end, count=len(case['words']) + 1)
    registers = [uc.reg_read(rv.UC_RISCV_REG_X0 + i) & 0xffffffff for i in range(32)]
    window = case['window']
    memory = list(uc.mem_read(window['start'], len(window['bytes'])))
    return registers, uc.reg_read(rv.UC_RISCV_REG_PC), memory


def check_executions(executions):
    failures = []
    for number, case in enumerate(executions):
        if case['error']:
            failures.append(f"case {number}: the playground stopped with: {case['error']}")
            continue
        try:
            registers, pc, memory = run_unicorn(case)
        except UcError as error:
            failures.append(f'case {number}: Unicorn failed: {error}')
            continue
        problems = [f'x{i} ({ABI[i]}): playground {case["final"][i]:08x}, Unicorn {registers[i]:08x}'
                    for i in range(32) if registers[i] != case['final'][i]]
        if pc != case['pc']:
            problems.append(f'pc: playground {case["pc"]:08x}, Unicorn {pc:08x}')
        start = case['window']['start']
        problems += [f'byte at {start + i:08x}: playground {a:02x}, Unicorn {b:02x}'
                     for i, (a, b) in enumerate(zip(case['window']['bytes'], memory)) if a != b][:4]
        if problems:
            listing = '\n      '.join(f'L{i}: {text}' for i, text in enumerate(case['program']))
            failures.append(f'case {number}:\n    ' + '\n    '.join(problems) + f'\n    program:\n      {listing}')
    return failures


def main():
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    data = cases(seed)
    encoding_failures, aliased = check_encodings(data['encodings'])
    execution_failures = check_executions(data['executions'])
    instructions = sum(len(case['program']) for case in data['executions'])
    print(f"Seed {seed}: {len(data['encodings'])} encodings checked with Capstone "
          f"({aliased} of them printed as aliases, checked by instruction only); "
          f"{len(data['executions'])} programs ({instructions} instructions) run in Unicorn.")
    for failure in (encoding_failures + execution_failures)[:30]:
        print('FAIL', failure)
    failed = len(encoding_failures) + len(execution_failures)
    print(f'{failed} failures' if failed else 'All match.')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
