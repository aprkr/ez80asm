const vscode = require("vscode");
const documenter = (require("./symbolDocumenter2")).symbolDocumenter
const hoverProvider = (require("./hover")).hoverProvider
const semanticsProvider = (require("./semantics")).semanticsProvider
const RefsnDefs = (require("./RefsnDefs")).RefsnDefs

const tokenTypes = ['function','variable', 'label', 'macro'];
const tokenModifiers = ['declaration'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
/**
 * @param {vscode.ExtensionContext} context 
 */
exports.activate = (context) => {
      // const extContext = {}
      // for (const k in context) {
      //       try {
      //             extContext[k] = context[k];
      //       }
      //       catch (error) { }
      // }
      const symbolDocumenter = new documenter(context)
      context.subscriptions.push(symbolDocumenter)
      context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('ez80-asm', new semanticsProvider(symbolDocumenter, legend), legend))
      context.subscriptions.push(vscode.languages.registerHoverProvider('ez80-asm', new hoverProvider(symbolDocumenter)))
      const refsNDefs = new RefsnDefs(symbolDocumenter)
      context.subscriptions.push(vscode.languages.registerDefinitionProvider('ez80-asm', refsNDefs))
      context.subscriptions.push(vscode.languages.registerReferenceProvider('ez80-asm', refsNDefs))
      context.subscriptions.push(vscode.languages.registerRenameProvider('ez80-asm', refsNDefs))
      vscode.workspace.onDidChangeTextDocument((event) => {
            symbolDocumenter.scan(event.document.getText(), event.document.uri.fsPath, event)
            console.log("done scanning")
      })
      vscode.workspace.onDidOpenTextDocument((document) => {
            if (!symbolDocumenter.docTables[document.uri.fsPath]) {
                  symbolDocumenter.scan(document.getText(), document.uri.fsPath)
            }
      })
      if (vscode.window.activeTextEditor && !symbolDocumenter.docTables[vscode.window.activeTextEditor.document.uri.fsPath]) {
            const document = vscode.window.activeTextEditor.document
            symbolDocumenter.scan(document.getText(), document.uri.fsPath)
      }
}
exports.deactivate = () => { }