"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode")
/**
 * Definition Provider, right click a symbol to use
 */
class definitionProvider {
    constructor(symbolDocumenter) {
        this.symbolDocumenter = symbolDocumenter;
    }
    /**
     * 
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @param {vscode.CancellationToken} token 
     */
    provideDefinition(document, position, token) {
        const range = document.getWordRangeAtPosition(position, /([\w\.]+)/g);
        if (range) {
            const text = document.getText(range);
            const symbol = this.symbolDocumenter.checkSymbol(text, document.uri)
            if (symbol) {
                const range = new vscode.Range(symbol.line, 0, symbol.line, symbol.name.length)
                const uri = vscode.Uri.file(symbol.fsPath)
                return new vscode.Location(uri, range)
            }
        }
        return undefined;
    }
}
exports.definitionProvider = definitionProvider;
//# sourceMappingURL=definitionProvider.js.map