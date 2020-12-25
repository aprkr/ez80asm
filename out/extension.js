// Much of this source is based on the "RGBDS Z80" extension by Donald Hays
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const hover = require("./hover");
const definitionProvider_1 = require("./definitionProvider");
const documentSymbolProvider = require("./documentSymbolProvider");
const symbolDocumenter_1 = require("./symbolDocumenter");
const semanticTokens = require("./semantics.js");
const tokenTypes = ['function','variable', 'class', 'label'];
const tokenModifiers = ['declaration'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);
const completionProposer = require("./completion");


function activate(context) {
    const symbolDocumenter = new symbolDocumenter_1.ASMSymbolDocumenter();
    context.subscriptions.push(vscode.languages.registerHoverProvider('ez80-asm', new hover.ASMHoverProvider(symbolDocumenter)));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('ez80-asm', new definitionProvider_1.ASMDefinitionProvider(symbolDocumenter)));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('ez80-asm', new documentSymbolProvider.ASMDocumentSymbolProvider(symbolDocumenter)));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider('ez80-asm', new completionProposer.ASMCompletionProposer(symbolDocumenter)));
    setTimeout(() => {context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider('ez80-asm', new semanticTokens.ASMSemanticTokenProvider(symbolDocumenter, legend), legend))}, 1200)
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map