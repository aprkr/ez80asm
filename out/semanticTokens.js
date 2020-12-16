"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class SymbolRef {
    constructor (name, location, lineNumber) {
        this.name = name;
        this.location = location;
        this.lineNumber = lineNumber;
    }
}
class ASMSemanticTokenProvider {
    constructor(symbolDocumenter, legend) {
        this.symbolDocumenter = symbolDocumenter;
        this.legend = legend
    }
    provideDocumentSemanticTokens(document, token) {
        const wordregex = /\b\w+\.?\w+\b/g
        const commentregex = /^.*?;/g
        const legend = this.legend
        const symbols = this.symbolDocumenter.symbols(document);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        const table = this.symbolDocumenter.files[document.fileName];
        for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
            const line = document.lineAt(lineNumber);
            let nonCommentMatch = line.text.match(commentregex);
            if ((nonCommentMatch && nonCommentMatch !== ";") || (!line.text.includes(";") && line.text.length > 0)) {
                if (nonCommentMatch) {
                    nonCommentMatch = nonCommentMatch[0];
                } else {
                    nonCommentMatch = line.text
                }
                nonCommentMatch = nonCommentMatch.replace(/\".+\"/g, "")
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
            return tokensBuilder.build();
        }
    }

    exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map