"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class ASMSemanticTokenProvider {
    constructor(symbolDocumenter, legend) {
        this.symbolDocumenter = symbolDocumenter;
        this.legend = legend
    }
    provideDocumentSemanticTokens(document, token) {
        const wordregex = /\b\w+\.?\w+\b/g
        const commentregex = /^.*?;/g
        // const tokenTypes = ['function', 'variable', 'class', 'label'];
        // const tokenModifiers = ['declaration'];
        // const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
        const legend = this.legend
        const symbols = this.symbolDocumenter.symbols(document);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
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
                            // let regexp = new RegExp("(\\b|\\s|^)"+wordmatch[index]+"(\\W|\\z|\\b)","g");
                            // let startChar = nonCommentMatch.search(regexp);
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

    exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map