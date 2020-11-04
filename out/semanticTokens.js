"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

class ASMSemanticTokenProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    provideDocumentSemanticTokens(document, token) {
       const tokenTypes = ['function','macro'];
       const tokenModifiers = ['declaration'];
       const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
       const symbols = this.symbolDocumenter.symbols(document);
       const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
       for (const name in symbols) {
           const symbol = symbols[name];
            let symrange = symbol.location.range
              if (symrange.end != symrange.start) { // this always not true for some reason
                     tokensBuilder.push(symrange, 'function', ['declaration']);
                     }
       }
       let SemanticTokens = tokensBuilder.build();
       return SemanticTokens;
    }
}
exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map