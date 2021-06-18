const vscode = require("vscode");

/**
 * Searches refs to find semantic tokens
 */
class semanticsProvider {
      /**
       * 
       * @param {} symbolDocumenter 
       * @param {vscode.SemanticTokensLegend} legend 
       */
      constructor(symbolDocumenter, legend) {
            this.symbolDocumenter = symbolDocumenter
            this.legend = legend
      }
      /**
       * 
       * @param {vscode.TextDocument} document 
       * @param {vscode.CancellationToken} token 
       */
      provideDocumentSemanticTokens(document, token) {
            const docTable = this.symbolDocumenter.docTables[document.uri.fsPath]
            if (!docTable) {
                  return
            }
            const refs = docTable.refs.getTable()
            const tokensBuilder = new vscode.SemanticTokensBuilder(this.legend);
            for (let i = 0; i < refs.length; i++) {
                  const refArray = refs[i].value
                  const symbol = this.symbolDocumenter.checkSymbol(refs[i].key, document.uri.fsPath)
                  if (symbol) {
                        for (let j = 0; j < refArray.length; j++) {
                              const range = this.symbolDocumenter.getRange(refs[i].key, refArray[j])
                              if (symbol.kind == vscode.SymbolKind.Method) {
                                    tokensBuilder.push(range, 'function');
                              } else if (symbol.kind == vscode.SymbolKind.Variable) {
                                    tokensBuilder.push(range, 'variable');
                              } else if (symbol.kind == vscode.SymbolKind.Function) {
                                    tokensBuilder.push(range, 'label');
                              } else if (symbol.kind == vscode.SymbolKind.Constant) {
                                    tokensBuilder.push(range, 'macro')
                              }
                        }
                  } else {
                        // invalid ref
                  }
            }
            return tokensBuilder.build("tokens")

      }
}
exports.semanticsProvider = semanticsProvider