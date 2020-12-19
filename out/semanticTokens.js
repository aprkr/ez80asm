"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const completionProposer = require("./completion");
const wordregex = /(\b\w+(\.\w+)?(\.|\b))/g
const numberRegex = /((\$|0x)[0-9a-fA-F]+\b)|(\b[0-9a-fA-F]+h\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)/g
const firstoperandregex = /^\s*[\w\.]+\s+([^\,\r\n\f\v]+)/
const secondoperandregex = /^.*?,\s*(.*)/
const nonCommentRegex = /^([^;]+[^\,\r\n\t\f\v ;])/g
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const opcodeRegex = /\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL)\b/i;
const noOperandOpcodeRegex = /\b(DAA|NEG|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EXX|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|CCF|DI|EI|HALT|NOP|RSMIX|SCF|SLP|STMIX|RETI|RETN|RLA|RLCA|RRA|RRCA|RRD)\b/i;
const suffixRegex = /(\.)(LIL|LIS|SIL|SIS|L|S)\b/i;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;

class SymbolRef {
    constructor(name, location, lineNumber) {
        this.name = name;
        this.location = location;
        this.lineNumber = lineNumber;
    }
}
class ASMSemanticTokenProvider {
    constructor(symbolDocumenter, legend) {
        this.symbolDocumenter = symbolDocumenter;
        this.legend = legend
        this.ASMCompletionProposer = new completionProposer.ASMCompletionProposer
        this.instructionItemsFull = this.ASMCompletionProposer.instructionItemsNonForm
        this.collections = symbolDocumenter.collections
    }
    provideDocumentSemanticTokens(document, token) {
        let collection = this.collections[document.fileName]
        collection.clear()
        let diagnosticsArray = []
        const legend = this.legend
        const symbols = this.symbolDocumenter.symbols(document);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        const table = this.symbolDocumenter.files[document.fileName];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber);
            if (line.text === "") {
                continue;
            }
            const includeLineMatch = includeLineRegex.exec(line.text);
            if (includeLineMatch) {
                const filename = includeLineMatch[2];
                const fsRelativeDir = path.dirname(document.uri.fsPath);
                if (this.symbolDocumenter._resolveFilename(filename, fsRelativeDir) === "") {
                    const endChar = includeLineMatch[0].length;
                    const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                    diagnosticsArray.push(new vscode.Diagnostic(range, "File not found"));
                }
                continue;
            }
            let nonCommentMatch = line.text.match(nonCommentRegex)
            const labelMatch = line.text.match(labelDefinitionRegex)
            if (nonCommentMatch) {
                nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
                if (!labelMatch && vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                    let diagline = nonCommentMatch
                    diagline = diagline.replace(numberRegex, "number");
                    const diagwordmatch = diagline.match(wordregex);
                    let opcodeskip = false
                    let invalid = true
                    if (!diagline.match(/^\s*(\#|\.)/g)) {      // check the opcode
                        if (diagwordmatch[0].indexOf(".") != -1 && !diagwordmatch[0].match(suffixRegex)) {       // if the suffix isn't valid
                            const endChar = 1 + diagline.length;
                            const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                            diagnosticsArray.push(new vscode.Diagnostic(range, "bad suffix"));
                        } else if (diagwordmatch[0].indexOf(".") != -1) {
                            diagline = diagline.replace(/\.\w+/, "")
                        }
                        if (!diagwordmatch[0].match(opcodeRegex)) {        // if the opcode isn't valid
                            const endChar = 1 + diagline.length;
                            const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                            diagnosticsArray.push(new vscode.Diagnostic(range, "bad opcode"));
                            continue;
                        } else if (diagwordmatch[0].match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
                            if (diagwordmatch.length > 1) {
                                const endChar = 1 + diagline.length;
                                const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                                diagnosticsArray.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
                                continue;
                            } else {
                                opcodeskip = true
                            }
                        }
                    } else {
                        opcodeskip = true
                    }
                    if (!opcodeskip) {
                        for (let i = 1; i < diagwordmatch.length; i++) {    // replace all the symbols with "number"
                            if (symbols[Object.keys(symbols).find(key => key.toLowerCase() === diagwordmatch[i].toLowerCase())]) {
                                diagline = diagline.replace(diagwordmatch[i], "number")
                            }
                        }
                        diagline = this.formatLine(diagline);
                        let operands = this.getOperands(diagline);
                        diagline = this.evalOperands(diagline, operands)
                        invalid = this.testLine(diagline)
                        if (invalid) {
                            const endChar = 1 + diagline.length;
                            const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                            diagnosticsArray.push(new vscode.Diagnostic(range, "Bad operands"));
                        }
                    }
                }
                const wordmatch = nonCommentMatch.match(wordregex);
                if (wordmatch) {
                    let char = 0;
                    for (let index = 0; index < wordmatch.length; ++index) {
                        if (symbols[wordmatch[index]]) {
                            const startChar = nonCommentMatch.indexOf(wordmatch[index], char);
                            const endChar = startChar + wordmatch[index].length
                            const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
                            const location = new vscode.Location(document.uri, range);
                            const symbolRef = new SymbolRef(wordmatch[index], location, lineNumber);
                            table.referencedSymbols.push(symbolRef);
                            if (symbols[wordmatch[index]].kind == vscode.SymbolKind.Method) {
                                tokensBuilder.push(range, 'function');
                            } else if (symbols[wordmatch[index]].kind == vscode.SymbolKind.Variable) {
                                tokensBuilder.push(range, 'variable');
                            } else if (symbols[wordmatch[index]].kind == vscode.SymbolKind.Function) {
                                tokensBuilder.push(range, 'label');
                            }
                        }
                        char += wordmatch[index].length;
                    }
                }
            }
        }
        collection.set(document.uri, diagnosticsArray)
        return tokensBuilder.build();
    }
    formatLine(line) {
        line = line.toLowerCase();
        line = line.trim()
        line = line.replace(/\s+/g, " ")
        line = line.replace(/\'.+\'/, "number")
        line = line.replace(/(ix|iy)\s*(\+|\-)\s*number/gi, "ix")
        line = line.replace(/\s+,/g, ",")
        return line
    }
    getOperands(line) {
        let operands = []
        let operand = line.match(firstoperandregex)
        if (operand) {
            operands.push(operand[1])
        }
        operand = line.match(secondoperandregex)
        if (operand) {
            operands.push(operand[1])
        }
        return operands
    }
    testLine(line) {
        if (this.instructionItemsFull.indexOf(line) != -1) {
            return false
        }
        let test = line.replace(/\bvalid\b/g, "mmn")
        if (this.instructionItemsFull.indexOf(test) != -1) {
            return false
        }
        test = line.replace(/\bvalid\b/g, "n")
        if (this.instructionItemsFull.indexOf(test) != -1) {
            return false
        }
        test = line.replace(/\bvalid\b/g, "bit")
        if (this.instructionItemsFull.indexOf(test) != -1) {
            return false
        }
        return true
    }
    evalOperands(line, operands) {
        for (let i = 0; i < operands.length; i++) {
            try {
                let valid = eval(operands[i].replace(/number/g, 1))
                let withoutParen = operands[i].match(/(?<=^\()(.*)(?=\)$)/)
                if (!withoutParen) {
                    withoutParen = [operands[i]]
                }
                let regex = new RegExp(withoutParen[0], "g")
                line = line.replace(withoutParen[0], "valid")
            } catch (err) {
            }
        }
        return line
    }
}

exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map