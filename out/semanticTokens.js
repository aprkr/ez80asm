"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class ASMSemanticTokenProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDocumentSemanticTokens(document, token) {
        const wordregex = /\b\w+\b/g
        const commentregex = /.+;/g
        const tokenTypes = ['function', 'variable', 'class'];
        const tokenModifiers = ['declaration'];
        const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
        const symbols = this.symbolDocumenter.symbols(document);
        const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
        for (let linenumber = 0; linenumber < document.lineCount; linenumber++) {
            const line = document.lineAt(linenumber);
            let noncommentmatch = line.text.match(commentregex);
            if (noncommentmatch || (!line.text.includes(";") && line.text.length > 0)) {
                if (noncommentmatch) {
                    noncommentmatch = noncommentmatch[0];
                } else {
                    noncommentmatch = line.text
                }

                const wordmatch = noncommentmatch.match(wordregex);
                if (wordmatch) {
                    for (let j = 0; j < wordmatch.length; ++j) {
                        if (symbols[wordmatch[j]]) {
                            let startchar = noncommentmatch.indexOf(wordmatch[j]);
                            let endchar = startchar + wordmatch[j].length
                            const range = new vscode.Range(linenumber, startchar, linenumber, endchar)
                            // console.log(wordmatch[j]);
                            if (symbols[wordmatch[j]].kind == vscode.SymbolKind.Method) {
                                tokensBuilder.push(range, 'class');
                            } else (symbols[wordmatch[j]].kind == vscode.SymbolKind.Constant) {
                                tokensBuilder.push(range, 'variable');
                            }
                        }
                    }
                }
            }
        }

        let SemanticTokens = tokensBuilder.build();
        return SemanticTokens;
    }
}

exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map