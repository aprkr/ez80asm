"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const imports = require("./imports")

/**
 * Searches refs to find semantic tokens
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
              const symbols = this.symbolDocumenter.getAllof(document.uri.fsPath, "symbol", {})
              const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
              const refs = this.symbolDocumenter.getAllinTable(table, "refs", [])
              for (let i = 0; i < refs.length; i++) {
                     const symbol = this.symbolDocumenter.checkSymbol(refs[i].name, document.uri, symbols)
                     if (symbol) {
                            const range = refs[i].range
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