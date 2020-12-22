"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const completionProposer = require("./completion");
const nonCommentRegex = /^([^;]+[^\,\r\n\t\f\v ;])/g
const wordregex = /(\b\w+(\.\w+)?(\.|\b))/g

/**
 * Might use later for go to references feature
 */
class SymbolRef {
    constructor(name, location, lineNumber) {
        this.name = name;
        this.location = location;
        this.lineNumber = lineNumber;
    }
}
/**
 * Scans all open documents for semantic symbols and finds errors
 */
class ASMSemanticTokenProvider {
    constructor(symbolDocumenter, legend) {
        this.symbolDocumenter = symbolDocumenter;
        this.legend = legend
        this.ASMCompletionProposer = new completionProposer.ASMCompletionProposer
        this.instructionItemsFull = this.ASMCompletionProposer.instructionItemsNonForm
        var scanTimeout = 0;

        vscode.workspace.onDidChangeTextDocument((event) => {
            clearTimeout(scanTimeout)
            scanTimeout = setTimeout(() => { screen(event) }, 100);
        });
        vscode.workspace.onDidOpenTextDocument((event) => {
            if (event.document.fileName.match(/(ez80|z80|inc|asm)$/)) {
                screen(event)
                this.provideDocumentSemanticTokens(event.document)
            }        
        })
        const screen = async (event) => {
            if (event.document.fileName.match(/(ez80|z80|inc|asm)$/)) {
                await this.symbolDocumenter.document(event.document, event)
                for (let i = 0; i < vscode.workspace.textDocuments.length; i++) {
                    let doc = vscode.workspace.textDocuments[i]
                    if (doc.fileName.match(/(ez80|z80|inc|asm)$/) && !doc.isClosed && doc != event.document) {
                        this.provideDocumentSemanticTokens(doc)
                    }
                }
            }
        }
        const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ez80,z80,inc,asm}");
        watcher.onDidCreate((uri) => {
            vscode.workspace.openTextDocument(uri).then((document) => {
                screen(document)
            });
        });
        watcher.onDidDelete((uri) => {
            this.symbolDocumenter.files[uri.fsPath].diagnosticCollection.clear()
            delete this.symbolDocumenter.files[uri.fsPath];
        });
        const inital = async (document) => {
            if (document.fileName.match(/(ez80|z80|inc|asm)$/) && !this.symbolDocumenter.files[document.uri.fsPath]) {
                await this.symbolDocumenter.document(document)
                this.provideDocumentSemanticTokens(document)
            }
        }
        if (vscode.window.activeTextEditor) {
            inital(vscode.window.activeTextEditor.document)
        }
    }
    provideDocumentSemanticTokens(document, token) {
        let collection = this.symbolDocumenter.files[document.uri.fsPath].diagnosticCollection
        collection.clear()
        let diagnosticsArray = []
        const legend = this.legend
        const symbols = this.symbolDocumenter.symbols(document);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber);
            let diags = this.symbolDocumenter.getLineDiagnostics(line.text, lineNumber, symbols, document)
            if (diags && diags.length > 0) {
                for (let i = 0; i < diags.length; i++) {
                    diagnosticsArray.push(diags[i])
                }
            }
            let nonCommentMatch = line.text.match(nonCommentRegex)
            if (nonCommentMatch) {
                nonCommentMatch = nonCommentMatch[0].replace(/\".+\"/g, "")
                const wordmatch = nonCommentMatch.match(wordregex);
                if (wordmatch) {
                    let char = 0;
                    for (let index = 0; index < wordmatch.length; ++index) {
                        if (symbols[wordmatch[index]]) {
                            const startChar = nonCommentMatch.indexOf(wordmatch[index], char);
                            const endChar = startChar + wordmatch[index].length
                            const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar)
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
        collection.array = diagnosticsArray
        return tokensBuilder.build("token");
    }
}

exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map