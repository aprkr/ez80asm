'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const commentLineRegex = /^;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\#?include[\W]+"([^"]+)".*$/i;
const spacerRegex = /^\s*(.)\1{3,}\s*$/;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;
const defineExpressionRegex = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|equs|set|EQU)[\W]+.*$/i;
const completionProposer = require("./completion");
const wordregex = /\b\S+(\.\w+)?(\s?[\+|\-|\*|\/]\s?\S+)?\b/g
const wordregex2 = /(^(\S+)\s(\S+))\b(\)?\s?,\s?(.+))?/
const commentregex = /.+?;/g
const offsetregex = /(\s?[\+|\-|\*|\/]\s?\S+)(.+)?/
// class ScopeDescriptor {
//     constructor(start, end) {
//         this.start = start;
//         this.end = end;
//     }
// }
class SymbolDescriptor {
    constructor(location, kind, documentation) {
        this.location = location;
        // this.isExported = isExported;
        // this.isLocal = isLocal;
        this.kind = kind;
        // this.scope = scope;
        this.documentation = documentation;
    }
}
class FileTable {
    constructor(fsPath) {
        this.includedFiles = [];
        this.fsDir = path.dirname(fsPath);
        this.fsPath = fsPath;
        this.symbols = {};
        this.scopes = [];
    }
}
var SearchMode;
(function (SearchMode) {
    SearchMode[SearchMode["globals"] = 0] = "globals";
    SearchMode[SearchMode["includes"] = 1] = "includes";
    SearchMode[SearchMode["parents"] = 2] = "parents";
})(SearchMode || (SearchMode = {}));
class ASMSymbolDocumenter {
    constructor() {
        this.files = {};
        this.ASMCompletionProposer = new completionProposer.ASMCompletionProposer
        this.instructionItemsFull = this.ASMCompletionProposer.instructionItemsFull
        this.collections = {}
        vscode.workspace.findFiles("**/*.{ez80,z80,inc,asm}", null, 5).then((files) => {
            files.forEach((fileURI) => {
                vscode.workspace.openTextDocument(fileURI).then((document) => {
                    this._document(document);
                });
            });
        });
        vscode.workspace.onDidChangeTextDocument((event) => {
            this._document(event.document, event);
            this.getDiagnostics(event.document)
                });
        vscode.window.onDidChangeVisibleTextEditors((event) => {
            for (let i = 0; i < event.length; ++i) {
                if (event[i].document.fileName.match(/(ez80|z80|asm)$/)) {
                    setTimeout(() => { this.getDiagnostics(event[i].document) }, 100);
                }
            }
        });
        const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ez80,z80,inc,asm}");
        watcher.onDidChange((uri) => {
            vscode.workspace.openTextDocument(uri).then((document) => {
                this._document(document);
            });
        });
        watcher.onDidCreate((uri) => {
            vscode.workspace.openTextDocument(uri).then((document) => {
                this._document(document);
            });
        });
        watcher.onDidDelete((uri) => {
            delete this.files[uri.fsPath];
        });
        if (vscode.window.activeTextEditor) {
            let startingDoc = vscode.window.activeTextEditor.document
            if (startingDoc.fileName.match(/ez80|z80|asm/)) {
                setTimeout(() => { this.getDiagnostics(startingDoc) }, 1000);
            }
        }
    }
    _resolveFilename(filename, fsRelativeDir) {
        // Try just sticking the filename onto the directory.
        let simpleJoin = path.resolve(fsRelativeDir, filename);
        if (fs.existsSync(simpleJoin)) {
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
                        this._document(document);
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
    _pushDocumentationLine(line, buffer) {
        if ((line.indexOf("@") == 0 || vscode.workspace.getConfiguration().get("ez80-asm.includeAllDocCommentNewlines")) && buffer.length > 0) {
            let lastLine = buffer[buffer.length - 1];
            if (lastLine.lastIndexOf("  ") != lastLine.length - 2) {
                buffer[buffer.length - 1] = lastLine + "  ";
            }
        }
        buffer.push(line);
    }
    _document(document, event) {
        if (!this.collections[document.fileName]) {
            this.collections[document.fileName] = vscode.languages.createDiagnosticCollection();
        }
        let table = new FileTable(document.uri.fsPath);
        // let currentScope = undefined;
        let commentBuffer = [];
        let startLine = 0
        let endLine = document.lineCount
        if (event && event.document === document) {
            let lines = 1
            startLine = event.contentChanges[0].range.start.line - 2
            lines = (event.contentChanges[0].text.match(/\n/g) || []).length + 2
            endLine = Math.min(event.contentChanges[0].range.end.line + lines, document.lineCount)
            table = this.files[document.uri.fsPath];
        }
        this.files[document.uri.fsPath] = table;
        if (event) {
            let inter = event.contentChanges[0].range
            for (var symName in table.symbols) {
                let symrange = table.symbols[symName].location.range
                if (inter.intersection(symrange)) {
                    delete table.symbols[symName];
                }
            }
        }
        for (let lineNumber = startLine; lineNumber < endLine; lineNumber++) {
            const line = document.lineAt(lineNumber);
            const commentLineMatch = commentLineRegex.exec(line.text);
            if (commentLineMatch) {
                const baseLine = commentLineMatch[1];
                if (spacerRegex.test(baseLine)) {
                    continue;
                }
                this._pushDocumentationLine(baseLine, commentBuffer);
            }
            else {
                const includeLineMatch = includeLineRegex.exec(line.text);
                const labelMatch = labelDefinitionRegex.exec(line.text);
                if (includeLineMatch) {
                    const filename = includeLineMatch[1];
                    table.includedFiles.push(filename);
                    const fsRelativeDir = path.dirname(document.uri.fsPath);
                    this._resolveFilename(filename, fsRelativeDir); // this actually documents any included files, pretty cool
                    // let fileURI = new vscode.Uri("file", "", includedFSPath, "", "");
                    // vscode.workspace.openTextDocument(fileURI).then((incdocument) => {
                    //     if (!this.files[incdocument.uri.fsPath]) {
                    //         this._document(incdocument);
                    //     }
                    // });
                }
                else if (labelMatch) {
                    const declaration = labelMatch[1];
                    // if (instructionRegex.test(declaration)) {
                    // continue;
                    // }
                    // if (keywordRegex.test(declaration)) {
                    // continue;
                    // }
                    // if (declaration.indexOf(".") == -1) {
                    //     if (currentScope) {
                    //         currentScope.end = document.positionAt(document.offsetAt(line.range.start) - 1);
                    //     }
                    //     currentScope = new ScopeDescriptor(line.range.start);
                    //     table.scopes.push(currentScope);
                    // }
                    let kind = undefined;
                    // const isFunction = declaration.indexOf(":") != -1;
                    if (declaration.indexOf(":") != -1) {
                        kind = vscode.SymbolKind.Method;
                    }
                    const name = declaration.replace(/:+/, "");
                    const endChar = line.range.start.character + name.length;
                    const endposition = new vscode.Position(lineNumber, endChar);
                    const declarationrange = new vscode.Range(line.range.start, endposition)
                    const location = new vscode.Location(document.uri, declarationrange);
                    // const isExported = declaration.indexOf("::") != -1;
                    // const isLocal = declaration.indexOf(".") != -1;
                    let documentation = undefined;
                    const endCommentMatch = endCommentRegex.exec(line.text);
                    if (endCommentMatch) {
                        this._pushDocumentationLine(endCommentMatch[1], commentBuffer);
                    }
                    if (defineExpressionRegex.test(line.text)) {
                        const trimmed = line.text.replace(/[\s]+/, " ");
                        const withoutComment = trimmed.replace(/;.*$/, "");
                        commentBuffer.splice(0, 0, `${withoutComment}`);
                        kind = vscode.SymbolKind.Variable
                    }
                    if (commentBuffer.length > 0) {
                        documentation = commentBuffer.join("\n");
                    }
                    table.symbols[name] = new SymbolDescriptor(location, kind == undefined ? vscode.SymbolKind.Function : kind, documentation);
                    table.symbols[name].lowercase = name.toLowerCase();
                    // this.lowercase.symbols[name.toLowerCase()] = new SymbolDescriptor(location, kind == undefined ? vscode.SymbolKind.Function : kind, documentation);
                }
                commentBuffer = [];
            }

        }
        // if (currentScope) {
        // currentScope.end = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
        // }
    }
    getDiagnostics(document) {
        let collection = this.collections[document.fileName]
        collection.clear()
        let diagnosticsArray = []
        if (!vscode.workspace.getConfiguration().get("ez80-asm.diagnosticProvider")) {
            return
        }
        const symbols = this.symbols(document);
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const invalidOperands = "Invalid Operands"
            const unknownOpcode = "Unknown Opcode"
            let errorCode = invalidOperands
            const line = document.lineAt(lineNumber);
            const commentLineMatch = commentLineRegex.exec(line.text);
            const includeLineMatch = includeLineRegex.exec(line.text);
            const labelMatch = labelDefinitionRegex.exec(line.text);
            if (commentLineMatch || includeLineMatch || labelMatch) {
                continue
            } else {
                let nonCommentMatch = line.text.match(commentregex);
                if (nonCommentMatch != null || (!line.text.includes(";") && line.text.length > 0)) {
                    if (nonCommentMatch) {
                        nonCommentMatch = nonCommentMatch[0].replace(";", "");
                    } else {
                        nonCommentMatch = line.text
                    }
                    nonCommentMatch = nonCommentMatch.trim();
                    if (nonCommentMatch.length == 0 || nonCommentMatch.startsWith(".") || nonCommentMatch.startsWith("#")) {
                        continue
                    }
                    nonCommentMatch = nonCommentMatch.replace(/\'.\'/, "1");
                    nonCommentMatch = nonCommentMatch.replace("\t", " ");
                    const offsetmatch = offsetregex.exec(nonCommentMatch)
                    nonCommentMatch = nonCommentMatch.replace("b_call", "call ")
                    nonCommentMatch = nonCommentMatch.replace("B_CALL", "call ")
                    const wordmatch = wordregex2.exec(nonCommentMatch);
                    nonCommentMatch = nonCommentMatch.toLowerCase();
                    nonCommentMatch = nonCommentMatch.replace(" ,", ",");
                    if (nonCommentMatch.includes(".")) {
                        nonCommentMatch = nonCommentMatch.replace(".lil ", " ");
                        nonCommentMatch = nonCommentMatch.replace(".sil ", " ");
                        nonCommentMatch = nonCommentMatch.replace(".lis ", " ");
                        nonCommentMatch = nonCommentMatch.replace(".lil ", " ");
                        nonCommentMatch = nonCommentMatch.replace(".l ", " ");
                        nonCommentMatch = nonCommentMatch.replace(".s ", " ");
                        if (wordmatch) {
                            wordmatch[2] = wordmatch[2].replace(".lil ", " ");
                            wordmatch[2] = wordmatch[2].replace(".sil ", " ");
                            wordmatch[2] = wordmatch[2].replace(".lis ", " ");
                            wordmatch[2] = wordmatch[2].replace(".lil ", " ");
                            wordmatch[2] = wordmatch[2].replace(".l ", " ");
                            wordmatch[2] = wordmatch[2].replace(".s ", " ");
                        }
                    }
                    if (wordmatch) {
                        wordmatch[3] = wordmatch[3].replace("(", "");
                        wordmatch[3] = wordmatch[3].replace(")", "");
                        if (wordmatch[5]) {
                            wordmatch[5] = wordmatch[5].replace("(", "");
                            wordmatch[5] = wordmatch[5].replace(")", "");
                        }
                    }
                    if (this.instructionItemsFull.indexOf(nonCommentMatch) != -1 && !nonCommentMatch.match(/\b(r8|R8|r24|R24|n|N|mmn|MMN|ir|IR|ix\/y|IX\/Y|rxy|RXY|bit|BIT|cc|CC)\b/)) {
                        continue;
                    }

                    let match = false
                    for (let i = 2; i < 5; ++i) {
                        if (!wordmatch) {
                            if (!nonCommentMatch.match(/\b(ADC|ADD|CP|DAA|DEC|INC|MLT|NEG|SBC|SUB|BIT|RES|SET|CPD|CPDR|CPI|CPIR|LDD|LDDR|LDI|LDIR|EX|EXX|IN|IN0|IND|INDR|INDRX|IND2|IND2R|INDM|INDMR|INI|INIR|INIRX|INI2|INI2R|INIM|INIMR|OTDM|OTDMR|OTDRX|OTIM|OTIMR|OTIRX|OUT|OUT0|OUTD|OTDR|OUTD2|OTD2R|OUTI|OTIR|OUTI2|OTI2R|TSTIO|LD|LEA|PEA|POP|PUSH|AND|CPL|OR|TST|XOR|CCF|DI|EI|HALT|IM|NOP|RSMIX|SCF|SLP|STMIX|CALL|DJNZ|JP|JR|RET|RETI|RETN|RST|RL|RLA|RLC|RLCA|RLD|RR|RRA|RRC|RRCA|RRD|SLA|SRA|SRL|adc|add|cp|daa|dec|inc|mlt|neg|sbc|sub|bit|res|set|cpd|cpdr|cpi|cpir|ldd|lddr|ldi|ldir|ex|exx|in|in0|ind|indr|indrx|ind2|ind2r|indm|indmr|ini|inir|inirx|ini2|ini2r|inim|inimr|otdm|otdmr|otdrx|otim|otimr|otirx|out|out0|outd|otdr|outd2|otd2r|outi|otir|outi2|oti2r|tstio|ld|lea|pea|pop|push|and|cpl|or|tst|xor|ccf|di|ei|halt|im|nop|rsmix|scf|slp|stmix|call|djnz|jp|jr|ret|reti|retn|rst|rl|rla|rlc|rlca|rld|rr|rra|rrc|rrca|rrd|sla|sra|srl)\b/)) {
                                errorCode = unknownOpcode
                            }
                            break
                        }
                        if (wordmatch[i] == undefined) {
                            break
                        }
                        if (i == 4) {
                            i = 5;
                        }
                        if (i == 2 && offsetmatch) {
                            if (nonCommentMatch.replace(offsetmatch[0].toLowerCase(), "").includes(" ")) {
                                nonCommentMatch = nonCommentMatch.replace(offsetmatch[0].toLowerCase(), "");
                                if (nonCommentMatch.indexOf("(") != -1) {
                                    nonCommentMatch = nonCommentMatch + ")";
                                }
                                if (wordmatch[5]) {
                                    wordmatch[3] = wordmatch[3].replace(offsetmatch[0].replace("(", "").replace(")", ""), "");
                                    wordmatch[5] = wordmatch[5].replace(offsetmatch[0].replace("(", "").replace(")", ""), "");
                                    wordmatch[3] = wordmatch[3].replace(offsetmatch[0].replace(")", ""), "");
                                    wordmatch[5] = wordmatch[5].replace(offsetmatch[0].replace(")", ""), "");

                                }

                            }
                            match = true
                            break
                        }
                        let test = "";
                        if (wordmatch[i].match(/(^[0-9]+$)|(^[0-9a-fA-F]+h$)|(^(\$|0x)[0-9a-fA-F]+$)|(^\%[01]+$)|(^[01]+b$)/)) {
                            test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "n")
                            if (this.instructionItemsFull.indexOf(test) != -1) {
                                match = true
                                break
                            }
                            test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "mmn")
                            if (this.instructionItemsFull.indexOf(test) != -1) {
                                match = true
                                break
                            }
                            test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "d")
                            if (this.instructionItemsFull.indexOf(test) != -1) {
                                match = true
                                break
                            }
                        }
                        for (var name in symbols) {
                            if (symbols[name].lowercase === wordmatch[i].toLowerCase()) {
                                test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "mmn")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                                test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "n")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                                test = nonCommentMatch.replace(wordmatch[i].toLowerCase(), "bit")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                                let withoutpars = nonCommentMatch.replace("(", "").replace(")", "");
                                test = withoutpars.replace(wordmatch[i].toLowerCase(), "mmn")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                                test = withoutpars.replace(wordmatch[i].toLowerCase(), "n")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                                test = withoutpars.replace(wordmatch[i].toLowerCase(), "bit")
                                if (this.instructionItemsFull.indexOf(test) != -1) {
                                    match = true
                                    break
                                }
                            }
                        }
                    }
                    if (!match) {
                        // console.log(nonCommentMatch)
                        const endChar = 1 + nonCommentMatch.length;
                        const range = new vscode.Range(lineNumber, 1, lineNumber, endChar)
                        diagnosticsArray.push(new vscode.Diagnostic(range, errorCode));
                    }
                }
            }
        }
        collection.set(document.uri, diagnosticsArray);
    }
}
exports.ASMSymbolDocumenter = ASMSymbolDocumenter;
//# sourceMappingURL=symbolDocumenter.js.map