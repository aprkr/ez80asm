"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const documenter = require("./symbolDocumenter2")
const hover = require("./hover")
const definitions = require("./definitionProvider");
const runner = require("./main")
const diagnostics = require("./diagnostics")
const semantics = require("./semantics")
const documentSymbolProvider = require("./documentSymbolProvider")



const tokenTypes = ['function','variable', 'class', 'label'];
const tokenModifiers = ['declaration'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

function activate(context) {
       const symbolDocumenter = new documenter.symbolDocumenter();
       const diagnosticsProvider = new diagnostics.diagnosticProvider(symbolDocumenter)
       new runner.main(symbolDocumenter, diagnosticsProvider)
       context.subscriptions.push(vscode.languages.registerHoverProvider('ez80-asm', new hover.hoverProvider(symbolDocumenter)));
       context.subscriptions.push(vscode.languages.registerDefinitionProvider('ez80-asm', new definitions.definitionProvider(symbolDocumenter)));
       context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('ez80-asm', new documentSymbolProvider.ASMDocumentSymbolProvider(symbolDocumenter)));
       setTimeout(() => {context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('ez80-asm', new semantics.semanticsProvider(symbolDocumenter, legend), legend))}, 1200)
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map