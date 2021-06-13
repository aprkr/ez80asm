const commentLineRegex = /^\s*;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const labelRegex = /^\w[\.\w]*/
const numberRegex = /((\$|0x)[0-9a-fA-F]+\b)|(\b[0-9a-fA-F]+h\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)/g


const ez80 =  {
      includeLineRegex: /^\s*\#?include\s*"([^"]+)"/i,
      equateRegex: /^[\w\.]+(?=[\s\.]+equ\s+.+$)/i,
      commentLineRegex: commentLineRegex,
      endCommentRegex: endCommentRegex,
      labelRegex: labelRegex,
      opcodeRegex: /\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL)\b/gi,
      conditionalRegex: /\b(Z|NZ|C|NC|P|M|PO|PE)\b/gi,
      registerRegex: /\b(A|B|C|D|E|F|H|L|I|R|IX|IY|IXH|IXL|IYH|IYL|AF|BC|DE|HL|PC|SP|AF'|MB)\b/gi,
      numberRegex: numberRegex,
      nonRefRegex: /adl/i
}
const z80 = {
      includeLineRegex: ez80.includeLineRegex,
      equateRegex: ez80.equateRegex,
      commentLineRegex: commentLineRegex,
      endCommentRegex: endCommentRegex,
      labelRegex: ez80.labelRegex
}
const gbz80 = {
      includeLineRegex: ez80.includeLineRegex,
      equateRegex: ez80.equateRegex,
      commentLineRegex: commentLineRegex,
      endCommentRegex: endCommentRegex,
      labelRegex: labelRegex
}
exports.ez80 = ez80
exports.z80 = z80
exports.gbz80 = gbz80