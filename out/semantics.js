"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");

/**
 * Searches table.possibleRefs to find semantic tokens
 */
class semanticsProvider {
       constructor(symbolDocumenter, legend) {
              this.symbolDocumenter = symbolDocumenter;
              this.legend = legend
       }
       provideDocumentSemanticTokens(document, token) {
              const table = this.symbolDocumenter.documents[document.uri]
              if (!table) {
                     return
              }
              table.refs = []
              const legend = this.legend
              const symbols = this.symbolDocumenter.getAvailableSymbols(document.uri);
              const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
              for (let i = 0; i < table.possibleRefs.length; i++) {
                     const symbol = this.symbolDocumenter.checkSymbol(table.possibleRefs[i].text, document.uri, symbols)
                     if (symbol) {
                            const range = table.possibleRefs[i].range
                            if (symbol.kind == vscode.SymbolKind.Method) {
                                   tokensBuilder.push(range, 'function');
                            } else if (symbol.kind == vscode.SymbolKind.Variable) {
                                   tokensBuilder.push(range, 'variable');
                            } else if (symbol.kind == vscode.SymbolKind.Function) {
                                   tokensBuilder.push(range, 'label');
                            }
                     }
              }
              return tokensBuilder.build("tokens")
       }
}
exports.semanticsProvider = semanticsProvider