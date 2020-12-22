'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const semantics = require("./semanticTokens")
const path = require("path");
const fs = require("fs");
const commentLineRegex = /^;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\s*\#?(include)[\W]+"([^"]+)".*$/i;
const FILE_NAME = 2;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;
const equateRegex = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|equs|set|EQU)[\W]+.*$/i;
const completionProposer = require("./completion");
const wordregex = /([\w\.]+(\.\w+)?(\.|\b))/g
const numberRegex = /((\$|0x)[0-9a-fA-F]+\b)|(\b[0-9a-fA-F]+h\b)|(%[01]+\b)|(\b[01]+b\b)|(\b[0-9]+d?\b)/g
const firstoperandregex = /^\s*[\w\.]+\s+([^\,\r\n\f\v]+)/
const secondoperandregex = /^.*?,\s*(.*)/
const nonCommentRegex = /^([^;]+[^\,\r\n\t\f\v ;])/g
const opcodeRegex = /\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL)\b/i;
const noOperandOpcodeRegex = /\b(DAA|NEG|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EXX|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|CCF|DI|EI|HALT|NOP|RSMIX|SCF|SLP|STMIX|RETI|RETN|RLA|RLCA|RRA|RRCA|RRD)\b/i;
const suffixRegex = /(\.)(LIL|LIS|SIL|SIS|L|S)\b/i;

// class ScopeDescriptor {
//     constructor(start, end) {
//         this.start = start;
//         this.end = end;
//     }
// }
class SymbolDescriptor {
    constructor(lineNumber, kind, documentation, uri) {
        this.lineNumber = lineNumber;
        // this.isExported = isExported;
        // this.isLocal = isLocal;
        this.kind = kind;
        // this.scope = scope;
        this.documentation = documentation;
        this.uri = uri
    }
}
class FileTable {
    constructor(fsPath, lineCount) {
        this.includedFiles = [];
        this.includeFileLines = [];
        this.fsDir = path.dirname(fsPath);
        this.fsPath = fsPath;
        this.symbols = {};
        // this.referencedSymbols = [];
        this.lineCount = lineCount;
        // this.scopes = [];
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
    }
}
var SearchMode;
(function (SearchMode) {
    SearchMode[SearchMode["globals"] = 0] = "globals";
    SearchMode[SearchMode["includes"] = 1] = "includes";
    SearchMode[SearchMode["parents"] = 2] = "parents";
})(SearchMode || (SearchMode = {}));
/**
 * This one does a lot, initially scans the document for symbols,
 * has a method (symbols()) to find available symbols
 * also contains the method for line diagnostics
 */
class ASMSymbolDocumenter {
    constructor() {
        this.files = {};
        this.ASMCompletionProposer = new completionProposer.ASMCompletionProposer
        this.instructionItemsFull = this.ASMCompletionProposer.instructionItemsFull
        vscode.workspace.findFiles("**/*{Main,main}.{ez80,z80,asm}", null, 1).then((files) => {
            files.forEach((fileURI) => {
                vscode.workspace.openTextDocument(fileURI).then((document) => {
                    this.document(document);
                });
            });
        });
        // vscode.workspace.findFiles("**/*.{ez80,z80,inc,asm}", null, 1).then((files) => {
        //     files.forEach((fileURI) => {
        //         vscode.workspace.openTextDocument(fileURI).then((document) => {
        //             this.document(document);
        //         });
        //     });
        // });
        // var documenttimeout = 0; // taken care of in semanticTokens.js
        // vscode.workspace.onDidChangeTextDocument((event) => {
        //     if (event.document.fileName.match(/(ez80|z80|inc|asm)$/)) {
        //         clearTimeout(documenttimeout)
        //         documenttimeout = setTimeout(() => { this.document(event.document, event) }, 100);
        //     }
        // });
        // vscode.window.onDidChangeVisibleTextEditors((event) => {
        //     for (let i = 0; i < event.length; ++i) {
        //         if (event[i].document.fileName.match(/(ez80|z80|inc|asm)$/)) {
        //             this.document(event[i].document);
        //         }
        //     }
        // });
    }
    _resolveFilename(filename, fsRelativeDir) {
        // Try just sticking the filename onto the directory.
        let simpleJoin = path.resolve(fsRelativeDir, filename);
        if (fs.existsSync(simpleJoin)) {
            let includeUri = vscode.Uri.file(simpleJoin);
            const table = this.files[includeUri.fsPath]; // this.files is very picky
            if (table == undefined) {
                vscode.workspace.openTextDocument(includeUri).then((document) => {
                    this.document(document);
                });
            }
            return simpleJoin;
        }
        // Grab the configured include paths. If it's a string, make it an array.
        var includePathConfiguration = vscode.workspace.getConfiguration().get("ez80-asm.includePath");
        if (typeof includePathConfiguration === "string") {
            includePathConfiguration = [includePathConfiguration];
        }
        // For each configured include path
        for (var i = 0; i < includePathConfiguration.length; i++) {
            var includePath = includePathConfiguration[i];
            // If the path is relative, make it absolute starting from workspace root.
            if (path.isAbsolute(includePath) == false) {
                if (vscode.workspace.workspaceFolders !== undefined) {
                    includePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, includePath);
                }
            }
            // Test for existence of the filename glued onto the include path.
            var joined = path.resolve(includePath, filename);
            if (fs.existsSync(joined)) {
                let includeUri = vscode.Uri.file(joined);
                const table = this.files[includeUri.fsPath]; // this.files is very picky
                if (table == undefined) {
                    vscode.workspace.openTextDocument(includeUri).then((document) => {
                        this.document(document);
                    });
                }
                return joined;
            }
        }
        // Nothing found, return the empty string.
        return "";
    }
    /**
     * Seeks files that include `fsPath` for symbols.
     * @param fsPath The file to seek above.
     * @param fsRelativeDir The directory of the originating context.
     * @param output The collection of discovered symbols.
     * @param searched Paths of files that have already been searched.
     */
    _seekSymbolsUp(fsPath, output, searched) {
        for (const globalFilePath in this.files) {
            if (this.files.hasOwnProperty(globalFilePath)) {
                if (searched.indexOf(globalFilePath) != -1) {
                    continue;
                }
                const table = this.files[globalFilePath];
                if (table == undefined) {
                    return;
                }
                const globalName = path.basename(globalFilePath);
                const globalFileDirname = path.dirname(globalFilePath);
                for (var i = 0; i < table.includedFiles.length; i++) {
                    const resolvedIncluded = this._resolveFilename(table.includedFiles[i], globalFileDirname);
                    if (resolvedIncluded) {
                        this._seekSymbols(globalName, globalFileDirname, output, searched, SearchMode.includes);
                        this._seekSymbols(globalName, globalFileDirname, output, searched, SearchMode.parents);
                        break;
                    }
                }
            }
        }
    }
    /**
     * Seeks symbols for use by Intellisense in `filename`.
     * @param filename The name of the file to seek in.
     * @param fsRelativeDir The directory of the originating context.
     * @param output The collection of discovered symbols.
     * @param searched Paths of files that have already been searched.
     * @param mode What sort of files and symbols to seek through.
     */
    _seekSymbols(filename, fsRelativeDir, output, searched, mode) {
        const fsPath = this._resolveFilename(filename, fsRelativeDir);
        const table = this.files[fsPath];
        if (table == undefined) {
            return;
        }
        searched.push(fsPath);
        for (const name in table.symbols) {
            if (table.symbols.hasOwnProperty(name)) {
                const symbol = table.symbols[name];
                if (!(name in output)) {
                    output[name] = symbol;
                }
            }
        }
        if (mode == SearchMode.includes) {
            table.includedFiles.forEach((includeFilename) => {
                const includedFSPath = this._resolveFilename(includeFilename, fsRelativeDir);
                if (searched.indexOf(includedFSPath) == -1) {
                    searched.push(includedFSPath);
                    this._seekSymbols(includeFilename, fsRelativeDir, output, searched, SearchMode.includes);
                }
            });
        }
        if (mode == SearchMode.parents) {
            this._seekSymbolsUp(fsPath, output, searched);
        }
    }
    /**
     * Returns a set of symbols possibly within scope of `context`.
     * @param context The document to find symbols for.
     */
    symbols(context) {
        const output = {};
        // First, find all exported symbols in the entire workspace
        for (const filename in this.files) {
            if (this.files.hasOwnProperty(filename)) {
                const globalFileBasename = path.basename(filename);
                const globalFileDirname = path.dirname(filename);
                this._seekSymbols(globalFileBasename, globalFileDirname, output, [], SearchMode.globals);
            }
        }
        const contextFileBasename = path.basename(context.uri.fsPath);
        const contextFileDirname = path.dirname(context.uri.fsPath);
        // Next, grab all symbols for this file and included files
        const searchedIncludes = [];
        this._seekSymbols(contextFileBasename, contextFileDirname, output, searchedIncludes, SearchMode.includes);
        // Finally, grab files that include this file
        this._seekSymbols(contextFileBasename, contextFileDirname, output, searchedIncludes, SearchMode.parents);
        return output;
    }
    /**
     * Returns a `SymbolDescriptor` for the symbol having `name`, or `undefined`
     * if no such symbol exists.
     * @param name The name of the symbol.
     * @param searchContext The document to find the symbol in.
     */
    symbol(name, searchContext) {
        return this.symbols(searchContext)[name];
    }
    /**
     * 
     * @param {*} document the document to create symbols for
     * @param {*} event if used, will restrict the documenting to a certain range to speed things up
     */
    document(document, event) {
        let table = new FileTable(document.uri.fsPath, 0);
        let startLine = 0;
        let endLine = document.lineCount;
        if (event && event.document === document && event.contentChanges) {
            table = this.files[document.uri.fsPath];
            startLine = event.contentChanges[0].range.start.line
            endLine = Math.min(startLine + 2, document.lineCount - 1)
            while (commentLineRegex.exec(document.lineAt(endLine).text) && endLine < document.lineCount) {
                endLine++
            }
            endLine++
            if (table.lineCount != document.lineCount) {
                if (table.lineCount < document.lineCount) {
                    for (var symName in table.symbols) {
                        if (table.symbols[symName].lineNumber > startLine) {
                            table.symbols[symName].lineNumber += document.lineCount - table.lineCount
                        }
                    }
                }
            }
            for (var symName in table.symbols) {
                let symLine = table.symbols[symName].lineNumber
                if (symLine >= startLine && symLine < endLine) {
                    delete table.symbols[symName];
                }
            }
        } else {
            table.lineCount = document.lineCount
        }
        this.files[document.uri.fsPath] = table;
        for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
            const line = document.lineAt(lineNumber);
            if (line.text === "") {
                continue;
            }
            const commentLineMatch = commentLineRegex.exec(line.text);
            if (commentLineMatch) {
                continue;
            }
            const includeLineMatch = includeLineRegex.exec(line.text);
            const labelMatch = labelDefinitionRegex.exec(line.text);
            if (includeLineMatch) {
                const filename = includeLineMatch[FILE_NAME]; 
                let includeLineIndex = table.includeFileLines.indexOf(lineNumber)   
                if (includeLineIndex != -1) {
                    table.includeFileLines.splice(includeLineIndex)
                    table.includedFiles.splice(includeLineIndex, 1)
                }   
                const fsRelativeDir = path.dirname(document.uri.fsPath);
                this._resolveFilename(filename, fsRelativeDir); // this also documents any included files
                if (table.includedFiles.indexOf(filename) == -1) {
                    table.includedFiles.push(filename);
                    table.includeFileLines.push(lineNumber)
                }
            } else if (labelMatch) {
                const declaration = labelMatch[1];
                let kind = undefined;
                if (declaration.indexOf(":") != -1) {
                    kind = vscode.SymbolKind.Method;
                } else if (equateRegex.test(line.text)) {
                    kind = vscode.SymbolKind.Variable
                }
                const name = declaration.replace(/:+/, "");
                let documentation = this.getDocumentation(document, lineNumber, kind);
                table.symbols[name] = new SymbolDescriptor(lineNumber, kind == undefined ? vscode.SymbolKind.Function : kind, documentation, document.uri);
            }
        }
    }
    getLineDiagnostics(text, lineNumber, symbols, document) {
        let diagnosticsArray = []
        if (text === "") {
            return;
        }
        const includeLineMatch = includeLineRegex.exec(text);
        let nonCommentMatch = text.match(nonCommentRegex)
        const labelMatch = text.match(labelDefinitionRegex)
        if (nonCommentMatch) {
            nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
            if (!labelMatch && vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
                if (includeLineMatch) {
                    const filename = includeLineMatch[2];
                    const fsRelativeDir = path.dirname(document.uri.fsPath);
                    if (this._resolveFilename(filename, fsRelativeDir) === "") {
                        const endChar = includeLineMatch[0].length;
                        const range = new vscode.Range(lineNumber, 0, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "File not found"));
                    }
                    return diagnosticsArray;
                }
                let diagline = nonCommentMatch
                diagline = diagline.replace(numberRegex, "number");
                if (diagline.match(/b_call\((?=.+)/i)) {
                    diagline = diagline.replace(/b_call\((?=.+)/i, "call ")
                    if (diagline.endsWith(")")) {
                        diagline = diagline.subString(0, diagline.length - 1)
                    }
                }
                const diagwordmatch = diagline.match(wordregex);
                let opcodeskip = false
                let invalid = true
                if (!diagline.match(/^\s*(\#|\.|db|dw|dl)/gi)) {      // check the opcode
                    if (diagwordmatch[0].indexOf(".") != -1 && !diagwordmatch[0].match(suffixRegex)) {       // if the suffix isn't valid
                        const endChar = 1 + diagline.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "Bad suffix"));
                    } else if (diagwordmatch[0].indexOf(".") != -1) {
                        diagline = diagline.replace(/\.\w+/, "")
                    }
                    if (!diagwordmatch[0].match(opcodeRegex)) {        // if the opcode isn't valid
                        const endChar = 1 + diagline.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, "Bad opcode"));
                        return diagnosticsArray;
                    } else if (diagwordmatch[0].match(noOperandOpcodeRegex)) { // if the opcode doesn't use an operand
                        if (diagwordmatch.length > 1) {
                            const endChar = 1 + diagline.length;
                            const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                            diagnosticsArray.push(new vscode.Diagnostic(range, "No operand needed for this opcode"));
                            return diagnosticsArray;
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
        }
        return diagnosticsArray
    }
    formatLine(line) {
        line = line.toLowerCase();
        line = line.trim()
        line = line.replace(/\s+/g, " ")
        line = line.replace(/\'.+\'/, "number")
        line = line.replace(/(ix|iy)\s*(\+|-|\/|\*)\s*/gi, "ix+")
        line = line.replace(/\s*,\s*/g, ", ")
        line = line.replace(/\[/g, "(")
        line = line.replace(/\]/g, ")")
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
        line = line.replace(/(ix|iy)\+valid/gi, "ix+d")
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
                eval(operands[i].replace(/(number|((ix|iy)(?=\+)))/gi, 1))
                let withoutParen = operands[i].match(/(?<=^\()(.*)(?=\)$)/)
                if (!withoutParen) {
                    withoutParen = [operands[i]]
                }
                withoutParen[0] = withoutParen[0].replace(/(ix|iy)\+/i, "")
                line = line.replace(withoutParen[0], "valid")
            } catch (err) {
            }
        }
        return line
    }
    getDocumentation(document, lineNumber, kind) {
        if (lineNumber == 0) {
            return undefined
        }
        let line = document.lineAt(lineNumber);
        let documentation = undefined;
        let commentBuffer = [];
        const endCommentMatch = endCommentRegex.exec(line.text);
        if (endCommentMatch) {
            commentBuffer.push(endCommentMatch[1]);
        }
        const trimmed = line.text.replace(/[\s]+/, " ");
        const withoutComment = trimmed.replace(/;.*$/, "");
        lineNumber--
        line = document.lineAt(lineNumber);
        let commentLineMatch = commentLineRegex.exec(line.text);
        while (commentLineMatch && commentLineMatch[1] && lineNumber >= 0) {
            commentBuffer.unshift(commentLineMatch[1]);
            lineNumber--
            if (lineNumber >= 0) {
                line = document.lineAt(lineNumber);
                commentLineMatch = commentLineRegex.exec(line.text);
            }
        }
        if (kind == vscode.SymbolKind.Variable) {
            commentBuffer.unshift(withoutComment)
            documentation = commentBuffer.join("\n")
        } else if (commentBuffer.length > 0) {
            documentation = commentBuffer.join("\n\r");
        }
        return documentation;
    }
}
exports.ASMSymbolDocumenter = ASMSymbolDocumenter;
//# sourceMappingURL=symbolDocumenter.js.map