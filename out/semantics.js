"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")

/**
 * Searches table.possibleRefs to find semantic tokens
 */
class semanticsProvider {
       /**
        * 
        * @param {imports.symbolDocumenter} symbolDocumenter 
        * @param {vscode.SemanticTokensLegend} legend 
        */
       constructor(symbolDocumenter, legend) {
              this.symbolDocumenter = symbolDocumenter;
              this.legend = legend
       }
       /**
        * 
        * @param {vscode.TextDocument} document 
        * @param {vscode.CancellationToken} token 
        */
       provideDocumentSemanticTokens(document, token) {
              const table = this.symbolDocumenter.documents[document.uri.fsPath]
              if (!table) {
                     return
              }
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