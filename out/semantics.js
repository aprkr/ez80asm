"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const completionProposer = require("./completion");
const nonCommentRegex = /^([^;]+[^\,\s;])/g
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
class semanticsProvider {
    constructor(symbolDocumenter, legend) {
        this.symbolDocumenter = symbolDocumenter;
        this.legend = legend
    }
    provideDocumentSemanticTokens(document, token) {
        const legend = this.legend
        const symbols = this.symbolDocumenter.getAvailableSymbols(document.uri);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber);
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
        return tokensBuilder.build();
    }
}

exports.semanticsProvider = semanticsProvider;
//# sourceMappingURL=definitionProvider.js.map