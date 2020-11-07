'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
// const syntaxInfo_1 = require("./syntaxInfo");
const commentLineRegex = /^;\s*(.*)$/;
const endCommentRegex = /^[^;]+;\s*(.*)$/;
const includeLineRegex = /^\#?include[\W]+"([^"]+)".*$/i;
const spacerRegex = /^\s*(.)\1{3,}\s*$/;
const labelDefinitionRegex = /^((([a-zA-Z_][a-zA-Z_0-9]*)?\.)?[a-zA-Z_][a-zA-Z_0-9]*[:]{0,2}).*$/;
const defineExpressionRegex = /^[\s]*[a-zA-Z_][a-zA-Z_0-9]*[\W]+(equ|equs|set|EQU)[\W]+.*$/i;
// const instructionRegex = new RegExp(`^(${syntaxInfo_1.syntaxInfo.instructions.join("|")})\\b`, "i");
// const keywordRegex = new RegExp(`^(${syntaxInfo_1.syntaxInfo.preprocessorKeywords.join("|")})\\b`, "i");
class ScopeDescriptor {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}
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
        vscode.workspace.findFiles("**/*.{ez80,z80,inc,asm}", null, undefined).then((files) => {
            files.forEach((fileURI) => {
                vscode.workspace.openTextDocument(fileURI).then((document) => {
                    this._document(document);
                });
            });
        });
        vscode.workspace.onDidChangeTextDocument((event) => {
            this._document(event.document);
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
    _document(document) {
        const table = new FileTable(document.uri.fsPath);
        this.files[document.uri.fsPath] = table;
        // let currentScope = undefined;
        let commentBuffer = [];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
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
                        commentBuffer.splice(0, 0, `\`${withoutComment}\`\n`);
                        kind = vscode.SymbolKind.Variable
                    }
                    if (commentBuffer.length > 0) {
                        documentation = commentBuffer.join("\n");
                    }
                    table.symbols[name] = new SymbolDescriptor(location, kind == undefined ? vscode.SymbolKind.Function : kind, documentation);
                }
                commentBuffer = [];
            }
        }
        // if (currentScope) {
        // currentScope.end = document.lineAt(document.lineCount - 1).rangeIncludingLineBreak.end;
        // }
    }
}
exports.ASMSymbolDocumenter = ASMSymbolDocumenter;
//# sourceMappingURL=symbolDocumenter.js.map