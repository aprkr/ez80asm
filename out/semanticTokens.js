"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const completionProposer = require("./completion");
const wordregex = /(\b\w+\.?\w+\b)/g
const wordNumberRegex = /(\b\w+\.?\w+?\b)/g
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
            let nonCommentMatch = line.text.match(nonCommentRegex)
            const includeLineMatch = includeLineRegex.exec(line.text);
            const labelMatch = line.text.match(labelDefinitionRegex)
            if (labelMatch || line.text === "") {
                continue;
            }
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
            if (nonCommentMatch) {
                nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
                let checkLine = nonCommentMatch
                checkLine = checkLine.replace(/\'.+\'/g, "n");
                const opcode = checkLine.match(/^\s+(\w+)(\.\w*)?/i)
                checkLine = checkLine.trim();
                checkLine = checkLine.replace(numberRegex, "n");
                let invalid = true
                const firstOperand = checkLine.match(firstoperandregex) // the actual operand is firstOperand[1]
                if (checkLine.match(/db|dw|dl|ret|(\#.)/i)) { // ignoring these for now
                    invalid = false
                }
                if (opcode) {
                    if (opcode[2] && !opcode[2].match(suffixRegex)) {       // if the suffix isn't valid
                        const endChar = 1 + checkLine.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "bad suffix"));
                    }
                    if (!opcode[1].match(opcodeRegex)) {        // if the opcode isn't valid
                        const endChar = 1 + checkLine.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "bad opcode"));
                        continue;
                    } else if (opcode[1].match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
                        if (firstOperand) {
                            const endChar = 1 + opcode[1].length;
                            const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                            diagnosticsArray.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
                            continue;
                        }
                    }
                } else {
                    console.log()
                }
                checkLine = checkLine.replace(/\s+/, " ")
                checkLine = checkLine.replace(/\b(NZ|Z|NC|C)\b/i, "c")
                if (this.instructionItemsFull.indexOf(checkLine) != -1) {
                    invalid = false
                }
                // let invalidSymbol = false
                if (firstOperand) { // this should always be true
                    let operand1 = firstOperand[1];
                    const secondOperand = checkLine.match(secondoperandregex)
                    let operand2 = null
                    if (secondOperand) {
                        operand2 = secondOperand[1];
                    }
                    const wordNumber = checkLine.match(wordNumberRegex)
                    for (let i = 1; i < wordNumber.length; i++) {
                        if (symbols[Object.keys(symbols).find(key => key.toLowerCase() === wordNumber[i].toLowerCase())]) {
                            operand1 = operand1.replace(wordNumber[i], "n");
                            if (operand2) {
                                operand2 = operand2.replace(wordNumber[i], "n")
                            }
                        }
                    }
                    let valid = undefined
                    try {
                        valid = eval(operand1.replace(/n/g, 1))
                        let nopar2 = firstOperand[1].match(/(?<=\()(.*)(?=\))/)
                        if (!nopar2) {
                            nopar2 = [firstOperand[1]]
                        }
                        checkLine = checkLine.replace(nopar2[0], "valid")
                    } catch (err) {
                        // invalidSymbol = true
                    }
                    if (operand2) {
                        try {
                            valid = eval(operand2.replace(/n/g, 1))
                            let nopar2 = secondOperand[1].match(/(?<=\()(.*)(?=\))/)
                            if (!nopar2) {
                                nopar2 = [secondOperand[1]]
                            }
                            checkLine = checkLine.replace(nopar2[0], "valid")
                        } catch (err) {
                            // invalidSymbol = true
                        }
                    }
                    checkLine = checkLine.toLowerCase();
                    let test = checkLine.replace("valid", "mmn")
                    if (this.instructionItemsFull.indexOf(test) != -1) {
                        invalid = false
                    }
                    test = checkLine.replace("valid", "n")
                    if (this.instructionItemsFull.indexOf(test) != -1) {
                        invalid = false
                    }
                    if (invalid) {
                        const endChar = nonCommentMatch.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "duh"));
                    }
                }





                const wordmatch = nonCommentMatch.match(wordregex);
                if (wordmatch) {
                    let char = 0;
                    for (let index = 0; index < wordmatch.length; ++index) {
                        if (symbols[wordmatch[index]] && !wordmatch[index].includes("ld")) {
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
}

exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map