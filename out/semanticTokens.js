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
              if (symbols.hasOwnProperty(name)) {
                     let symrange = symbols[name].location.range;
                     tokensBuilder.push(symrange, 'function', ['declaration']);
                     }
       }
       // let SemanticTokens = tokensBuilder.build();
       return tokensBuilder.build();
    }
}
exports.ASMSemanticTokenProvider = ASMSemanticTokenProvider;
//# sourceMappingURL=definitionProvider.js.map